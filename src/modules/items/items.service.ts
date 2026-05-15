import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Loan, LoanStatus } from '../loans/entities/loan.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { FindItemsDto } from './dto/find-items.dto';
import { ItemBasicDto } from './dto/item-basic.dto';
import { ItemDetailDto } from './dto/item-detail.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item } from './entities/item.entity';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly itemsRepo: Repository<Item>,
    @InjectRepository(Loan)
    private readonly loansRepo: Repository<Loan>,
  ) {}

  async create(dto: CreateItemDto): Promise<ItemDetailDto> {
    await this.assertCodeAvailable(dto.code);
    const item = this.itemsRepo.create({
      code: dto.code,
      title: dto.title,
      type: dto.type,
      isActive: true,
    });
    return this.toDetail(await this.itemsRepo.save(item));
  }

  async findAll(query: FindItemsDto): Promise<PaginatedResult<ItemBasicDto>> {
    const qb = this.itemsRepo.createQueryBuilder('i');
    if (query.type) {
      qb.andWhere('i.type = :type', { type: query.type });
    }
    qb.andWhere('i.isActive = true');
    qb.orderBy('i.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    const unavailableIds = await this.findUnavailableItemIds(items.map((item) => item.id));
    return {
      data: items.map((item) => this.toBasic(item, !unavailableIds.has(item.id))),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findById(id: string): Promise<Item> {
    const item = await this.itemsRepo.findOne({ where: { id, isActive: true } });
    if (!item) {
      throw new NotFoundException(`Item ${id} no encontrado`);
    }
    return item;
  }

  async findDetailById(id: string): Promise<ItemDetailDto> {
    const item = await this.findById(id);
    return this.toDetail(item, await this.isAvailable(item.id));
  }

  async update(id: string, dto: UpdateItemDto): Promise<ItemDetailDto> {
    const item = await this.findById(id);
    Object.assign(item, dto);
    return this.toDetail(await this.itemsRepo.save(item));
  }

  async softDelete(id: string): Promise<void> {
    const item = await this.findById(id);
    item.isActive = false;
    await this.itemsRepo.save(item);
  }

  toBasic(item: Item, isAvailable = true): ItemBasicDto {
    return {
      id: item.id,
      code: item.code,
      title: item.title,
      type: item.type,
      isActive: item.isActive,
      isAvailable,
    };
  }

  toDetail(item: Item, isAvailable = true): ItemDetailDto {
    return {
      ...this.toBasic(item, isAvailable),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private async isAvailable(itemId: string): Promise<boolean> {
    const blockingLoan = await this.loansRepo.findOne({
      where: {
        itemId,
        status: In([LoanStatus.ACTIVE, LoanStatus.OVERDUE]),
        returnedAt: IsNull(),
      },
    });
    return !blockingLoan;
  }

  private async findUnavailableItemIds(itemIds: string[]): Promise<Set<string>> {
    if (itemIds.length === 0) {
      return new Set<string>();
    }
    const loans = await this.loansRepo.find({
      where: {
        itemId: In(itemIds),
        status: In([LoanStatus.ACTIVE, LoanStatus.OVERDUE]),
        returnedAt: IsNull(),
      },
    });
    return new Set(loans.map((loan) => loan.itemId));
  }

  private async assertCodeAvailable(code: string): Promise<void> {
    const existing = await this.itemsRepo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException('El codigo del item ya existe');
    }
  }
}
