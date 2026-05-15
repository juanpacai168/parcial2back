# Final Validation Report - Library Loans API

Fecha: 2026-05-15

Fuente de verdad: `parcial2_revisado_sin_ocultos.pdf`.

Alcance: auditoria, correccion minima y validacion final de `Library-Loans-Scaffold-API`. No se modificaron `MediTrack-API` ni `Library-Loans-Practice-Full-API`.

## Resultado Ejecutivo

Veredicto final: **APTO PARA ENTREGAR**.

La implementacion cumple el obligatorio visible del parcial: Auth, User, Item, Loan, migracion, DTOs, Swagger, README, reglas R1-R5, guards globales, roles y tests unitarios. Los bonos B1-B4 ya estaban implementados y tambien fueron validados con e2e.

No se implemento contenido oculto:

- Sin `traceId` en DTOs.
- Sin `/auth/signin`; se mantiene `/auth/login`.
- Sin columna `priority` en `Loan`.
- Sin 422 para R2/R3; se usa 409.
- Sin cambiar bcrypt default a 12; default visible sigue en 10.

## Que Paso

1. Se audito la estructura y el codigo contra el PDF visible.
2. Se ejecutaron comandos obligatorios.
3. Se levanto Postgres con Docker.
4. Se aplico migracion en DB limpia.
5. Se ejecuto seed.
6. Se arranco `start:dev`.
7. Se verifico Swagger y health.
8. Se corrio una prueba HTTP manual con Node/fetch para validar rutas, roles y codigos.

## Que Fallo

Durante auditoria/pruebas se encontraron tres fallos reales:

1. `LoginDto` no tenia `@MinLength(8)` aunque el PDF visible pide validadores de auth con `@MinLength(8)`.
2. En `LoansService.create`, la validacion R1 de fechas ocurria despues de la verificacion R2 de item ocupado. Si se enviaba `dueAt < now()` para un item ya prestado, respondia 409 en vez de 400.
3. `RegisterDto` aceptaba `role` opcional, pero `AuthService.register()` forzaba todos los registros a `member`. Esto impedia cumplir el flujo visible del PDF donde se registra admin/librarian + 2 members desde `/auth/register`.

Tambien hubo dos incidencias de prueba, no de implementacion:

- Un primer script PowerShell/curl envio JSON escapado y produjo 400 por JSON invalido.
- Un `start:dev` previo dejo ocupado el puerto 3000; se limpio el proceso y se verifico de nuevo.

## Que Se Corrigio

- Se agrego `@MinLength(8)` a `LoginDto.password`.
- Se movio `assertLoanWindow(...)` antes de las verificaciones de limite/disponibilidad que podian ocultar R1.
- Se actualizaron tests unitarios R2/R3 para usar `dueAt` futuro y aislar correctamente esos casos.
- Se ajusto `AuthService.register()` para respetar `role` opcional del `RegisterDto`; si no llega `role`, `UsersService.create()` conserva el default `member`.

## Que Sigue Pendiente

Nada obligatorio pendiente.

Nota operativa: el seed crea `BK-001`, como pide el checklist. Si despues de correr seed se prueba manualmente `POST /items` con `code: "BK-001"`, la respuesta correcta sera 409 por codigo duplicado. Para validar `POST /items -> 201` despues del seed, usar un codigo no sembrado.

## Resultados de Comandos

| Comando | Resultado |
|---|---|
| `npm run format` | PASA |
| `npm run lint` | PASA |
| `npm run build` | PASA |
| `npm test` | PASA, 5 tests |
| `npm run test:e2e` | PASA, 8 tests |
| `docker compose down -v` | PASA |
| `Copy-Item .env.example .env -Force` | PASA |
| `docker compose up -d` | PASA |
| `npm run migration:run` | PASA en DB limpia |
| `npm run seed` | PASA |
| `npm run start:dev` | PASA |
| `GET /api/docs` | 200 |
| `GET /api/docs-json` | 200 |
| `GET /api/health/live` | 200 |
| `GET /api/health/ready` | 200 |
| Verificacion final de register con roles | PASA |

