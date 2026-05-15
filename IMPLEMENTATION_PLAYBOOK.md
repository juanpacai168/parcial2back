# Implementation Playbook - Parcial Library Loans

Guia operativa para manana. La idea es convertir el enunciado en una lista verificable antes de escribir codigo.

## Paso 1: leer el enunciado completo

- Leer todo una vez sin codificar.
- Marcar palabras clave: entidades, roles, endpoints, reglas, estados, limites, filtros, reportes y seeds.
- Identificar entregables obligatorios: auth, migraciones, tests, seed, Swagger/Postman.
- Confirmar si el dominio es estrictamente `User`, `Item`, `Loan` o si aparecen recursos adicionales.
- Confirmar si refresh token es obligatorio o solo recomendado.

## Paso 2: extraer entidades

Crear una lista de sustantivos del dominio.

Posibles entidades base si el enunciado mantiene Library Loans:

- `User`
- `Item`
- `Loan`
- `Category`, `Tag`, `Author` o similares solo si aparecen en el enunciado.

Preguntas:

- Tiene identidad propia?
- Necesita tabla?
- Tiene endpoints propios?
- Tiene relaciones con otras entidades?
- Tiene historial, estado o reglas propias?

## Paso 3: extraer atributos por entidad

Para cada entidad, anotar:

- nombre del atributo
- tipo TypeScript
- tipo de columna Postgres/TypeORM
- requerido u opcional
- longitud maxima
- default
- unique/index
- si es sensible
- si debe estar en DTO basico
- si debe estar en DTO detalle

Plantilla rapida:

```text
Entidad:
- id: uuid, PK
- name: varchar(100), required
- status: enum, required, default ...
- createdAt: CreateDateColumn
- updatedAt: UpdateDateColumn
```

## Paso 4: extraer relaciones

Para cada relacion, escribir:

```text
Origen:
Destino:
Cardinalidad:
Obligatoria:
Quien guarda FK:
onDelete:
Necesita cargar en detalle:
Tiene atributos propios:
```

Ejemplo esperado para prestamos:

```text
User -> Loan: OneToMany
Loan -> User: ManyToOne, FK userId
Item -> Loan: OneToMany
Loan -> Item: ManyToOne, FK itemId
```

## Paso 5: clasificar cada relacion

### OneToMany / ManyToOne

Usar cuando muchos registros de una entidad pertenecen a uno de otra.

Ejemplo:

```text
User OneToMany Loan
Loan ManyToOne User
```

Implementacion:

```typescript
@Column({ type: 'uuid' })
userId!: string;

@ManyToOne(() => User, (user) => user.loans, { onDelete: 'RESTRICT' })
@JoinColumn({ name: 'userId' })
user?: User;
```

### OneToOne

Usar cuando un registro se asocia con exactamente un registro de otra tabla.

- `@JoinColumn()` va en un solo lado.
- El lado con `@JoinColumn()` guarda la FK.
- Revisar si la FK debe ser unique.

### ManyToMany puro

Usar solo si la relacion no tiene atributos propios.

Ejemplo posible:

```text
Item ManyToMany Category
Category ManyToMany Item
```

Reglas:

- `@JoinTable()` solo en un lado.
- El lado con `@JoinTable()` es el duenio.
- No usar si hay fecha, estado, cantidad, rol, multa o historial.

### Entidad intermedia si la relacion tiene atributos propios

Usar cuando la relacion contiene informacion propia.

Ejemplo:

```text
Loan une User e Item, pero tiene loanDate, dueDate, returnedAt, status y fine.
```

Implementacion conceptual:

```text
User OneToMany Loan
Loan ManyToOne User
Item OneToMany Loan
Loan ManyToOne Item
```

## Paso 6: extraer reglas de negocio

Escribir reglas en formato verificable:

```text
Regla:
Entidad/servicio:
Momento: create/update/delete/return/list
Error si falla:
Codigo HTTP:
Variables de entorno:
```

Para Library Loans, revisar si aplican:

- Usuario no puede tener mas de `MAX_ACTIVE_LOANS` prestamos activos.
- Prestamo activo es status `active`, `borrowed` o equivalente.
- `dueDate` no puede superar `loanDate + MAX_LOAN_DAYS`.
- Item no disponible no puede prestarse.
- Al devolver tarde, calcular multa con `DAILY_FINE_RATE`.
- No permitir duplicados en asociaciones.
- No permitir operar sobre usuarios/items inactivos si el enunciado lo pide.

Codigos sugeridos:

- `400 Bad Request`: datos validos sintacticamente pero invalidos para la regla.
- `401 Unauthorized`: falta o falla autenticacion.
- `403 Forbidden`: usuario autenticado sin permiso.
- `404 Not Found`: entidad inexistente.
- `409 Conflict`: duplicado o conflicto de estado.

