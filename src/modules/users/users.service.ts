import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserBasicDto } from './dto/user-basic.dto';
import { UserDetailDto } from './dto/user-detail.dto';
import { User, UserRole } from './entities/user.entity';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateUserDto, forcedRole?: UserRole): Promise<UserDetailDto> {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('El email ya esta registrado');
    }

    const saltRounds = this.configService.get<number>('bcrypt.saltRounds', 10);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);
    const user = this.usersRepo.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: forcedRole ?? dto.role ?? UserRole.MEMBER,
      isActive: true,
    });
    return this.toDetail(await this.usersRepo.save(user));
  }

  async findAll(query: FindUsersDto): Promise<PaginatedResult<UserBasicDto>> {
    const qb = this.usersRepo.createQueryBuilder('u');
    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('u.isActive = :isActive', { isActive: query.isActive });
    }
    qb.orderBy('u.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [users, total] = await qb.getManyAndCount();
    return {
      data: users.map((user) => this.toBasic(user)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }
    return user;
  }

  async findActiveMemberById(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user.isActive) {
      throw new ForbiddenException('Usuario inactivo');
    }
    if (user.role !== UserRole.MEMBER) {
      throw new ForbiddenException('Solo los miembros pueden recibir prestamos');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findDetailById(id: string): Promise<UserDetailDto> {
    return this.toDetail(await this.findById(id));
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDetailDto> {
    const user = await this.findById(id);
    if (dto.email && dto.email !== user.email) {
      const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('El email ya esta registrado');
      }
    }

    Object.assign(user, dto);
    return this.toDetail(await this.usersRepo.save(user));
  }

  async softDelete(id: string): Promise<UserDetailDto> {
    const user = await this.findById(id);
    user.isActive = false;
    return this.toDetail(await this.usersRepo.save(user));
  }

  toBasic(user: User): UserBasicDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  toDetail(user: User): UserDetailDto {
    return {
      ...this.toBasic(user),
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