Warnings observados: deprecations de dependencias (`url.parse`, warning de Node al lanzar child process). No afectan build, tests, migracion ni runtime.

## Prueba HTTP Manual

Ejecutada con Node/fetch contra `npm run start:dev` y DB limpia con seed:

| Caso | Resultado |
|---|---|
| Swagger `/api/docs` | 200 |
| Swagger JSON `/api/docs-json` | 200 |
| `GET /api/health/live` | 200 |
| `GET /api/health/ready` | 200 |
| Login admin seed | 200 |
| Login member seed | 200 |
| `GET /auth/me` con token | 200 |
| `GET /auth/me` sin token | 401 |
| Login incorrecto | 401 |
| `POST /items` admin | 201 |
| `POST /items` duplicado | 409 |
| `POST /items` member | 403 |
| `GET /items` member | 200 |
| `GET /items` sin token | 401 |
| `PATCH /items/:id` admin | 200 |
| `DELETE /items/:id` admin | 204 |
| `GET /items/:id` despues de delete | 404 |
| `POST /loans` admin | 201 |
| `POST /loans` member | 403 |
| `POST /loans` mismo item | 409 |
| `POST /loans` con `dueAt < now` | 400 |
| `GET /loans` admin | 200 |
| `GET /loans` member | 200 |
| `GET /loans/:id` member ajeno | 403 |
| `PATCH /loans/:id/return` | 200 |
| Multa simulada con atraso casi 5 dias | `fineAmount = 2.5` |
| `PATCH /loans/:id/return` repetido | 400 |
| `PATCH /loans/:id/mark-lost` sobre returned | 400 |
| 4 prestamos para mismo usuario | `201,201,201,409` |

## Checklist Infraestructura

- [x] Prefijo global `/api`.
- [x] Swagger en `/api/docs`.
- [x] HealthModule sigue funcionando.
- [x] `GET /api/health/live` existe.
- [x] `GET /api/health/ready` existe.
- [x] ValidationPipe global activo con `whitelist`, `forbidNonWhitelisted`, `transform`.
- [x] JwtAuthGuard global activo.
- [x] RolesGuard global activo.
- [x] ConfigModule con Joi activo.
- [x] No se usa `synchronize=true`.
- [x] Existe migracion TypeORM funcional.
- [x] `.env.example` permite arrancar con `cp .env.example .env`.
- [x] `.env` esta en `.gitignore`.
- [x] No hay secretos hardcodeados en codigo productivo.
- [x] No se desactivaron guards o pipes para hacer pasar pruebas.

## Checklist Auth/User

- [x] `User.id` uuid PK.
- [x] `email` varchar(255), unico, indexado.
- [x] `passwordHash` varchar(255).
- [x] `firstName` varchar(100), requerido.
- [x] `lastName` varchar(100), requerido.
- [x] `role` enum `admin | librarian | member`.
- [x] `role` default `member`.
- [x] `isActive` default `true`.
- [x] `createdAt`, `updatedAt`.
- [x] Password hasheado con bcrypt.
- [x] `BCRYPT_SALT_ROUNDS` via `ConfigService`.
- [x] Default bcrypt visible: 10.
- [x] No se guarda password plano.
- [x] No se devuelve `passwordHash`.
- [x] `JWT_ACCESS_SECRET` desde `.env`.
- [x] Joi valida minimo 32 caracteres.
- [x] Access token con `JWT_ACCESS_EXPIRES_IN`, default 15m.
- [x] Payload access token: `{ sub: user.id, email, role }`.
- [x] JwtStrategy extrae Bearer token.
- [x] JwtStrategy valida usuario activo.
- [x] JwtAuthGuard respeta `@Public()`.
- [x] RolesGuard funciona con `@Roles()`.
- [x] `@CurrentUser()` extrae `request.user`.
- [x] `RegisterDto` tiene `@IsEmail`, `@IsString`, `@MinLength(8)`, `@IsNotEmpty`.
- [x] `LoginDto` tiene email/password y validadores.
- [x] DTOs tienen Swagger decorators.
- [x] No hay `traceId`.