## Paso 7: extraer roles

Crear matriz de permisos:

```text
Endpoint              Public  Roles permitidos
POST /auth/register   si      -
POST /auth/login      si      -
GET /items            depende admin/user/...
POST /items           no      admin/librarian
POST /loans           no      user/admin/librarian
PATCH /loans/:id/...  no      admin/librarian
```

Luego implementar:

- `UserRole` como enum si roles son fijos.
- `@Roles(...)` en endpoints protegidos por rol.
- `RolesGuard` global o por controller.
- `@CurrentUser()` para reglas que dependen del actor.

## Paso 8: extraer endpoints

Para cada endpoint:

```text
Metodo:
Ruta:
Publico:
Roles:
Body DTO:
Query DTO:
Params:
Response DTO:
Status code:
Service method:
Reglas:
```

Mantener controllers delgados:

- `@Body()` para entrada.
- `@Param()` con `ParseUUIDPipe` para UUID.
- `@Query()` para filtros.
- `@CurrentUser()` para actor.
- Llamar al service.

## Paso 9: crear entidades TypeORM

Orden sugerido:

1. Enums.
2. Entidades independientes.
3. Entidades dependientes.
4. Relaciones.
5. Indices y unique constraints.

Checklist:

- `@Entity({ name: 'table_name' })`.
- `@PrimaryGeneratedColumn('uuid')`.
- `@Column` con tipos explicitos.
- `@Index` donde haya busquedas frecuentes o uniques.
- `@CreateDateColumn`.
- `@UpdateDateColumn`.
- `@DeleteDateColumn` solo si se necesita soft delete real.
- FK explicita (`userId`, `itemId`) cuando ayude a services y queries.
- `onDelete` pensado, no automatico.

## Paso 10: crear DTOs

Por cada recurso, crear:

- `CreateXDto`.
- `UpdateXDto`.
- `XBasicDto`.
- `XDetailDto`.
- `FindXDto` o `QueryXDto` si hay filtros, `page`, `limit`, `role`, `status` o fechas.

Entrada:

- `class-validator`.
- `class-transformer` para numeros y fechas cuando aplique.
- `ApiProperty` y `ApiPropertyOptional`.
- No aceptar campos que no deben ser editables.

Salida basica:

- Para listados.
- Sin relaciones pesadas.
- Sin secretos.

Salida detalle:

- Para `GET /:id`.
- Incluir relaciones necesarias.
- Usar DTOs anidados controlados.

## Paso 11: crear services con logica de negocio

Cada service debe:

- Inyectar repositorios con `@InjectRepository`.
- Usar otros services si una validacion pertenece a otro modulo.
- Validar existencia con helpers tipo `findByIdOrFail`.
- Validar duplicados antes de crear.
- Validar reglas de estado.
- Validar permisos dependientes del actor.
- Usar transacciones si una operacion crea/actualiza varias tablas de forma inseparable.
- Lanzar excepciones HTTP adecuadas.
- Mapear entidades a DTOs si se decide no devolver entidades directamente.

No poner reglas de negocio en controllers.

## Paso 12: crear controllers delgados

Checklist:

- `@ApiTags`.
- `@ApiBearerAuth()` si esta protegido.
- `@Controller('<resource>')`.
- `@Post`, `@Get`, `@Patch`, `@Delete`.
- `@HttpCode(...)` cuando el default no aplique.
- `ParseUUIDPipe` para parametros UUID.
- `@Roles(...)` donde aplique.
- `@Public()` solo para endpoints realmente publicos.
- Nada de queries complejas ni validaciones de negocio en controller.

## Paso 13: implementar Auth JWT

Archivos esperados:

```text
src/modules/auth/
  auth.module.ts
  auth.controller.ts
  auth.service.ts
  dto/
    register.dto.ts
    login.dto.ts
    refresh-token.dto.ts
  strategies/
    jwt.strategy.ts
    jwt-refresh.strategy.ts
  entities/
    refresh-token.entity.ts
```

Y:

```text
src/modules/users/
  users.module.ts
  users.controller.ts
  users.service.ts
  dto/
  entities/user.entity.ts
```

Pasos:

- Crear `UserRole` si el enunciado tiene roles.
- Crear `User` con `passwordHash`.
- Crear `RegisterDto` y `LoginDto`.
- `register`: validar email unico, hashear password, crear usuario.
- `login`: validar email/password, firmar tokens.
- `JwtStrategy`: validar Bearer token y usuario activo.
- Access payload recomendado: `{ sub, email, role }`.
- Refresh token solo si el enunciado o patron lo pide.

## Paso 14: implementar roles, guards y decorators

Archivos esperados:

