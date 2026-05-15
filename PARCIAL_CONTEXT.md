# Contexto rapido del parcial - Library Loans API

Este archivo resume el estado real del scaffold oficial y los patrones que conviene seguir manana cuando llegue el enunciado. No implementa entidades nuevas todavia.

## Que trae listo el scaffold

- NestJS 10 inicializado.
- `ConfigModule` global con validacion Joi en el arranque.
- `TypeOrmModule.forRootAsync` conectado a Postgres mediante `ConfigService`.
- Docker Compose con Postgres `16-alpine`.
- `ValidationPipe` global en `src/main.ts` con:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`
  - `enableImplicitConversion: true`
- Prefijo global `/api`.
- Swagger UI en `/api/docs` con Bearer Auth configurado.
- `HealthModule` con:
  - `GET /api/health/live`
  - `GET /api/health/ready`
- Decorador `@Public()` en `src/common/decorators/public.decorator.ts`.
- TypeORM CLI configurado en `src/database/data-source.ts`.
- Carpeta `src/database/migrations` lista para migraciones.
- Aliases de path en `tsconfig.json`:
  - `@modules/*`
  - `@common/*`
  - `@config/*`
  - `@database/*`
- `synchronize` controlado por env y documentado para dejarlo en `false`.

## Que NO trae y se debe implementar

- `AuthModule`.
- `UsersModule`.
- Entidad `User`.
- `register`.
- `login`.
- JWT access token.
- Refresh token si el enunciado o el patron lo exige.
- `JwtStrategy`.
- `JwtAuthGuard`.
- `RolesGuard`.
- Decoradores `@Roles()` y `@CurrentUser()`.
- Entidades de dominio, especialmente `Item` y `Loan` si el enunciado confirma ese dominio.
- DTOs de entrada y salida.
- Migraciones explicitas.
- Seeds.
- Tests unitarios y e2e.

## Comandos exactos

Instalar dependencias:

```bash
npm install
```

Crear `.env` desde la plantilla:

```bash
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Levantar Docker/Postgres:

```bash
docker compose up -d
```

Ver estado de contenedores:

```bash
docker compose ps
```

Bajar Docker/Postgres:

```bash
docker compose down
```

Correr el proyecto en desarrollo:

```bash
npm run start:dev
```

Correr el proyecto compilado:

```bash
npm run build
npm run start:prod
```

Compilar:

```bash
npm run build
```

Generar migracion despues de crear/modificar entidades:

```bash
npm run migration:generate -- src/database/migrations/NombreDeLaMigracion
```

Correr migraciones:

```bash
npm run migration:run
```

Revertir la ultima migracion:

```bash
npm run migration:revert
```

Correr tests unitarios:

```bash
npm test
```

Correr tests con coverage:

```bash
npm run test:cov
```

Correr tests e2e:

```bash
npm run test:e2e
```

Swagger:

```text
http://localhost:3000/api/docs
```

Health:

```text
http://localhost:3000/api/health/live
http://localhost:3000/api/health/ready
```

## Variables de entorno requeridas

Variables de app:

- `NODE_ENV`: `development`, `test` o `production`. Default: `development`.
- `PORT`: puerto HTTP. Default: `3000`.
- `API_PREFIX`: prefijo global. Default: `api`.
- `SWAGGER_ENABLED`: habilita Swagger. Default: `true`.

Variables de base de datos:

- `DB_HOST`: requerido.
- `DB_PORT`: requerido.
- `DB_USER`: requerido.
- `DB_PASSWORD`: requerido.
- `DB_NAME`: requerido.
- `DB_SYNCHRONIZE`: default `false`. En el parcial debe quedarse en `false`.
- `DB_LOGGING`: default `false`.

Variables de JWT:

- `JWT_ACCESS_SECRET`: requerido, minimo 32 caracteres.
- `JWT_ACCESS_EXPIRES_IN`: default `15m`.
- `JWT_REFRESH_SECRET`: requerido, minimo 32 caracteres.
- `JWT_REFRESH_EXPIRES_IN`: default `7d`.

Variables de bcrypt:

- `BCRYPT_SALT_ROUNDS`: entre 4 y 15. Default `10`.

Variables de negocio para prestamos:

- `MAX_ACTIVE_LOANS`: default `3`.
- `DAILY_FINE_RATE`: default `0.50`.
- `MAX_LOAN_DAYS`: default `30`.

## JWT_ACCESS_SECRET y JWT_REFRESH_SECRET

`JWT_ACCESS_SECRET` firma los access tokens que llegan en `Authorization: Bearer <token>`. Debe ser largo, privado y distinto del refresh secret.

`JWT_REFRESH_SECRET` firma refresh tokens. Debe ser tambien privado, minimo 32 caracteres y diferente del access secret. Si se implementa refresh token persistido, guardar el token o su hash en una tabla como `refresh_tokens`, con `expiresAt` y `revokedAt`.

Nunca exponer estos valores en responses, Swagger examples reales, logs ni seeds publicos.

## BCRYPT_SALT_ROUNDS

`BCRYPT_SALT_ROUNDS` controla el costo de hashing de passwords. El scaffold valida 4 a 15 y deja default 10.

Usarlo desde `ConfigService`:

```typescript
const saltRounds = this.configService.get<number>('bcrypt.saltRounds', 10);
const passwordHash = await bcrypt.hash(dto.password, saltRounds);
```

Nunca guardar passwords en texto plano. La entidad debe guardar `passwordHash` y no debe exponerlo.

## Variables de negocio de prestamos

`MAX_ACTIVE_LOANS` limita cuantos prestamos activos puede tener un usuario si el enunciado lo pide.

`MAX_LOAN_DAYS` sirve para calcular o validar la fecha maxima de devolucion. Por ejemplo, `dueDate` no deberia exceder `loanDate + MAX_LOAN_DAYS`.

`DAILY_FINE_RATE` sirve para calcular multa por dias de retraso. Si `returnedAt` o la fecha actual supera `dueDate`, la multa puede ser `diasRetraso * DAILY_FINE_RATE`.

Estas reglas deben vivir en services, no en controllers.

## Estructura recomendada para nuevos modulos

Para cada recurso:

```text
src/modules/<resource>/
  <resource>.module.ts
  <resource>.controller.ts
  <resource>.service.ts
  dto/
    create-<resource>.dto.ts
    update-<resource>.dto.ts
    find-<resource>.dto.ts
    <resource>-basic.dto.ts
    <resource>-detail.dto.ts
  entities/
    <resource>.entity.ts
  enums/
    <resource-status.enum.ts>    # solo si aplica
```

Patron esperado:

- El modulo importa `TypeOrmModule.forFeature([Entity])`.
- Si necesita repositorios de otras entidades, incluirlas en `forFeature` o importar el modulo que exporta el service.
- El controller solo recibe `@Body`, `@Param`, `@Query` y `@CurrentUser`.
- El controller llama al service.
- El service valida existencia, reglas de negocio, permisos, duplicados y relaciones.
- Usar DTOs con `class-validator` y decoradores Swagger.
- Usar `ParseUUIDPipe` en parametros UUID.
- Usar `ConfigService` para variables de entorno.

## Patrones utiles observados en MediTrack

- `AuthModule` importa `UsersModule`, `PassportModule`, `JwtModule.register({})` y `TypeOrmModule.forFeature([RefreshToken])`.
- `AppModule` registra guards globales con `APP_GUARD`: primero `JwtAuthGuard`, luego `RolesGuard`.
- `JwtAuthGuard` revisa metadata de `@Public()` y si no es publico delega a `AuthGuard('jwt')`.
- `RolesGuard` lee metadata de `@Roles()` y valida `request.user.role`.
- `@CurrentUser()` extrae `request.user`.
- `JwtStrategy` lee Bearer token con `ExtractJwt.fromAuthHeaderAsBearerToken()`.
- `JwtRefreshStrategy` puede leer refresh token desde body con `ExtractJwt.fromBodyField('refreshToken')`.
- `UsersService.create` valida email duplicado, hashea password con bcrypt y usa `ConfigService`.
- Los services lanzan `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException` y `ConflictException`.
- Las migraciones son explicitas y crean enums, tablas, indices y foreign keys.
- El seed es idempotente para usuarios base y limpia/recrea datos que pueden duplicarse.

## Checklist de implementacion rapida

- Leer el enunciado completo antes de escribir codigo.
- Extraer entidades, atributos, relaciones, reglas, roles y endpoints.
- Definir enums necesarios.
- Crear entidades TypeORM.
- Crear modulos, controllers, services y DTOs.
- Implementar Auth si el enunciado lo pide.
- Agregar guards globales si hay endpoints protegidos.
- Marcar login, register y health con `@Public()`.
- Crear migracion.
- Revisar SQL generado.
- Correr migraciones.
- Crear seed.
- Correr build.
- Probar endpoints principales en Swagger/Postman.
- Correr tests.

## Checklist de seguridad JWT y roles

- `User` debe tener `passwordHash`, no `password`.
- No devolver `passwordHash`, refresh tokens persistidos ni secretos.
- Hash de password con bcrypt y `BCRYPT_SALT_ROUNDS`.
- Login debe lanzar `401 Unauthorized` para credenciales invalidas.
- Access token con payload minimo: `sub`, `email`, `role`.
- Validar usuario activo en `JwtStrategy`.
- `JwtAuthGuard` debe respetar `@Public()`.
- `RolesGuard` debe rechazar con `403 Forbidden` si el rol no cumple.
- `@Roles()` en endpoints con autorizacion.
- `@CurrentUser()` para obtener actor autenticado.
- Bearer token por header `Authorization`.
- Si hay refresh token: expiracion, revocacion y validacion contra usuario.
- No implementar AuthN/AuthZ en interceptors.

## Checklist de DTO basico y DTO detalle

DTO de entrada:

- `CreateXDto` para crear.
- `UpdateXDto` con `PartialType` si aplica.
- `FindXDto` o `QueryXDto` si hay filtros, `page`, `limit`, `role`, `status`, fechas o busqueda.
- Validadores `class-validator`.
- Conversion numerica con `@Type(() => Number)` cuando aplique.
- Decoradores Swagger: `ApiProperty` y `ApiPropertyOptional`.

DTO basico:

- Campos simples del recurso.
- IDs de relaciones si ayudan.
- Sin relaciones pesadas.
- Sin datos sensibles.
- Ideal para listados.

DTO detalle:

- Campos del recurso.
- Relaciones necesarias para endpoint detalle.
- Objetos anidados controlados, no entidades completas con secretos.
- Ideal para `GET /resource/:id`.

## Checklist de relaciones TypeORM

- Definir FK como columna explicita (`userId`, `itemId`) cuando sea util para queries y DTOs.
- Usar `@JoinColumn({ name: '<fk>' })` en el lado duenio.
- `ManyToOne` normalmente es el lado que guarda la FK.
- `OneToMany` va en el lado inverso.
- `OneToOne` requiere `@JoinColumn` en un solo lado.
- `ManyToMany` puro requiere `@JoinTable()` en un solo lado.
- Si la relacion tiene atributos propios, crear entidad intermedia.
- Validar que entidades relacionadas existan antes de asociarlas.
- Validar duplicados en asociaciones.
- Cargar relaciones solo en detalle o cuando el caso de uso lo requiera.
- No cargar relaciones innecesarias en listados.

## Reglas especiales para muchos a muchos

- Si la relacion muchos a muchos no tiene atributos propios, usar `@ManyToMany`.
- Usar `@JoinTable()` solo en un lado.
- El lado con `@JoinTable()` es el duenio.
- Si la relacion tiene fecha, estado, multa, cantidad, rol dentro de la relacion, notas o informacion historica, no usar `@ManyToMany` directo.
- En ese caso crear entidad intermedia con dos `@ManyToOne`.
- Las entidades principales deben tener `@OneToMany` hacia la entidad intermedia.

## Reglas especificas de Library Loans

- `User` e `Item` no deben ser `ManyToMany` directo si existe `Loan`.
- `Loan` debe ser entidad propia porque puede tener:
  - `loanDate`
  - `dueDate`
  - `returnedAt`
  - `status`
  - `fine`
  - informacion historica
- Estructura esperada:
  - `User OneToMany Loan`
  - `Loan ManyToOne User`
  - `Item OneToMany Loan`
  - `Loan ManyToOne Item`
- `MAX_ACTIVE_LOANS` limita prestamos activos si lo pide el enunciado.
- `MAX_LOAN_DAYS` calcula o valida fecha maxima de devolucion si lo pide el enunciado.
- `DAILY_FINE_RATE` calcula multas por retraso si lo pide el enunciado.
- Posibles muchos a muchos puros, solo si el enunciado los pide:
  - `Item-Category`
  - `Item-Tag`
  - `Item-Author`
  - `User-Role` si roles no son enum
- No implementar esas relaciones antes de leer el enunciado exacto.

## Checklist de migraciones

- Dejar `DB_SYNCHRONIZE=false`.
- Levantar Postgres antes de generar o correr migraciones.
- Crear o modificar entidades antes de generar.
- Comando:

```bash
npm run migration:generate -- src/database/migrations/NombreDeLaMigracion
```

- Revisar la migracion generada:
  - tablas correctas
  - columnas correctas
  - tipos correctos
  - enums correctos
  - indices necesarios
  - uniques necesarios
  - foreign keys y `onDelete`
  - `down` coherente
- Correr:

```bash
npm run migration:run
```

- Si algo salio mal, revertir:

```bash
npm run migration:revert
```

## Checklist de seed

- Crear `src/database/seeds/initial-data.seed.ts` si el enunciado pide datos iniciales.
- Agregar script `seed` en `package.json` si hace falta.
- Usar `AppDataSource`.
- Hacer seeds idempotentes cuando sea posible.
- Crear admin o usuarios base con password hasheado.
- Crear items base y prestamos de ejemplo solo si el enunciado lo permite.
- No guardar passwords sin hash.
- Documentar credenciales de prueba.

## Checklist de Swagger/Postman

- Swagger debe seguir en `/api/docs`.
- Health debe responder en `/api/health/live` y `/api/health/ready`.
- Decorar controllers con `@ApiTags`.
- Decorar endpoints protegidos con `@ApiBearerAuth()`.
- Decorar DTOs con `ApiProperty` y `ApiPropertyOptional`.
- Probar register y login.
- Copiar access token en Swagger Authorize o en Postman Bearer Token.
- Probar endpoints publicos sin token.
- Probar endpoints protegidos sin token: debe dar `401`.
- Probar endpoint con rol insuficiente: debe dar `403`.
- Probar validaciones de DTO: debe dar `400`.
- Probar no encontrado: debe dar `404`.
- Probar duplicados/reglas: debe dar `409` o `400` segun caso.

## Riesgos principales del parcial

- Empezar a codificar sin extraer primero relaciones y reglas.
- Usar `synchronize=true`.
- Romper `/api`, `/api/docs` o health.
- Poner logica de negocio en controllers.
- No validar existencia de entidades relacionadas.
- Usar `ManyToMany` directo cuando la relacion tiene atributos propios.
- Exponer `passwordHash`, refresh tokens o secretos.
- No usar `ConfigService` para bcrypt/JWT/reglas de prestamos.
- Olvidar registrar entidades en `TypeOrmModule.forFeature`.
- Olvidar importar/exportar services entre modulos.
- Generar migracion antes de que las entidades compilen.
- No revisar el SQL de la migracion.
- Cargar relaciones pesadas en listados.
- No usar `ParseUUIDPipe` para UUIDs.
- Confundir `401 Unauthorized` con `403 Forbidden`.
- No probar roles con tokens de usuarios distintos.

## Prompt de emergencia para implementar el parcial

Pega este prompt manana junto con el enunciado completo:

```text
Implementa el backend completo del parcial en Library-Loans-Scaffold-API siguiendo PARCIAL_CONTEXT.md, IMPLEMENTATION_PLAYBOOK.md, el scaffold oficial y MediTrack-API solo como referencia. No modifiques MediTrack-API. Mantén /api, /api/docs, HealthModule, ValidationPipe global, ConfigService y DB_SYNCHRONIZE=false. Implementa entidades, DTOs de entrada, DTO basico y DTO detalle por recurso, services con reglas de negocio, controllers delgados, Auth JWT, roles, guards, decorators, migraciones y seeds. Para relaciones muchos a muchos, usa @ManyToMany solo si no tienen atributos propios; si la relacion tiene fecha, estado, multa, cantidad, rol o historial, crea entidad intermedia con dos @ManyToOne. Usa migraciones explicitas, TypeOrmModule.forFeature, Swagger decorators, bcrypt, JWT Bearer, @Public, @CurrentUser y @Roles segun corresponda. Al final corre build y explica pruebas, riesgos y endpoints.
```