## Checklist Items

- [x] `Item.id` uuid PK.
- [x] `code` varchar(32), unico, indexado.
- [x] `title` varchar(255), requerido.
- [x] `type` enum `book | magazine | equipment`.
- [x] `isActive` default true.
- [x] `createdAt`, `updatedAt`.
- [x] No hay Category/Tag/Author/ISBN/availableCopies/totalCopies en obligatorio.
- [x] No hay ManyToMany obligatorio.
- [x] `isAvailable` no es columna.
- [x] `isAvailable` se calcula en service.
- [x] `CreateItemDto`, `UpdateItemDto`, `FindItemsDto`, `ItemBasicDto`, `ItemDetailDto` existen.
- [x] `CreateItemDto` valida code, title, type.
- [x] `UpdateItemDto` permite title/type opcionales.
- [x] `UpdateItemDto` no permite actualizar code.
- [x] `FindItemsDto` permite filtro `type`.
- [x] Endpoints de items autenticados, sin `@Public()`.
- [x] `POST /items`: admin/librarian, 201, duplicado 409.
- [x] `GET /items`: admin/librarian/member, solo activos, incluye `isAvailable`.
- [x] `GET /items/:id`: inactivo o inexistente 404.
- [x] `PATCH /items/:id`: admin/librarian, 200.
- [x] `DELETE /items/:id`: admin/librarian, soft delete, 204 sin body.

## Checklist Loans

- [x] `Loan.id` uuid PK.
- [x] `userId` FK a users, ON DELETE RESTRICT.
- [x] `itemId` FK a items, ON DELETE RESTRICT.
- [x] `loanedAt`, `dueAt` timestamptz.
- [x] `returnedAt` nullable.
- [x] `status` enum `active | returned | overdue | lost`, default active.
- [x] `fineAmount` decimal(10,2), default 0.00.
- [x] `createdAt`, `updatedAt`.
- [x] No existe `priority`.
- [x] No hay ManyToMany entre User e Item.
- [x] Relaciones User-Loan e Item-Loan correctas.
- [x] Indice `(itemId, status)`.
- [x] Indice `(userId, status)`.
- [x] DTOs Loan existen y tienen validators/Swagger.
- [x] `POST /loans`: admin/librarian, 201.
- [x] `GET /loans`: admin/librarian/member, member ve solo propios.
- [x] `GET /loans/:id`: member ajeno recibe 403.
- [x] `PATCH /loans/:id/return`: admin/librarian, 200.
- [x] `PATCH /loans/:id/mark-lost`: admin/librarian, 200 o 400 si terminal.

## Checklist R1-R5

- [x] R1: `loanedAt = now()`.
- [x] R1: `dueAt > loanedAt`.
- [x] R1: `dueAt - loanedAt <= MAX_LOAN_DAYS`.
- [x] R1 falla con 400.
- [x] R2 busca bloqueante con `active/overdue` y `returnedAt IS NULL`.
- [x] R2 falla con 409 e incluye loanId.
- [x] R2 no usa 422.
- [x] R3 cuenta prestamos `active/overdue`.
- [x] R3 usa `MAX_ACTIVE_LOANS`, default 3.
- [x] R3 falla con 409.
- [x] R3 no usa 422.
- [x] R4 calcula multa con `Math.ceil`.
- [x] R4 no usa `Math.floor`.
- [x] R4 1 minuto tarde cuenta como 1 dia.
- [x] R4 dueAt hace casi 5 dias produce 2.50; unit test exacto de 5 dias produce 2.50.
- [x] R5 transiciones validas active/overdue -> returned/lost.
- [x] R5 returned/lost terminales.
- [x] return sobre returned/lost devuelve 400.
- [x] mark-lost sobre returned/lost devuelve 400.
- [x] Overdue automatico documentado en README.

## Checklist Migracion