```text
src/common/decorators/current-user.decorator.ts
src/common/decorators/roles.decorator.ts
src/common/guards/jwt-auth.guard.ts
src/common/guards/roles.guard.ts
```

Patron:

- `@Public()` ya existe.
- `JwtAuthGuard` revisa `IS_PUBLIC_KEY`.
- `RolesGuard` revisa `ROLES_KEY`.
- Registrar en `AppModule` con `APP_GUARD`.
- Orden sugerido: `JwtAuthGuard` y luego `RolesGuard`.

No romper health:

- `GET /api/health/live` debe seguir publico.
- `GET /api/health/ready` debe seguir publico.

## Paso 15: generar migracion

Antes:

```bash
npm run build
docker compose up -d
```

Generar:

```bash
npm run migration:generate -- src/database/migrations/InitialLibraryLoansSchema
```

Revisar el archivo generado antes de correrlo.

Si TypeORM dice que no hay cambios:

- Confirmar que las entidades terminan en `.entity.ts`.
- Confirmar que estan bajo `src`.
- Confirmar imports y decoradores TypeORM.
- Confirmar que `data-source.ts` encuentra `../**/*.entity.{ts,js}`.

## Paso 16: crear seed

Crear si el enunciado lo pide:

```text
src/database/seeds/initial-data.seed.ts
```

Posible script:

```json
"seed": "ts-node src/database/seeds/initial-data.seed.ts"
```

Buenas practicas:

- Inicializar `AppDataSource`.
- Buscar antes de crear usuarios base.
- Hashear passwords.
- Crear datos minimos para probar roles.
- No depender de `synchronize`.
- Destruir la conexion al final.

## Paso 17: correr build

```bash
npm run build
```

Si falla:

- Dependencias faltantes: instalar con `npm install`.
- Variables de entorno: crear `.env` desde `.env.example` y completar requeridas.
- TypeScript: leer primer error real y corregir imports, tipos o DTOs.
- Migracion: no arreglar a ciegas; revisar entidades y SQL generado.

## Paso 18: probar Swagger/Postman

Orden de prueba:

1. `GET /api/health/live`.
2. `GET /api/health/ready`.
3. `POST /api/auth/register`.
4. `POST /api/auth/login`.
5. Autorizar Swagger con Bearer token.
6. Crear recursos principales.
7. Listar recursos.
8. Consultar detalle.
9. Probar filtros.
10. Probar reglas de negocio.
11. Probar permisos por rol.
12. Probar errores esperados.

Casos negativos minimos:

- Sin token en endpoint protegido: `401`.
- Token valido pero rol incorrecto: `403`.
- UUID inexistente: `404`.
- Body con campo extra: `400` por `forbidNonWhitelisted`.
- Duplicado: `409`.
- Regla de negocio violada: `400` o `409`.

## Orden recomendado de implementacion manana

1. Modelar entidades y relaciones en texto.
2. Implementar `UsersModule` y `AuthModule`.
3. Implementar guards/decorators globales.
4. Implementar `ItemsModule`.
5. Implementar `LoansModule`.
6. Implementar modulos extra del enunciado.
7. Crear DTOs basicos/detalle.
8. Crear migracion.
9. Crear seed.
10. Probar flujo completo.

## Reglas que no se deben romper

- No cambiar la infraestructura base del scaffold.
- No eliminar `HealthModule`.
- No romper `/api/health/live`.
- No romper `/api/health/ready`.
- No romper `/api/docs`.
- Mantener prefijo `/api`.
- No usar `synchronize=true`.
- Usar migraciones.
- Usar `ConfigService`.
- Mantener `ValidationPipe` global.
- Usar aliases de path cuando corresponda.
- Cada recurso debe tener module, controller, service, entity y dto.
- Usar `TypeOrmModule.forFeature` en cada modulo que use repositorios.

## Mini plantilla de recurso

```text
nest g module modules/items
nest g controller modules/items
nest g service modules/items
```

Luego crear manualmente:

```text
src/modules/items/entities/item.entity.ts
src/modules/items/dto/create-item.dto.ts
src/modules/items/dto/update-item.dto.ts
src/modules/items/dto/find-items.dto.ts
src/modules/items/dto/item-basic.dto.ts
src/modules/items/dto/item-detail.dto.ts
```

Recordatorio: revisar imports generados por Nest y ajustar a los aliases si el proyecto los usa consistentemente.

## Decision rapida para Loan

Si el enunciado habla de prestar/devolver/reservar items, normalmente `Loan` sera entidad propia.

Usar `Loan` como entidad intermedia si aparece cualquiera de estos campos:

- fecha de prestamo
- fecha maxima de devolucion
- fecha real de devolucion
- estado
- multa
- renovaciones
- historial
- notas
- usuario que aprobo

No modelar `User` e `Item` como `ManyToMany` directo en ese caso.
