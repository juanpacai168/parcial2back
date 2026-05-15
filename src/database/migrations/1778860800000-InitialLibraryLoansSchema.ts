import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialLibraryLoansSchema1778860800000 implements MigrationInterface {
  name = 'InitialLibraryLoansSchema1778860800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE "users_role_enum" AS ENUM ('admin', 'librarian', 'member')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL UNIQUE,
        "passwordHash" varchar(255) NOT NULL,
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'member',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "token" text NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "revokedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_refresh_tokens_token" ON "refresh_tokens" ("token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user" ON "refresh_tokens" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TYPE "items_type_enum" AS ENUM ('book', 'magazine', 'equipment')
    `);

    await queryRunner.query(`
      CREATE TABLE "items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(32) NOT NULL UNIQUE,
        "title" varchar(255) NOT NULL,
        "type" "items_type_enum" NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_items_code" ON "items" ("code")`);

    await queryRunner.query(`
      CREATE TYPE "loans_status_enum" AS ENUM ('active', 'returned', 'overdue', 'lost')
    `);

    await queryRunner.query(`
      CREATE TABLE "loans" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "itemId" uuid NOT NULL,
        "loanedAt" timestamptz NOT NULL,
        "dueAt" timestamptz NOT NULL,
        "returnedAt" timestamptz NULL,
        "status" "loans_status_enum" NOT NULL DEFAULT 'active',
        "fineAmount" decimal(10,2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_loans_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_loans_item" FOREIGN KEY ("itemId")
          REFERENCES "items"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_loans_due_after_loaned" CHECK ("dueAt" > "loanedAt")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_loans_item_status" ON "loans" ("itemId", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_loans_user_status" ON "loans" ("userId", "status")`);

    await queryRunner.query(`
      CREATE TABLE "reservations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "itemId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "fulfilledAt" timestamptz NULL,
        "cancelledAt" timestamptz NULL,
        "expiresAt" timestamptz NULL,
        CONSTRAINT "FK_reservations_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_reservations_item" FOREIGN KEY ("itemId")
          REFERENCES "items"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_item_queue" ON "reservations" ("itemId", "cancelledAt", "fulfilledAt", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_user_item" ON "reservations" ("userId", "itemId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reservations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "loans"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "loans_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "items"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "items_type_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }
}