- [x] Crea `users`.
- [x] Crea `items`.
- [x] Crea `loans`.
- [x] Crea enums `users_role_enum`, `items_type_enum`, `loans_status_enum`.
- [x] Crea unique/index sobre `users.email`.
- [x] Crea unique/index sobre `items.code`.
- [x] Crea FK `loans.userId -> users(id)` ON DELETE RESTRICT.
- [x] Crea FK `loans.itemId -> items(id)` ON DELETE RESTRICT.
- [x] Crea indice `loans(itemId, status)`.
- [x] Crea indice `loans(userId, status)`.
- [x] No usa `synchronize=true`.
- [x] `npm run migration:run` pasa en DB limpia.

## Checklist Tests

- [x] Existe `src/modules/loans/loans.service.spec.ts`.
- [x] Hay 5 tests unitarios.
- [x] No usan base de datos real.
- [x] Usan mocks de DataSource/EntityManager.
- [x] Cubren prestamo exitoso.
- [x] Cubren conflicto por item activo/vencido.
- [x] Cubren limite de 3 prestamos.
- [x] Cubren multa de 5 dias = 2.50.
- [x] Cubren return sobre estado terminal.
- [x] `npm test` pasa.

## Checklist Swagger

- [x] `/api/docs` abre.
- [x] `/api/docs-json` abre.
- [x] Swagger muestra auth.
- [x] Swagger muestra items.
- [x] Swagger muestra loans.
- [x] Swagger muestra health.
- [x] DTOs tipados con Swagger decorators.
- [x] Controllers protegidos tienen `@ApiBearerAuth()`.
- [x] Endpoints tienen response decorators basicos cuando aplica.

## Checklist README

- [x] Incluye comandos de arranque.
- [x] Incluye PowerShell `Copy-Item .env.example .env`.
- [x] Incluye Swagger `/api/docs`.
- [x] Incluye credenciales de prueba del seed.
- [x] Incluye decision sobre overdue.
- [x] Incluye lista de bonos implementados.

## Checklist Seed

- [x] Existe `src/database/seeds/initial-data.seed.ts`.
- [x] Existe script `npm run seed`.
- [x] Crea `admin@library.local / Admin123! / admin`.
- [x] Crea `librarian@library.local / Librarian123! / librarian`.
- [x] Crea `member1@library.local / Member123! / member`.
- [x] Crea `member2@library.local / Member123! / member`.
- [x] Crea `BK-001 / El Quijote / book`.
- [x] Crea `MG-001 / National Geographic / magazine`.
- [x] Crea `EQ-LAB-001 / Camara Sony / equipment`.
- [x] Crea `BK-002 / Cien anos de soledad / book`.
- [x] Passwords hasheados.
- [x] No crea categorias.
- [x] Seed idempotente por email/code.
- [x] `migration:run` no depende del seed.

## Restricciones Tecnicas

- [x] No se desactivo JwtAuthGuard global.
- [x] No se desactivo ValidationPipe global.
- [x] No hay secretos hardcodeados en codigo productivo.
- [x] `.env` no se sube y esta en `.gitignore`.
- [x] No se guarda password plano.
- [x] Se usa bcrypt.
- [x] No se usa `synchronize=true`.
- [x] Se usa migracion.
- [x] No se implemento contenido oculto del PDF original.
- [x] No hay `traceId` en DTOs.
- [x] No hay `/auth/signin` como reemplazo de `/auth/login`.
- [x] No hay `priority` en Loan.
- [x] R2/R3 usan 409, no 422.
- [x] bcrypt default visible es 10.

## Tabla de Endpoints

