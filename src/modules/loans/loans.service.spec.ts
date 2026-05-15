import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Item, ItemType } from '../items/entities/item.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { Loan, LoanStatus } from './entities/loan.entity';
import { LoansService } from './loans.service';

describe('LoansService', () => {
  type QueryBuilderMock = {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    setLock: jest.Mock;
    getOne: jest.Mock;
  };

  function createQueryBuilderMock(result: unknown = null): QueryBuilderMock {
    const qb = {} as QueryBuilderMock;
    qb.where = jest.fn(() => qb);
    qb.andWhere = jest.fn(() => qb);
    qb.orderBy = jest.fn(() => qb);
    qb.setLock = jest.fn(() => qb);
    qb.getOne = jest.fn().mockResolvedValue(result);
    return qb;
  }

  const member: User = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'member@library.local',
    passwordHash: 'hash',
    firstName: 'Memo',
    lastName: 'Member',
    role: UserRole.MEMBER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const item: Item = {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'BK-001',
    title: 'El Quijote',
    type: ItemType.BOOK,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const actor = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'librarian@library.local',
    role: UserRole.LIBRARIAN,
  };

  function validFutureDueAt(): string {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  function createService(manager: Record<string, unknown>): LoansService {
    const dataSource = {
      transaction: jest.fn((cb: (entityManager: EntityManager) => Promise<unknown>) =>
        cb(manager as unknown as EntityManager),
      ),
    } as unknown as DataSource;

    const configService = {
      get: jest.fn((key: string, fallback?: number) => {
        const values: Record<string, number> = {
          'loans.maxActivePerUser': 3,
          'loans.maxLoanDays': 30,
          'loans.dailyFineRate': 0.5,
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;

    return new LoansService({} as Repository<Loan>, dataSource, configService);
  }

  it('crea prestamo exitoso cuando item disponible, usuario bajo limite y fechas validas', async () => {
    const loanedAt = new Date('2026-01-01T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(loanedAt);

    const savedLoan: Loan = {
      id: '44444444-4444-4444-8444-444444444444',
      userId: member.id,
      itemId: item.id,
      loanedAt,
      dueAt: new Date('2026-01-08T00:00:00.000Z'),
      returnedAt: null,
      status: LoanStatus.ACTIVE,
      fineAmount: 0,
      user: member,
      item,
      createdAt: loanedAt,
      updatedAt: loanedAt,
    };

    const manager = {
      findOne: jest.fn((entity, options: { where: Record<string, unknown> }) => {
        if (entity === User) {
          return Promise.resolve(member);
        }
        if (entity === Item) {
          return Promise.resolve(item);
        }
        if (entity === Loan && options.where.id) {
          return Promise.resolve(savedLoan);
        }
        return Promise.resolve(null);
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(() => savedLoan),
      save: jest.fn().mockResolvedValue(savedLoan),
      createQueryBuilder: jest.fn(() => createQueryBuilderMock()),
    };

    const service = createService(manager);
    const dto: CreateLoanDto = {
      userId: member.id,
      itemId: item.id,
      dueAt: '2026-01-08T00:00:00.000Z',
    };

    await expect(service.create(dto, actor)).resolves.toMatchObject({
      id: savedLoan.id,
      fineAmount: 0,
      status: LoanStatus.ACTIVE,
    });
    expect(manager.save).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('lanza ConflictException si el item ya tiene un prestamo activo', async () => {
    const blockingLoan = { id: '55555555-5555-4555-8555-555555555555' } as Loan;
    const manager = {
      findOne: jest.fn((entity, options: { where: Record<string, unknown> }) => {
        if (entity === User) {
          return Promise.resolve(member);
        }
        if (entity === Item) {
          return Promise.resolve(item);
        }
        if (entity === Loan && options.where.itemId) {
          return Promise.resolve(blockingLoan);
        }
        return Promise.resolve(null);
      }),
      count: jest.fn().mockResolvedValue(0),
    };

    const service = createService(manager);

    await expect(
      service.create(
        {
          userId: member.id,
          itemId: item.id,
          dueAt: validFutureDueAt(),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lanza ConflictException si el usuario ya tiene 3 prestamos activos', async () => {
    const manager = {
      findOne: jest.fn((entity) => {
        if (entity === User) {
          return Promise.resolve(member);
        }
        return Promise.resolve(null);
      }),
      count: jest.fn().mockResolvedValue(3),
    };

    const service = createService(manager);

    await expect(
      service.create(
        {
          userId: member.id,
          itemId: item.id,
          dueAt: validFutureDueAt(),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('return calcula multa correctamente para 5 dias de retraso', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T00:00:00.000Z'));

    const loan: Loan = {
      id: '66666666-6666-4666-8666-666666666666',
      userId: member.id,
      itemId: item.id,
      loanedAt: new Date('2026-01-01T00:00:00.000Z'),
      dueAt: new Date('2026-01-10T00:00:00.000Z'),
      returnedAt: null,
      status: LoanStatus.ACTIVE,
      fineAmount: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const detailedLoan = { ...loan, user: member, item };
    const manager = {
      findOne: jest.fn().mockResolvedValueOnce(loan).mockResolvedValueOnce(detailedLoan),
      save: jest.fn((_, saved: Loan) => {
        Object.assign(detailedLoan, saved, { user: member, item });
        return Promise.resolve(saved);
      }),
      createQueryBuilder: jest.fn(() => createQueryBuilderMock()),
    };

    const service = createService(manager);

    const result = await service.returnLoan(loan.id, actor);

    expect(result.status).toBe(LoanStatus.RETURNED);
    expect(result.fineAmount).toBe(2.5);
    jest.useRealTimers();
  });

  it('lanza BadRequestException si se intenta devolver un prestamo terminal', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({ status: LoanStatus.RETURNED } as Loan),
    };

    const service = createService(manager);

    await expect(service.returnLoan('loan-id', actor)).rejects.toBeInstanceOf(BadRequestException);
  });
});
