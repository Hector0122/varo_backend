# Varo - Product Requirements Document (PRD)

# 1. Resumen

## Nombre
**Varo**

## Tagline
**Cada peso cuenta.**

## Problema

Las aplicaciones de finanzas personales permiten registrar gastos, pero pocas ayudan al usuario a entender:

- Cuándo alcanzará una meta.
- Cómo impactan sus gastos diarios.
- Si se está acercando o alejando de sus objetivos.

## Solución

Varo conecta gastos, ingresos y metas financieras mediante un sistema de forecast que calcula automáticamente fechas estimadas de cumplimiento.

---

# 2. Objetivos del MVP

El usuario debe poder:

- Registrarse.
- Iniciar sesión.
- Registrar ingresos.
- Registrar gastos.
- Crear metas.
- Ver progreso.
- Ver forecast.
- Ver tendencia.

---

# 3. Stack Tecnológico

## Mobile

- React Native
- TypeScript
- React Navigation
- TanStack Query
- React Hook Form
- React Native SVG

## Backend

- NestJS 11
- TypeScript
- JWT
- Refresh Tokens

## Database

- PostgreSQL
- Prisma ORM

## Storage

- Cloudflare R2

## Notifications

- Firebase Cloud Messaging

---

# 4. Arquitectura

Frontend → API NestJS → PostgreSQL

Servicios:

- Auth
- Transactions
- Goals
- Forecast
- Notifications

---

# 5. Casos de Uso

## Registrar gasto

Usuario registra:

- monto
- categoría
- fecha
- nota

Resultado:

- saldo actualizado
- forecast recalculado

## Crear meta

Ejemplo:

- Casa
- $350,000

Resultado:

- forecast generado

---

# 6. Pantallas

## Login

- Email
- Password

## Dashboard

Mostrar:

- saldo
- ingresos
- gastos
- ahorro neto

### Meta principal

Ejemplo:

Meta Casa

$80,000 / $350,000

22%

Fecha estimada:
Abril 2028

### Widget: Countdown de Meta

Componente visual simple e informativo que muestra al usuario **cuántos días le faltan** para alcanzar su meta principal.

```
┌─────────────────────────────┐
│          🏠 Casa            │
│                             │
│       ┌───────────┐         │
│       │    682    │         │
│       │   días    │         │
│       └───────────┘         │
│                             │
│  ████████░░░░░░░░░░  22%    │
│  $80,000 / $350,000         │
│                             │
│  📅 Abril 2028              │
│  💰 $396 / mes necesarios   │
└─────────────────────────────┘
```

**Estados visuales:**

- **Verde** (>50% completado, ahorro al día): "Vas bien, 682 días"
- **Amarillo** (25-50%, ahorro estable): "En camino, 1200 días"  
- **Rojo** (<25% o ahorro bajando): "Ajusta tu ritmo, 3400 días"

El número de **días** es el foco principal del widget. Se recalcula en tiempo real con cada transacción nueva.

## Movimientos

Lista de:

- ingresos
- gastos

## Crear Movimiento

Campos:

- tipo
- categoría
- monto
- nota

## Metas

Lista de metas.

## Detalle Meta

- **Widget countdown** (días restantes, número grande como foco)
- progreso (barra + porcentaje)
- fecha estimada
- ahorro mensual necesario
- tendencia (verde/amarillo/rojo)
- historial de snapshots

---

# 7. Diferenciador Principal

## Widget Countdown

El elemento central de la experiencia Varo es un **contador visual de días restantes** para alcanzar una meta. Un número grande, imposible de ignorar, que cambia con cada transacción.

- Si ahorras más → los días bajan (verde)
- Si gastas de más → los días suben (rojo)
- Es un ancla psicológica: cada peso gastado o ahorrado tiene un impacto tangible en días.

## Impacto en Meta

Cada gasto muestra su impacto traducido a tiempo:

Ejemplo:

Starbucks $150