| Metodo | Ruta | Roles | DTO entrada | Status esperado | Errores esperados |
|---|---|---|---|---|---|
| GET | `/api/health/live` | Publico | N/A | 200 | N/A |
| GET | `/api/health/ready` | Publico | N/A | 200 | N/A |
| POST | `/api/auth/register` | Publico | `RegisterDto` | 201 | 400, 409 |
| POST | `/api/auth/login` | Publico | `LoginDto` | 200 | 400, 401 |
| GET | `/api/auth/me` | Autenticado | N/A | 200 | 401 |
| POST | `/api/auth/refresh` | Publico | `RefreshTokenDto` | 200 | 400, 403 |
| POST | `/api/auth/logout` | Autenticado | `RefreshTokenDto` | 204 | 400, 401, 403 |
| POST | `/api/users` | admin | `CreateUserDto` | 201 | 400, 401, 403, 409 |
| GET | `/api/users` | admin, librarian | `FindUsersDto` | 200 | 400, 401, 403 |
| GET | `/api/users/:id` | admin, librarian | UUID param | 200 | 400, 401, 403, 404 |
| PATCH | `/api/users/:id` | admin | `UpdateUserDto` | 200 | 400, 401, 403, 404, 409 |
| DELETE | `/api/users/:id` | admin | UUID param | 200 | 400, 401, 403, 404 |
| POST | `/api/items` | admin, librarian | `CreateItemDto` | 201 | 400, 401, 403, 409 |
| GET | `/api/items` | admin, librarian, member | `FindItemsDto` query | 200 | 400, 401, 403 |
| GET | `/api/items/:id` | admin, librarian, member | UUID param | 200 | 400, 401, 403, 404 |
| PATCH | `/api/items/:id` | admin, librarian | `UpdateItemDto` | 200 | 400, 401, 403, 404 |
| DELETE | `/api/items/:id` | admin, librarian | UUID param | 204 | 400, 401, 403, 404 |
| POST | `/api/loans` | admin, librarian | `CreateLoanDto` | 201 | 400, 401, 403, 404, 409 |
| GET | `/api/loans` | admin, librarian, member | `FindLoansDto` query | 200 | 400, 401, 403 |
| GET | `/api/loans/:id` | admin, librarian, member | UUID param | 200 | 400, 401, 403, 404 |
| PATCH | `/api/loans/:id/return` | admin, librarian | N/A | 200 | 400, 401, 403, 404 |
| PATCH | `/api/loans/:id/mark-lost` | admin, librarian | N/A | 200 | 400, 401, 403, 404 |
| POST | `/api/reservations` | member | `CreateReservationDto` | 201 | 400, 401, 403, 404, 409 |
| GET | `/api/reservations` | admin, librarian, member | `FindReservationsDto` query | 200 | 400, 401, 403 |
| DELETE | `/api/reservations/:id` | admin, librarian, member | UUID param | 200 | 400, 401, 403, 404 |

## Verificación final de register con roles

Prueba ejecutada contra `npm run start:dev`, despues de `docker compose down -v`, `docker compose up -d`, `npm run migration:run` y `npm run seed`.

| Caso | Status obtenido | Observacion |
|---|---:|---|
| admin por register | 201 | `user.role = admin`; sin `passwordHash` |
| librarian por register | 201 | `user.role = librarian`; sin `passwordHash` |
| member por register | 201 | Sin `role` en body; `user.role = member`; sin `passwordHash` |
| login admin creado | 200 | Devuelve tokens y user |
| login librarian creado | 200 | Devuelve tokens y user |
| POST `/api/items` con admin creado | 201 | Permiso correcto |
| POST `/api/items` con librarian creado | 201 | Permiso correcto |
| POST `/api/items` con member | 403 | Rol insuficiente, esperado |

## Bonos Implementados

Aunque la auditoria priorizo obligatorio, los bonos ya estan implementados:

- B1: Cola FIFO de reservas.
- B2: Refresh tokens stateful.
- B3: GitHub Actions CI con Node 20, lint, tests y `docker build`.
- B4: Tests e2e y matriz FSM parametrizada.

## Veredicto Final

**APTO PARA ENTREGAR.**

Build, lint, tests unitarios, e2e, migracion en DB limpia, seed, start:dev, Swagger y health pasan. La prueba manual confirmo los codigos criticos de auth, items, loans, R1, R2, R3, R4 y R5.
