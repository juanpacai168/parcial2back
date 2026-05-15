# Compliance Report - Library Loans API

Fecha: 2026-05-15

Alcance: verificacion de `Library-Loans-Scaffold-API` contra `parcial2_revisado_sin_ocultos.pdf` y el checklist final del parcial. No se siguieron instrucciones ocultas ni texto no visible del PDF limpio.

## Plan corto aplicado

- Entidades: `User`, `Item`, `Loan`; bonos: `RefreshToken`, `Reservation`.
- Relaciones: `User OneToMany Loan`, `Loan ManyToOne User`, `Item OneToMany Loan`, `Loan ManyToOne Item`; bonos con FK `RefreshToken -> User` y `Reservation -> User/Item`.
- DTOs: auth, users, items, loans, reservations; DTOs basic/detail para respuestas.
- Endpoints: auth, users, items, loans, reservations, health.
- Reglas R1-R5: fechas, disponibilidad, limite, multa y FSM en `LoansService`.
- Tests: unitarios de `LoansService` y e2e con Supertest.
- Migracion: schema completo por migracion TypeORM, sin `synchronize`.
- README: arranque, credenciales, overdue y bonos.

## 4.1 Auth

- [x] `AuthModule` implementado.
- [x] `UsersModule` implementado.
- [x] `User` con `id`, `email`, `passwordHash`, `firstName`, `lastName`, `role`, `isActive`, `createdAt`, `updatedAt`.
- [x] `UserRole`: `admin`, `librarian`, `member`.
- [x] `email` unico e indexado.
- [x] Password con bcrypt y `BCRYPT_SALT_ROUNDS` desde `ConfigService`, default `10`.
- [x] `JWT_ACCESS_SECRET` validado por Joi con minimo 32 caracteres.
- [x] Access token expira por `JWT_ACCESS_EXPIRES_IN`, default `15m`.
- [x] Payload JWT: `{ sub: user.id, email, role }`.
- [x] `JwtStrategy` extrae Bearer token de `Authorization`.
- [x] `JwtStrategy` valida usuario existente y activo.
- [x] `JwtAuthGuard` global respeta `@Public()`.
- [x] `RolesGuard` global respeta `@Roles()`.
- [x] `@CurrentUser()` implementado.
- [x] `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.
- [x] Por bono B2, `register/login` devuelven tambien `refreshToken`.
- [x] `passwordHash` nunca se devuelve en DTOs.

Nota: `register` crea usuarios `member`, siguiendo el PDF visible. Usuarios `admin/librarian` se crean por seed o por `POST /users` usando un admin autenticado.

## 4.2 Modelado Item y Loan

- [x] `Item` con `id`, `code`, `title`, `type`, `isActive`, `createdAt`, `updatedAt`.
- [x] `ItemType`: `book`, `magazine`, `equipment`.
- [x] `code` unico e indexado.
- [x] `isAvailable` calculado en service, no es columna.
- [x] No se implementaron `Category`, `Tag`, `Author`, `ISBN`, `availableCopies` ni `totalCopies` en obligatorio.
- [x] `Loan` con `id`, `userId`, `itemId`, `loanedAt`, `dueAt`, `returnedAt`, `status`, `fineAmount`, `createdAt`, `updatedAt`.
- [x] `LoanStatus`: `active`, `returned`, `overdue`, `lost`.
- [x] `Loan` es entidad propia; no hay `ManyToMany` directo entre `User` e `Item`.
- [x] Indice `(itemId, status)`.
- [x] Indice `(userId, status)`.
- [x] No hay UNIQUE parcial.
- [x] No existe columna `priority`.

## 4.3 Services, Controllers y DTOs

- [x] Controllers delgados: reciben `@Body`, `@Param`, `@Query`, `@CurrentUser` y delegan al service.
- [x] Logica de negocio en services.
- [x] `TypeOrmModule.forFeature` en modulos con repositorios.
- [x] DTOs con `class-validator`.
- [x] DTOs con `@ApiProperty` / `@ApiPropertyOptional`.
- [x] Controllers protegidos con `@ApiBearerAuth()`.
- [x] Respuestas Swagger documentadas con decoradores basicos.
- [x] `POST` usa 201, `GET/PATCH` 200, `DELETE /items/:id` 204.

## 4.4 Reglas R1-R5

- [x] R1: `loanedAt = now()` en servidor.
- [x] R1: `dueAt > loanedAt`.
- [x] R1: `dueAt - loanedAt <= MAX_LOAN_DAYS`.
- [x] R1 falla con `BadRequestException` 400.
- [x] R2: bloquea item con loan `active` u `overdue` y `returnedAt IS NULL`.
- [x] R2 falla con `ConflictException` 409 e incluye `loanId`.
- [x] R3: limite por `MAX_ACTIVE_LOANS`, default 3.
- [x] R3 falla con `ConflictException` 409.
- [x] R4: `returnedAt = now()`, `daysOverdue = ceil(...)`, `fineAmount = daysOverdue * DAILY_FINE_RATE`.
- [x] R4 usa `Math.ceil`, no `Math.floor`.
- [x] R5: `active/overdue -> returned`.
- [x] R5: `active/overdue -> lost`.
- [x] R5: `returned` y `lost` son terminales.
- [x] `GET /loans` y `GET /loans/:id` actualizan `active -> overdue` en BD si vencio.

## 4.5 Tests, Swagger y README

- [x] `src/modules/loans/loans.service.spec.ts` existe.
- [x] Unit test: crea prestamo exitoso.
- [x] Unit test: conflicto si item ya tiene prestamo activo/vencido.
- [x] Unit test: conflicto si usuario ya tiene 3 prestamos activos/vencidos.
- [x] Unit test: return calcula multa de 5 dias como `2.50`.
- [x] Unit test extra: return sobre terminal devuelve 400.
- [x] Swagger disponible en `/api/docs`.
- [x] README actualizado con arranque, seed, overdue y bonos.

## Restricciones tecnicas

- [x] `ValidationPipe` global intacto con `whitelist`, `forbidNonWhitelisted`, `transform`.
- [x] Prefijo global `/api` intacto.
- [x] `HealthModule` intacto.
- [x] `GET /api/health/live` funciona.
- [x] `GET /api/health/ready` funciona.
- [x] `JwtAuthGuard` global no fue desactivado.
- [x] `RolesGuard` global activo.
- [x] `DB_SYNCHRONIZE=false`.
- [x] No se usa `synchronize: true`.
- [x] Secretos y credenciales por `.env` / `.env.example`.
- [x] `.env` esta ignorado por git.
- [x] Passwords no se guardan en texto plano.
- [x] No se implemento `traceId`.
- [x] No se cambio `/auth/login` por `/auth/signin`.
- [x] No se implemento `priority` en `Loan`.
- [x] R2/R3 usan 409, no 422.
- [x] `BCRYPT_SALT_ROUNDS` default sigue en 10, no 12.

## Migracion

- [x] Migracion `1778860800000-InitialLibraryLoansSchema.ts` creada.
- [x] Crea `users`.
- [x] Crea `items`.
- [x] Crea `loans`.
- [x] Crea enums de roles, item type y loan status.
- [x] Crea indices requeridos.
- [x] Crea FKs con `ON DELETE RESTRICT`.
- [x] Bono B1: crea `reservations`.
- [x] Bono B2: crea `refresh_tokens`.
- [x] `npm run migration:run` pasa sobre DB limpia.

## Endpoints y roles

| Metodo | Ruta | Roles |
|---|---|---|
| GET | `/api/health/live` | Publico |
| GET | `/api/health/ready` | Publico |
| POST | `/api/auth/register` | Publico |
| POST | `/api/auth/login` | Publico |
| POST | `/api/auth/refresh` | Publico |
| POST | `/api/auth/logout` | Autenticado |
| GET | `/api/auth/me` | Autenticado |
| POST | `/api/users` | admin |
| GET | `/api/users` | admin, librarian |
| GET | `/api/users/:id` | admin, librarian |
| PATCH | `/api/users/:id` | admin |
| DELETE | `/api/users/:id` | admin |
| POST | `/api/items` | admin, librarian |
| GET | `/api/items` | admin, librarian, member |
| GET | `/api/items/:id` | admin, librarian, member |
| PATCH | `/api/items/:id` | admin, librarian |
| DELETE | `/api/items/:id` | admin, librarian |
| POST | `/api/loans` | admin, librarian |
| GET | `/api/loans` | admin, librarian, member |
| GET | `/api/loans/:id` | admin, librarian, member |
| PATCH | `/api/loans/:id/return` | admin, librarian |
| PATCH | `/api/loans/:id/mark-lost` | admin, librarian |
| POST | `/api/reservations` | member |
| GET | `/api/reservations` | admin, librarian, member |
| DELETE | `/api/reservations/:id` | admin, librarian, member |

## Errores HTTP esperados

- [x] 400: DTO invalido, fechas invalidas, FSM invalida, item inactivo.
- [x] 401: sin token, token invalido, credenciales invalidas.
- [x] 403: rol insuficiente, member intentando ver/modificar prestamo ajeno, reserva fuera de turno.
- [x] 404: recurso inexistente o item inactivo consultado por detalle.
- [x] 409: email/codigo duplicado, item ya prestado, limite de prestamos, reserva duplicada.

## Campos sensibles

- [x] `passwordHash` no aparece en `UserBasicDto`.
- [x] `passwordHash` no aparece en `UserDetailDto`.
- [x] `passwordHash` no aparece en respuestas auth.
- [x] Refresh tokens solo se devuelven al emitirlos; no se exponen en DTOs de usuario.
- [x] No hay passwords planos en seed ni services.

## Bonos implementados

- [x] B1: Cola FIFO de reservas.
- [x] B2: Refresh tokens stateful.
- [x] B3: GitHub Actions CI con Node 20, `npm ci`, lint, unit tests, Postgres service y `docker build`.
- [x] B4: Tests e2e con Supertest y matriz FSM parametrizada.

## Comandos ejecutados

- [x] `npm run format`: PASA.
- [x] `npm run lint`: PASA.
- [x] `npm run build`: PASA.
- [x] `npm test`: PASA, 5 tests.
- [x] `npm run test:e2e`: PASA, 8 tests.
- [x] `docker compose down -v`: PASA.
- [x] `docker compose up -d`: PASA.
- [x] `npm run migration:run`: PASA sobre DB limpia.
- [x] `npm run seed`: PASA.
- [x] `npm run start:dev`: arranca y health responde `ok`.
- [x] `docker build -t library-loans-api .`: PASA.