Impacto:
+4 horas para tu meta

Compra impulsiva $1200

Impacto:
+3 días para tu meta

---

# 8. Modelo de Datos

## User

```prisma
model User {
  id String @id @default(uuid())
  email String @unique
  password String
  createdAt DateTime @default(now())
}
```

## Transaction

```prisma
model Transaction {
  id String @id @default(uuid())
  userId String
  amount Decimal
  type String
  category String
  note String?
  date DateTime

  user User @relation(fields:[userId], references:[id])
}
```

## Goal

```prisma
model Goal {
  id String @id @default(uuid())
  userId String
  name String
  targetAmount Decimal
  currentAmount Decimal @default(0)
}
```

## ForecastSnapshot

```prisma
model ForecastSnapshot {
  id String @id @default(uuid())
  goalId String
  projectedDate DateTime
  monthlySaving Decimal
  confidenceScore Float
  createdAt DateTime @default(now())
}
```

---

# 9. Endpoints

## Auth

POST /auth/register

POST /auth/login

POST /auth/refresh

## Transactions

GET /transactions

POST /transactions

PATCH /transactions/:id

DELETE /transactions/:id

## Goals

GET /goals

POST /goals

PATCH /goals/:id

DELETE /goals/:id

## Forecast

GET /forecast/:goalId

---

# 10. Forecast Engine V1

Variables:

- ingresos
- gastos
- meta
- acumulado

Formula:

ahorro_neto = ingresos - gastos

restante = meta - acumulado

meses = restante / ahorro_neto

---

# 11. Tendencias

Verde:

- ahorro aumentando

Amarillo:

- estable

Rojo:

- gastos aumentando

---

# 12. Estructura Frontend

src/

- screens/
- components/
- navigation/
- hooks/
- services/
- features/
- utils/

---

# 13. Estructura Backend

src/

- auth/
- users/
- transactions/
- goals/
- forecast/
- notifications/

---

# 14. Fase 2

OCR

Permitir:

- ticket
- factura
- captura de pantalla

Flujo:

imagen → OCR → preview → guardar

---

# 15. Fase 3

PDF Bancario

- importar PDF
- detectar movimientos
- confirmar registros

---

# 16. Fase 4

Notificaciones Inteligentes

Ejemplos:

"Vas 8 días adelantado."

"Tu meta se movió 3 días."

---

# 17. Fase 5

IA

Sugerencias:

"Reduciendo restaurantes $500/mes llegarías 28 días antes."

---

# 18. Roadmap

Mes 1

- Auth
- Transactions

Mes 2

- Goals
- Forecast

Mes 3

- Dashboard
- Testing
- Release Beta

---

# 19. Definición de Éxito

El MVP está listo cuando:

- Un usuario puede registrar movimientos.
- Crear una meta.
- Ver progreso.
- Ver forecast.
- Entender si sus hábitos lo acercan o alejan de la meta.

---

# 20. Estado del Proyecto (Sesión 2026-06-03)

## Completado

### Backend

