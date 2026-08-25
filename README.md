# Varo 💰 — Backend

API REST para Varo, una app móvil de finanzas personales para Android. Capturas y descripción completa: **[varo_frontend](https://github.com/Hector0122/varo_frontend)**.

## Stack

| | |
|---|---|
| Framework | NestJS 11 |
| ORM / DB | Prisma + PostgreSQL (Neon) |
| Auth | JWT (access + refresh) |
| IA | Groq Vision — extracción de datos de tickets |

Desplegado en Railway.

## Arquitectura

- **Auth** — registro, login, refresh tokens
- **Transactions** — CRUD de movimientos + escaneo de tickets con Groq Vision
- **Categories** — categorías personalizadas por usuario
- **FinancialObjectives** — metas de ahorro y deudas (modelo unificado) + motor de forecast
- **RecurringTransactions** — transacciones recurrentes

## Cómo está resuelto

- **Metas y deudas comparten un solo modelo de datos** (`FinancialObjective`) con semántica inversa — una meta avanza `0 → target`, una deuda avanza `balance → 0` — reusando el mismo motor de forecast para ambas.
- El **forecast se recalcula en cada movimiento** (create/update/delete), no es un valor cacheado.
- El **`userId` nunca viaja en el body** de la request — se extrae del JWT en cada endpoint protegido.
- El **escaneo de tickets usa un modelo de visión** (Groq/Llama Vision), no OCR clásico, para extraer monto, categoría y fecha directo de la foto.

## Licencia

MIT — ver [LICENSE](LICENSE)
