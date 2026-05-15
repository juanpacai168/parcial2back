import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { Item, ItemType } from '../../modules/items/entities/item.entity';
import { User, UserRole } from '../../modules/users/entities/user.entity';

const PASSWORDS = {
  admin: 'Admin123!',
  librarian: 'Librarian123!',
  member: 'Member123!',
};

async function ensureUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}): Promise<User> {
  const repo = AppDataSource.getRepository(User);
  const existing = await repo.findOne({ where: { email: data.email } });
  if (existing) {
    return existing;
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  return repo.save(
    repo.create({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      isActive: true,
    }),
  );
}

async function ensureItem(data: { code: string; title: string; type: ItemType }): Promise<Item> {
  const repo = AppDataSource.getRepository(Item);
  const existing = await repo.findOne({ where: { code: data.code } });
  if (existing) {
    return existing;
  }

  return repo.save(repo.create({ ...data, isActive: true }));
}

async function run(): Promise<void> {
  await AppDataSource.initialize();
  // eslint-disable-next-line no-console
  console.log('Seeding Library Loans initial data...');

  await ensureUser({
    email: 'admin@library.local',
    password: PASSWORDS.admin,
    firstName: 'Ada',
    lastName: 'Admin',
    role: UserRole.ADMIN,
  });
  await ensureUser({
    email: 'librarian@library.local',
    password: PASSWORDS.librarian,
    firstName: 'Libby',
    lastName: 'Librarian',
    role: UserRole.LIBRARIAN,
  });
  await ensureUser({
    email: 'member1@library.local',
    password: PASSWORDS.member,
    firstName: 'Marta',
    lastName: 'Member',
    role: UserRole.MEMBER,
  });
  await ensureUser({
    email: 'member2@library.local',
    password: PASSWORDS.member,
    firstName: 'Mario',
    lastName: 'Member',
    role: UserRole.MEMBER,
  });

  await ensureItem({ code: 'BK-001', title: 'El Quijote', type: ItemType.BOOK });
  await ensureItem({ code: 'MG-001', title: 'National Geographic', type: ItemType.MAGAZINE });
  await ensureItem({ code: 'EQ-LAB-001', title: 'Camara Sony', type: ItemType.EQUIPMENT });
  await ensureItem({ code: 'BK-002', title: 'Cien anos de soledad', type: ItemType.BOOK });

  // eslint-disable-next-line no-console
  console.log(
    'Seed complete. Users: admin@library.local, librarian@library.local, member1@library.local, member2@library.local',
  );
  await AppDataSource.destroy();
}

run().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed', err);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