#### Configuración Inicial
- [x] Prisma 5.22.0 + PostgreSQL (Neon) configurado
- [x] `prisma-client-js` como generator (compatible CJS)
- [x] Variables de entorno: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`
- [x] `.env.example` creado
- [x] `PrismaModule` + `PrismaService` (extiende PrismaClient, `@prisma/client`)
- [x] `ConfigModule.forRoot({ isGlobal: true })`
- [x] `ValidationPipe` global en `main.ts`
- [x] Schema sincronizado con la DB (`prisma db push`)

#### Auth (`src/auth/`)
- [x] `POST /auth/register` — Email + password, bcrypt, devuelve tokens
- [x] `POST /auth/login` — Valida credenciales, devuelve access + refresh token
- [x] `POST /auth/refresh` — Nuevo par de tokens desde refresh token
- [x] `JwtStrategy` — Valida access tokens (Bearer)
- [x] `JwtRefreshStrategy` — Valida refresh tokens (Bearer)
- [x] `JwtAuthGuard` — Protege rutas con access token
- [x] `JwtRefreshGuard` — Protege refresh endpoint
- [x] Validación DTOs: email, password min 6
- [x] Manejo de errores: 409 (email duplicado), 401 (credenciales inválidas), 400 (validación)

#### Users (`src/users/`)
- [x] `UsersService`: create, findByEmail, findById

#### Transactions (`src/transactions/`)
- [x] `GET /transactions` — Lista con filtros opcionales ?type=&category=, ordenado por fecha desc, scoped por usuario
- [x] `POST /transactions` — amount, type (INCOME/EXPENSE), category, note (opcional), date
- [x] `PATCH /transactions/:id` — Actualización parcial, scoped por usuario
- [x] `DELETE /transactions/:id` — Soft delete con verificación de ownership
- [x] Validación DTOs: amount > 0, type INCOME/EXPENSE, date ISO8601

#### Goals (`src/goals/`)
- [x] `GET /goals` — Lista metas del usuario, ordenado por createdAt desc
- [x] `POST /goals` — name, targetAmount
- [x] `PATCH /goals/:id` — Actualización parcial (incluye currentAmount)
- [x] `DELETE /goals/:id` — Elimina meta + sus ForecastSnapshots (cascada)
- [x] Validación DTOs: name string, targetAmount > 0, currentAmount >= 0

### Testing
- [x] Todos los endpoints probados con curl
- [x] Build compila sin errores
- [x] DB sincronizada (Neon PostgreSQL)

## Pendiente (Próxima Sesión)

### Backend
- [ ] **Forecast Engine V1** (`src/forecast/`)
  - `GET /forecast/:goalId`
  - Fórmula: `ahorro_neto = total_ingresos - total_gastos`, `meses = restante / ahorro_neto`
  - Crear `ForecastSnapshot` en DB
  - Calcular `confidenceScore` y `projectedDate`
  - Recalcular forecast automáticamente al crear/actualizar transactions

- [ ] **Tendencias** (verde/amarillo/rojo según hábitos de ahorro)

### Frontend (`varo_frontend/`)
- [ ] Configurar React Navigation
- [ ] Estructura de carpetas (`screens/`, `components/`, `navigation/`, `hooks/`, `services/`)
- [ ] Pantalla Login
- [ ] Pantalla Register
- [ ] Pantalla Dashboard (saldo, ingresos, gastos, ahorro neto, meta principal)
- [ ] Pantalla Movimientos (lista + crear/editar/eliminar)
- [ ] Pantalla Metas (lista + crear/editar/eliminar)
- [ ] Pantalla Detalle Meta (progreso, forecast, tendencia)
- [ ] Conectar frontend a API (Auth header, TanStack Query)

### Testing
- [ ] Tests unitarios backend
- [ ] Tests e2e

## Stack Actualizado

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend | NestJS | 11 |
| ORM | Prisma | 5.22.0 |
| DB | PostgreSQL (Neon) | - |
| Auth | @nestjs/jwt + passport-jwt + bcryptjs | - |
| Validación | class-validator + class-transformer | - |
| Mapped Types | @nestjs/mapped-types | 2.1.1 |
| Frontend | React Native | 0.85.3 |

## Notas Técnicas

- **Prisma 5 vs 7**: Se mantuvo Prisma 5.22.0 (compatible con CJS y `@prisma/client` clásico). No migrar a v7 hasta que NestJS soporte ESM nativo.
- **Módulo TS**: `commonjs` + `node` (no `nodenext`) para compatibilidad con Prisma.
- **Seguridad**: Todas las rutas de transactions y goals usan `JwtAuthGuard`. El userId se extrae del JWT, no del body.
- **DB URL**: Neon PostgreSQL. Si hay errores de conexión, verificar que el endpoint de Neon esté activo.

