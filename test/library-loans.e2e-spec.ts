import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Item, ItemType } from '../src/modules/items/entities/item.entity';
import { Loan, LoanStatus } from '../src/modules/loans/entities/loan.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';

interface AuthBody {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

describe('Library Loans API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersRepo: Repository<User>;
  let itemsRepo: Repository<Item>;
  let loansRepo: Repository<Loan>;
  let adminToken: string;
  let fsmMember: User;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
    process.env.DB_PORT = process.env.DB_PORT ?? '5432';
    process.env.DB_USER = process.env.DB_USER ?? 'loans';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'loans';
    process.env.DB_NAME = process.env.DB_NAME ?? 'loans';
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-must-be-at-least-32-chars';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-must-be-at-least-32-chars';
    process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS ?? '10';
    process.env.MAX_ACTIVE_LOANS = process.env.MAX_ACTIVE_LOANS ?? '3';
    process.env.DAILY_FINE_RATE = process.env.DAILY_FINE_RATE ?? '0.50';
    process.env.MAX_LOAN_DAYS = process.env.MAX_LOAN_DAYS ?? '30';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.dropDatabase();
    await dataSource.runMigrations();

    usersRepo = dataSource.getRepository(User);
    itemsRepo = dataSource.getRepository(Item);
    loansRepo = dataSource.getRepository(Loan);

    await usersRepo.save(
      usersRepo.create({
        email: 'admin.e2e@library.local',
        passwordHash: await bcrypt.hash('Admin123!', 10),
        firstName: 'Admin',
        lastName: 'E2E',
        role: UserRole.ADMIN,
        isActive: true,
      }),
    );

    fsmMember = await usersRepo.save(
      usersRepo.create({
        email: 'fsm.member@library.local',
        passwordHash: await bcrypt.hash('Member123!', 10),
        firstName: 'FSM',
        lastName: 'Member',
        role: UserRole.MEMBER,
        isActive: true,
      }),
    );

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin.e2e@library.local', password: 'Admin123!' })
      .expect(200);
    adminToken = (login.body as AuthBody).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('cubre register -> login -> POST /items -> POST /loans -> PATCH return', async () => {
    const suffix = Date.now();
    const email = `member.${suffix}@library.local`;

    const register = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'Member123!',
        firstName: 'Member',
        lastName: 'Flow',
      })
      .expect(201);
    expect((register.body as AuthBody).refreshToken).toBeDefined();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Member123!' })
      .expect(200);
    const memberAuth = login.body as AuthBody;
    expect(memberAuth.refreshToken).toBeDefined();

    const itemResponse = await request(app.getHttpServer())
      .post('/api/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `BK-E2E-${suffix}`, title: 'El Quijote', type: ItemType.BOOK })
      .expect(201);

    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const loanResponse = await request(app.getHttpServer())
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberAuth.user.id,
        itemId: itemResponse.body.id,
        dueAt,
      })
      .expect(201);

    const returnResponse = await request(app.getHttpServer())
      .patch(`/api/loans/${loanResponse.body.id}/return`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(returnResponse.body.status).toBe(LoanStatus.RETURNED);
    expect(returnResponse.body.fineAmount).toBeDefined();
  });

  it('cubre cola FIFO de reservas del bono B1', async () => {
    const suffix = Date.now();
    const member1 = await registerMember(`fifo.member1.${suffix}@library.local`);
    const member2 = await registerMember(`fifo.member2.${suffix}@library.local`);
    const member3 = await registerMember(`fifo.member3.${suffix}@library.local`);

    const itemResponse = await request(app.getHttpServer())
      .post('/api/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `FIFO-${suffix}`.slice(0, 32), title: 'FIFO item', type: ItemType.BOOK })
      .expect(201);

    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const loanResponse = await request(app.getHttpServer())
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: member1.user.id,
        itemId: itemResponse.body.id,
        dueAt,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${member2.accessToken}`)
      .send({ itemId: itemResponse.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${member3.accessToken}`)
      .send({ itemId: itemResponse.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/loans/${loanResponse.body.id}/return`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: member3.user.id,
        itemId: itemResponse.body.id,
        dueAt,
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: member2.user.id,
        itemId: itemResponse.body.id,
        dueAt,
      })
      .expect(201);
  });

  it('cubre refresh token stateful y logout del bono B2', async () => {
    const auth = await registerMember(`refresh.member.${Date.now()}@library.local`);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: auth.refreshToken })
      .expect(200)
      .expect((response) => {
        expect(response.body.accessToken).toBeDefined();
      });

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ refreshToken: auth.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: auth.refreshToken })
      .expect(403);
  });

  describe('matriz FSM de Loan por HTTP', () => {
    it.each([
      {
        from: LoanStatus.ACTIVE,
        endpoint: 'return',
        expected: LoanStatus.RETURNED,
      },
      {
        from: LoanStatus.ACTIVE,
        endpoint: 'mark-lost',
        expected: LoanStatus.LOST,
      },
    ])('permite $from -> $expected', async ({ from, endpoint, expected }) => {
      const loan = await createLoanFixture(from);
      const response = await request(app.getHttpServer())
        .patch(`/api/loans/${loan.id}/${endpoint}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe(expected);
    });

    it.each([
      { from: LoanStatus.RETURNED, endpoint: 'return' },
      { from: LoanStatus.LOST, endpoint: 'return' },
      { from: LoanStatus.RETURNED, endpoint: 'mark-lost' },
    ])('rechaza transicion terminal $from via $endpoint', async ({ from, endpoint }) => {
      const loan = await createLoanFixture(from);
      await request(app.getHttpServer())
        .patch(`/api/loans/${loan.id}/${endpoint}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  async function createLoanFixture(status: LoanStatus): Promise<Loan> {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 100000)}`;
    const item = await itemsRepo.save(
      itemsRepo.create({
        code: `FSM-${suffix}`.slice(0, 32),
        title: `FSM item ${suffix}`,
        type: ItemType.BOOK,
        isActive: true,
      }),
    );
    const loanedAt = new Date(Date.now() - 60 * 60 * 1000);
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return loansRepo.save(
      loansRepo.create({
        userId: fsmMember.id,
        itemId: item.id,
        loanedAt,
        dueAt,
        returnedAt: status === LoanStatus.RETURNED ? new Date() : null,
        status,
        fineAmount: 0,
      }),
    );
  }

  async function registerMember(email: string): Promise<AuthBody> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'Member123!',
        firstName: 'FIFO',
        lastName: 'Member',
      })
      .expect(201);
    return response.body as AuthBody;
  }
});
