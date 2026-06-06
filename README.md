# Varo Backend

API RESTful para la aplicación de seguimiento financiero Varo. Construida con NestJS, Prisma y PostgreSQL.

## Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | NestJS | 11 |
| ORM | Prisma | 5.22.0 |
| DB | PostgreSQL (Neon) | - |
| Auth | @nestjs/jwt + passport-jwt + bcryptjs | - |
| Validación | class-validator + class-transformer | - |
| Deploy | Railway (producción) / Local (dev) | - |

## Módulos

- **Auth** (`src/auth/`) — Registro, login, refresh tokens JWT
- **Transactions** (`src/transactions/`) — CRUD de movimientos + scan de tickets con Groq Vision
- **Categories** (`src/categories/`) — CRUD de categorías personalizadas por usuario
- **Goals** (`src/goals/`) — Metas de ahorro con asignación porcentual
- **Forecast** (`src/forecast/`) — Motor de predicción de cumplimiento de metas

## API Endpoints

### Auth
- `POST /auth/register` — Crear cuenta
- `POST /auth/login` — Iniciar sesión
- `POST /auth/refresh` — Refrescar access token

### Transactions
- `GET /transactions` — Listar movimientos (filtros: `type`, `category`)
- `POST /transactions` — Crear movimiento
- `POST /transactions/scan-receipt` — Escanear ticket con Groq Vision
- `PATCH /transactions/:id` — Actualizar movimiento
- `DELETE /transactions/:id` — Eliminar movimiento

### Categories
- `GET /categories` — Listar categorías (filtro: `type`)
- `POST /categories` — Crear categoría
- `PATCH /categories/:id` — Actualizar categoría
- `DELETE /categories/:id` — Eliminar categoría

### Goals
- `GET /goals` — Listar metas
- `GET /goals/:id` — Ver meta
- `POST /goals` — Crear meta
- `POST /goals/:id/add-savings` — Agregar ahorro a meta
- `PATCH /goals/:id` — Actualizar meta
- `DELETE /goals/:id` — Eliminar meta

### Forecast
- `GET /forecast/:goalId` — Calcular forecast para una meta
- `GET /forecast/:goalId/history` — Historial de snapshots

## Configuración

```bash
# Variables de entorno (.env)
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
GROQ_API_KEY=gsk_...  # Para scan de tickets
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Sincronizar schema con DB
npx prisma db push

# Seed (crea usuario default + categorías)
npx ts-node seed.ts

# Iniciar servidor en modo watch
npm run start:dev
```

## Deploy

### Railway
```bash
# Push a main
# Railway auto-deploy con postinstall: "prisma generate"
```

### Producción
```bash
npm run build
npm run start:prod
```

## Notas Técnicas

- **Prisma 5**: Se mantiene en v5.22.0 por compatibilidad CJS con NestJS. No migrar a v7 hasta soporte ESM nativo.
- **Seguridad**: Todas las rutas protegidas con `JwtAuthGuard`. El `userId` se extrae del JWT, no del body.
- **Forecast**: Se recalcula automáticamente al crear/actualizar/eliminar transacciones.
- **Scan de tickets**: Usa Groq API con modelo `llama-3.2-11b-vision-preview` para extraer datos de tickets.

## Licencia

MIT
