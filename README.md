# Varo

API REST para Varo, una app móvil de finanzas personales para Android. Este repo es el backend — capturas y la app: **[varo_frontend](https://github.com/Hector0122/varo_frontend)**.

## Por qué existe

La mayoría de apps de finanzas piden que captures cada gasto a mano, y eso hace que la gente deje de usarlas a la semana. Varo resuelve eso de dos formas: **escaneo de tickets con IA** (foto al comprobante, la app extrae monto, categoría y fecha) y un **motor de predicción** que dice, con base en el historial real del usuario, si va a llegar a su meta de ahorro a tiempo o no.

## Features

- 📊 Dashboard con resumen de ingresos, gastos, ahorro neto y progreso de la meta principal
- 🧾 Escaneo de tickets con IA (Groq Vision)
- 🎯 Metas de ahorro con asignación porcentual y forecast de cumplimiento
- 💳 Deudas con historial de pagos e incrementos
- 🔒 Bloqueo de app (PIN / biometría) + JWT con refresh tokens
- 📤 Exportar movimientos a CSV

Metas y deudas comparten un solo modelo de datos (`FinancialObjective`) con semántica inversa — una meta avanza `0 → target`, una deuda avanza `balance → 0` — reusando el mismo motor de forecast para ambas.

## Algunas decisiones técnicas

- El **forecast se recalcula en cada movimiento** (create/update/delete), no es un valor cacheado — el "cuándo vas a cumplir tu meta" siempre refleja el historial real.
- El **`userId` nunca viaja en el body** de la request — se extrae del JWT en cada endpoint protegido, como invariante de seguridad.
- El **escaneo de tickets usa un modelo de visión** (Groq/Llama Vision), no OCR clásico, para extraer monto, categoría y fecha directo de la foto.

## Stack

| | |
|---|---|
| **Backend** | NestJS 11 · Prisma · PostgreSQL (Neon) · JWT · Groq Vision |
| **App** | React Native · TypeScript · React Navigation · TanStack Query |

Desplegado en Railway.

## Licencia

MIT
