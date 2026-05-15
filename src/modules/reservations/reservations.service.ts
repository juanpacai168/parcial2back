import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Item } from '../items/entities/item.entity';
import { Loan, LoanStatus } from '../loans/entities/loan.entity';
import { UserRole } from '../users/entities/user.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { FindReservationsDto } from './dto/find-reservations.dto';
import { ReservationBasicDto } from './dto/reservation-basic.dto';
import { Reservation } from './entities/reservation.entity';

const OPEN_LOAN_STATUSES = [LoanStatus.ACTIVE, LoanStatus.OVERDUE];

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepo: Repository<Reservation>,
    @InjectRepository(Item)
    private readonly itemsRepo: Repository<Item>,
    @InjectRepository(Loan)
    private readonly loansRepo: Repository<Loan>,
  ) {}

  async create(dto: CreateReservationDto, actor: AuthenticatedUser): Promise<ReservationBasicDto> {
    const item = await this.itemsRepo.findOne({ where: { id: dto.itemId } });
    if (!item) {
      throw new NotFoundException(`Item ${dto.itemId} no encontrado`);
    }
    if (!item.isActive) {
      throw new BadRequestException('No se pueden reservar items inactivos');
    }

    const blockingLoan = await this.loansRepo.findOne({
      where: { itemId: item.id, status: In(OPEN_LOAN_STATUSES) },
    });
    if (!blockingLoan) {
      throw new ConflictException('Solo se puede reservar un item que esta prestado');
    }

    const existing = await this.findActiveReservationForUser(actor.id, item.id);
    if (existing) {
      throw new ConflictException('El usuario ya tiene una reserva pendiente para este item');
    }

    const reservation = this.reservationsRepo.create({
      userId: actor.id,
      itemId: item.id,
      fulfilledAt: null,
      cancelledAt: null,
      expiresAt: null,
    });
    return this.toBasic(await this.reservationsRepo.save(reservation));
  }

  async findAll(
    query: FindReservationsDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedResult<ReservationBasicDto>> {
    const qb = this.reservationsRepo.createQueryBuilder('r');

    if (actor.role === UserRole.MEMBER) {
      qb.andWhere('r.userId = :userId', { userId: actor.id });
    } else if (query.userId) {
      qb.andWhere('r.userId = :userId', { userId: query.userId });
    }

    if (query.itemId) {
      qb.andWhere('r.itemId = :itemId', { itemId: query.itemId });
    }

    qb.orderBy('r.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [reservations, total] = await qb.getManyAndCount();
    return {
      data: reservations.map((reservation) => this.toBasic(reservation)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async cancel(id: string, actor: AuthenticatedUser): Promise<ReservationBasicDto> {
    const reservation = await this.reservationsRepo.findOne({ where: { id } });
    if (!reservation) {
      throw new NotFoundException(`Reserva ${id} no encontrada`);
    }
    if (actor.role === UserRole.MEMBER && reservation.userId !== actor.id) {
      throw new ForbiddenException('No autorizado para cancelar esta reserva');
    }
    if (reservation.cancelledAt) {
      throw new BadRequestException('La reserva ya fue cancelada');
    }

    reservation.cancelledAt = new Date();
    return this.toBasic(await this.reservationsRepo.save(reservation));
  }

  private async findActiveReservationForUser(
    userId: string,
    itemId: string,
  ): Promise<Reservation | null> {
    const now = new Date();
    return this.reservationsRepo.findOne({
      where: [
        { userId, itemId, cancelledAt: IsNull(), fulfilledAt: IsNull() },
        { userId, itemId, cancelledAt: IsNull(), expiresAt: MoreThan(now) },
      ],
    });
  }

  private toBasic(reservation: Reservation): ReservationBasicDto {
    return {
      id: reservation.id,
      userId: reservation.userId,
      itemId: reservation.itemId,
      createdAt: reservation.createdAt,
      fulfilledAt: reservation.fulfilledAt,
      cancelledAt: reservation.cancelledAt,
      expiresAt: reservation.expiresAt,
    };
  }
}
