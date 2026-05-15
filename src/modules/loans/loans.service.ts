import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ItemBasicDto } from '../items/dto/item-basic.dto';
import { Item } from '../items/entities/item.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { UserBasicDto } from '../users/dto/user-basic.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { FindLoansDto } from './dto/find-loans.dto';
import { LoanBasicDto } from './dto/loan-basic.dto';
import { LoanDetailDto } from './dto/loan-detail.dto';
import { Loan, LoanStatus } from './entities/loan.entity';

const OPEN_STATUSES: LoanStatus[] = [LoanStatus.ACTIVE, LoanStatus.OVERDUE];

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private readonly loansRepo: Repository<Loan>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateLoanDto, actor: AuthenticatedUser): Promise<LoanDetailDto> {
    const targetUserId = this.resolveTargetUserId(dto.userId, actor);
    const maxActiveLoans = this.configService.get<number>('loans.maxActivePerUser', 3);
    const maxLoanDays = this.configService.get<number>('loans.maxLoanDays', 30);

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: targetUserId } });
      if (!user) {
        throw new NotFoundException(`Usuario ${targetUserId} no encontrado`);
      }
      if (!user.isActive) {
        throw new ForbiddenException('No se pueden registrar prestamos para usuarios inactivos');
      }
      if (user.role !== UserRole.MEMBER) {
        throw new ForbiddenException('Solo miembros pueden recibir prestamos');
      }

      const activeCount = await manager.count(Loan, {
        where: { userId: user.id, status: In(OPEN_STATUSES), returnedAt: IsNull() },
      });
      if (activeCount >= maxActiveLoans) {
        throw new ConflictException(`El miembro ya tiene ${maxActiveLoans} prestamos activos`);
      }

      const item = await manager.findOne(Item, {
        where: { id: dto.itemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) {
        throw new NotFoundException(`Item ${dto.itemId} no encontrado`);
      }
      if (!item.isActive) {
        throw new BadRequestException('No se pueden prestar items inactivos');
      }

      const blockingLoan = await manager.findOne(Loan, {
        where: { itemId: item.id, status: In(OPEN_STATUSES), returnedAt: IsNull() },
      });
      if (blockingLoan) {
        throw new ConflictException(`El item ya esta prestado por el loan ${blockingLoan.id}`);
      }

      const loanedAt = new Date();
      const dueAt = new Date(dto.dueAt);
      this.assertLoanWindow(loanedAt, dueAt, maxLoanDays);

      const firstReservation = await this.findFirstActiveReservation(manager, item.id, loanedAt);
      if (firstReservation && firstReservation.userId !== user.id) {
        throw new ForbiddenException(
          'El item tiene reservas pendientes; solo el primer usuario de la cola puede tomarlo',
        );
      }

      const loan = manager.create(Loan, {
        userId: user.id,
        itemId: item.id,
        loanedAt,
        dueAt,
        returnedAt: null,
        status: LoanStatus.ACTIVE,
        fineAmount: 0,
      });
      const saved = await manager.save(Loan, loan);
      if (firstReservation) {
        firstReservation.fulfilledAt = firstReservation.fulfilledAt ?? loanedAt;
        firstReservation.expiresAt = loanedAt;
        await manager.save(Reservation, firstReservation);
      }
      return this.toDetail(await this.loadLoanDetail(manager, saved.id));
    });
  }

  async findAll(
    query: FindLoansDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedResult<LoanBasicDto>> {
    await this.refreshOverdueLoans();

    const qb = this.loansRepo.createQueryBuilder('l');
    if (actor.role === UserRole.MEMBER) {
      qb.andWhere('l.userId = :userId', { userId: actor.id });
    } else if (query.userId) {
      qb.andWhere('l.userId = :userId', { userId: query.userId });
    }
    if (query.itemId) {
      qb.andWhere('l.itemId = :itemId', { itemId: query.itemId });
    }
    if (query.status) {
      qb.andWhere('l.status = :status', { status: query.status });
    }
    qb.orderBy('l.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [loans, total] = await qb.getManyAndCount();
    return {
      data: loans.map((loan) => this.toBasic(loan)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findById(id: string, actor: AuthenticatedUser): Promise<LoanDetailDto> {
    await this.refreshOverdueLoans();
    const loan = await this.loansRepo.findOne({
      where: { id },
      relations: { user: true, item: true },
    });
    if (!loan) {
      throw new NotFoundException(`Prestamo ${id} no encontrado`);
    }
    this.assertCanSeeLoan(loan, actor);
    return this.toDetail(loan);
  }

  async returnLoan(id: string, actor: AuthenticatedUser): Promise<LoanDetailDto> {
    const dailyFineRate = this.configService.get<number>('loans.dailyFineRate', 0.5);

    return this.dataSource.transaction(async (manager) => {
      const loan = await manager.findOne(Loan, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!loan) {
        throw new NotFoundException(`Prestamo ${id} no encontrado`);
      }
      this.assertCanModifyLoan(loan, actor);
      if (loan.status === LoanStatus.RETURNED) {
        throw new BadRequestException('El prestamo ya fue devuelto');
      }
      if (loan.status === LoanStatus.LOST) {
        throw new BadRequestException('No se puede devolver un prestamo marcado como perdido');
      }

      const returnedAt = new Date();
      if (loan.status === LoanStatus.ACTIVE && loan.dueAt < returnedAt && !loan.returnedAt) {
        loan.status = LoanStatus.OVERDUE;
      }
      const daysLate = this.daysLate(loan.dueAt, returnedAt);
      loan.returnedAt = returnedAt;
      loan.status = LoanStatus.RETURNED;
      loan.fineAmount = Number((daysLate * dailyFineRate).toFixed(2));

      const saved = await manager.save(Loan, loan);
      await this.fulfillNextReservation(manager, loan.itemId, returnedAt);
      return this.toDetail(await this.loadLoanDetail(manager, saved.id));
    });
  }

  async markLost(id: string): Promise<LoanDetailDto> {
    return this.dataSource.transaction(async (manager) => {
      const loan = await manager.findOne(Loan, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!loan) {
        throw new NotFoundException(`Prestamo ${id} no encontrado`);
      }
      if (!OPEN_STATUSES.includes(loan.status)) {
        throw new BadRequestException(`No se puede marcar como perdido un prestamo ${loan.status}`);
      }
      loan.status = LoanStatus.LOST;
      const saved = await manager.save(Loan, loan);
      return this.toDetail(await this.loadLoanDetail(manager, saved.id));
    });
  }

  private resolveTargetUserId(userId: string | undefined, actor: AuthenticatedUser): string {
    if (actor.role === UserRole.MEMBER) {
      if (userId && userId !== actor.id) {
        throw new ForbiddenException('Un miembro solo puede registrar prestamos para si mismo');
      }
      return actor.id;
    }
    return userId ?? actor.id;
  }

  private assertCanSeeLoan(loan: Loan, actor: AuthenticatedUser): void {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.LIBRARIAN) {
      return;
    }
    if (loan.userId === actor.id) {
      return;
    }
    throw new ForbiddenException('No autorizado para ver este prestamo');
  }

  private assertCanModifyLoan(loan: Loan, actor: AuthenticatedUser): void {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.LIBRARIAN) {
      return;
    }
    if (loan.userId === actor.id) {
      return;
    }
    throw new ForbiddenException('No autorizado para modificar este prestamo');
  }

  private assertLoanWindow(loanedAt: Date, dueAt: Date, maxLoanDays: number): void {
    if (Number.isNaN(dueAt.getTime()) || dueAt <= loanedAt) {
      throw new BadRequestException('dueAt debe ser posterior a loanedAt');
    }
    if (dueAt.getTime() - loanedAt.getTime() > maxLoanDays * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`La ventana maxima del prestamo es de ${maxLoanDays} dias`);
    }
  }

  private async refreshOverdueLoans(): Promise<void> {
    await this.loansRepo
      .createQueryBuilder()
      .update(Loan)
      .set({ status: LoanStatus.OVERDUE })
      .where('status = :status', { status: LoanStatus.ACTIVE })
      .andWhere('"returnedAt" IS NULL')
      .andWhere('"dueAt" < :now', { now: new Date() })
      .execute();
  }

  private async loadLoanDetail(manager: EntityManager, id: string): Promise<Loan> {
    const loan = await manager.findOne(Loan, {
      where: { id },
      relations: { user: true, item: true },
    });
    if (!loan) {
      throw new NotFoundException(`Prestamo ${id} no encontrado`);
    }
    return loan;
  }

  private async findFirstActiveReservation(
    manager: EntityManager,
    itemId: string,
    now: Date,
  ): Promise<Reservation | null> {
    return manager
      .createQueryBuilder(Reservation, 'r')
      .where('r.itemId = :itemId', { itemId })
      .andWhere('r.cancelledAt IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('r.fulfilledAt IS NULL').orWhere('r.expiresAt > :now', { now });
        }),
      )
      .orderBy('r.createdAt', 'ASC')
      .setLock('pessimistic_write')
      .getOne();
  }

  private async fulfillNextReservation(
    manager: EntityManager,
    itemId: string,
    fulfilledAt: Date,
  ): Promise<void> {
    const reservation = await manager
      .createQueryBuilder(Reservation, 'r')
      .where('r.itemId = :itemId', { itemId })
      .andWhere('r.cancelledAt IS NULL')
      .andWhere('r.fulfilledAt IS NULL')
      .orderBy('r.createdAt', 'ASC')
      .setLock('pessimistic_write')
      .getOne();

    if (!reservation) {
      return;
    }

    reservation.fulfilledAt = fulfilledAt;
    reservation.expiresAt = new Date(fulfilledAt.getTime() + 48 * 60 * 60 * 1000);
    await manager.save(Reservation, reservation);
  }

  private daysLate(dueAt: Date, returnedAt: Date): number {
    if (returnedAt <= dueAt) {
      return 0;
    }
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((returnedAt.getTime() - dueAt.getTime()) / msPerDay);
  }

  private toBasic(loan: Loan): LoanBasicDto {
    return {
      id: loan.id,
      userId: loan.userId,
      itemId: loan.itemId,
      loanedAt: loan.loanedAt,
      dueAt: loan.dueAt,
      returnedAt: loan.returnedAt,
      status: loan.status,
      fineAmount: loan.fineAmount,
    };
  }

  private toDetail(loan: Loan): LoanDetailDto {
    return {
      id: loan.id,
      user: this.toUserBasic(loan.user),
      item: this.toItemBasic(loan.item, !OPEN_STATUSES.includes(loan.status)),
      userId: loan.userId,
      itemId: loan.itemId,
      loanedAt: loan.loanedAt,
      dueAt: loan.dueAt,
      returnedAt: loan.returnedAt,
      status: loan.status,
      fineAmount: loan.fineAmount,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
    };
  }

  private toUserBasic(user: User | undefined): UserBasicDto {
    if (!user) {
      throw new NotFoundException('Usuario del prestamo no encontrado');
    }
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  private toItemBasic(item: Item | undefined, isAvailable: boolean): ItemBasicDto {
    if (!item) {
      throw new NotFoundException('Item del prestamo no encontrado');
    }
    return {
      id: item.id,
      code: item.code,
      title: item.title,
      type: item.type,
      isActive: item.isActive,
      isAvailable,
    };
  }
}
