# Varo PRD - MVP

## Completado (Sesión 2026-06-04)

### Backend
- [x] **Forecast Engine V1** (`src/forecast/`)
  - `GET /forecast/:goalId` — Calcula ahorro neto, meses restantes, fecha estimada
  - `GET /forecast/:goalId/history` — Historial de snapshots
  - Crea `ForecastSnapshot` en DB con `confidenceScore` y `projectedDate`
  - Recalcula forecast automáticamente al crear/actualizar/eliminar transactions
  - Calcula tendencia (`up`/`stable`/`down`) comparando con snapshot anterior
  - Agrega `goalName` y `monthlyNeeded` a la respuesta para el widget completo
- [x] **Widget Countdown completo** — ForecastWidget ahora incluye: nombre de meta, número grande de días restantes, barra de progreso + %, montos acumulado/objetivo, fecha estimada, ahorro mensual necesario, badge de estado (verde/amarillo/rojo)
- [x] **ESLint fixes** — Todos los archivos pasan `pnpm run lint` sin errores
  - Tipado de `req.user` en todos los controllers via `RequestWithUser`
  - Eliminación de `any` en transacciones (`Prisma.TransactionWhereInput`)
  - Fix de `async validate()` sin `await` en strategies
- [x] **Token naming** — Respuestas de auth usan `access_token` / `refresh_token` (snake_case) para consistencia con frontend
- [x] **Railway deploy fixes**
  - `postinstall`: `"prisma generate"` para regenerar cliente Prisma en cada install
  - `@types/ms` agregado como dependencia regular (no dev) para evitar error de tipos en Railway
  - Usuario default creado en DB de producción: `hpave954@gmail.com` / `12345678`

### Frontend (`varo_frontend/`)
- [x] Dependencias instaladas: React Navigation, TanStack Query, React Hook Form, Axios, AsyncStorage, react-native-svg
- [x] Estructura de carpetas (`src/screens/`, `src/components/`, `src/navigation/`, `src/hooks/`, `src/services/`, `src/types/`)
- [x] Pantalla Login con validación
- [x] Pantalla Register
- [x] Pantalla Dashboard (resumen de ingresos, gastos, ahorro neto, meta principal + forecast)
- [x] Pantalla Movimientos (lista, crear, eliminar con long-press)
- [x] Pantalla Metas (lista, crear, eliminar, navegación a detalle)
- [x] Pantalla Detalle Meta (progreso, forecast widget, tendencia, agregar ahorro)
- [x] Pantalla Perfil (logout)
- [x] Servicio API con Axios interceptores (JWT + refresh token automático)
- [x] **AuthContext global** — `useAuth` convertido a React Context para compartir estado de autenticación entre todo el app
- [x] **Variables de entorno** — Script `scripts/generate-config.js` lee `.env` y genera `src/config.ts` (evita problemas con `react-native-dotenv`)
- [x] API apuntando a Railway: `https://varobackend-production.up.railway.app`
- [x] Typecheck pasa sin errores

## Completado (Sesión 2026-06-05)

### Backend
- [x] **Deploy en Railway** — Backend live y respondiendo
- [x] **Flujo de login end-to-end** — Frontend se conecta a Railway, autentica y cambia de pantalla correctamente

### Frontend
- [x] **Fix: cambio de pantalla post-login** — AuthContext global permite que `Root` detecte autenticación y navegue de `AuthStack` a `AppNavigator`
- [x] **Widget Countdown** — ForecastWidget completo con nombre de meta, número grande de días restantes, barra de progreso + %, montos, fecha estimada, ahorro mensual necesario, badge de estado (verde/amarillo/rojo)
- [x] **Loading + Error states** — Componentes `LoadingScreen` y `ErrorMessage` reutilizables agregados a pantallas principales

## Completado (Sesión 2026-06-06)

### Backend
- [x] **Módulo de Categorías** — CRUD completo con validación de duplicados
  - Modelo Prisma `Category` con relación a `User`
  - Seed automático de 12 categorías por defecto al crear usuario
  - Campo `savingAllocation` en `Goal` (0-100%)
  - Endpoint `POST /goals/:id/add-savings` para agregar ahorro a meta
  - Forecast considera `savingAllocation` en cálculos
- [x] **Scan de tickets** — Integración con Groq Vision API
  - `POST /transactions/scan-receipt` recibe imagen base64
  - Usa modelo `llama-3.2-11b-vision-preview` para extraer datos
  - Devuelve: `amount`, `category`, `note`, `date`, `type`

### Frontend
- [x] **Sistema de Theming** — `ThemeContext` + `colors.ts` con soporte light/dark
  - Todos los componentes y pantallas actualizados al tema
  - `useColorScheme` + persistencia en AsyncStorage
- [x] **Pantalla de Categorías** — Lista, crear, eliminar con modal
- [x] **Fix: Navegación** — Tabs reducidos a 2 (Inicio + Movimientos), header con iconos (🎯 👤)
- [x] **Fix: Movimientos** — Agregar botón de acción (editar/eliminar) en cada item
- [x] **Fix: Edit Modal** — Modal de edición de transacciones reutilizando formulario
- [x] **Feature: Scan de tickets** — FAB menú con 3 opciones:
  - `✍️ Nuevo manual` — creación manual
  - `🖼️ Escanear de galería` — selecciona imagen de la galería
  - `📸 Escanear con cámara` — toma foto directamente
  - Flujo: imagen → envío a Groq → preview editable → confirmación → guardado
- [x] **Fix: Categories loading** — Agregado `isError` + `ErrorMessage` + `LoadingScreen`
- [x] **API_BASE_URL** — Cambiado a IP local para dispositivo físico (`http://172.22.144.247:3000`)

### Backend (continuación)
- [x] **Filters + Sort en Transactions** — `GET /transactions` ahora acepta:
  - `type` (`INCOME`/`EXPENSE`) — filtra por tipo
  - `category` — filtra por categoría exacta
  - `sortBy` (`date`/`amount`) — columna de ordenamiento
  - `sortOrder` (`asc`/`desc`) — dirección del orden
- [x] **Withdraw Savings** — `POST /goals/:id/withdraw-savings`:
  - Decrementa `currentAmount` de la meta
  - Valida `amount > 0` y que `currentAmount - amount >= 0`
  - Retorna la meta actualizada

### Frontend (continuación)
- [x] **Filter chips en TransactionsScreen** — Chips para filtrar por tipo (Todos/Ingresos/Gastos) y por categoría
- [x] **Sort buttons en TransactionsScreen** — Botones para ordenar por Fecha o Monto, con flechas ascendente/descendente
- [x] **Retirar ahorro en GoalDetailScreen** — Sección "Retirar ahorro" con input y botón, validación local contra monto actual

## Completado (Sesión 2026-06-06 — Widget Android)

### Frontend
- [x] **Android Widget nativo** — Muestra la meta principal en la pantalla de inicio del dispositivo
  - Dependencia `react-native-android-widget` agregada
  - `src/widget/GoalWidget.tsx` — Componente JSX con `FlexWidget`/`TextWidget` (nombre, días restantes en amarillo grande, fecha estimada)
  - `src/widget/GoalWidgetTaskHandler.tsx` — Headless JS task que lee de AsyncStorage y renderiza el widget cuando Android lo solicita (primer agregado/resize)
  - `android/app/src/main/res/xml/widgetprovider_goal.xml` — Configuración del widget (250×110dp, resize horizontal/vertical)
  - `android/app/src/main/java/com/varo_frontend/widget/GoalWidget.java` — Receiver que extiende `RNWidgetProvider`
  - `AndroidManifest.xml` — receiver + service registrados
- [x] **Dashboard actualizado** — Guarda meta+forecast en AsyncStorage y llama `requestWidgetUpdate` al cargar datos

## Módulo de Deudas (Implementado)

Un módulo completo de gestión de deudas existe en backend y frontend pero no fue documentado en sesiones anteriores.

### Backend (`src/debt/`)

- **Modelo Prisma**: `Debt` + `DebtPayment`
- **CRUD completo**: `GET /debts`, `POST /debts`, `PATCH /debts/:id`, `DELETE /debts/:id`
- **Pagos**: `POST /debts/:id/pay` — registra un pago y decrementa `currentAmount`
- **Aumento**: `POST /debts/:id/add` — registra un incremento de deuda y aumenta `currentAmount` + `totalAmount`
- **Historial**: `GET /debts/:id/payments` — lista todos los pagos/incrementos de una deuda
- **Validación**: No se puede pagar más del saldo pendiente

### Frontend

- **DebtCard**: Tarjeta resumen con barra de progreso y saldo restante
- **DebtDetailScreen**: Progreso, pagar, aumentar, ver historial de pagos, eliminar
- **DebtPaymentHistoryModal**: Modal con lista de pagos/incrementos
- **DashboardScreen**: Lista de deudas activas + botón crear deuda

### Diferencia con Metas

| Aspecto | Meta (Goal) | Deuda (Debt) |
|---------|-------------|--------------|
| Dirección | 0 → objetivo | saldo pendiente → 0 |
| Progreso | % acumulado | % pagado |
| Forecast | Fecha estimada de logro | Fecha estimada de liquidación |
| Ahorro | Agregar ahorro | Realizar pago |

---

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
| Navegación | React Navigation (Native Stack + Bottom Tabs) | 7.x |
| Estado Server | TanStack Query | 5.x |
| Formularios | React Hook Form | 7.x |
| HTTP | Axios | 1.x |
| Image Picker | react-native-image-picker | - |
| Deploy Backend | Railway | - |

## Features Futuros (Roadmap)

Los siguientes features están documentados como posibles evoluciones pero no están implementados:

### What-if / Insights inteligentes
- Mostrar en detalle de meta: "Si reduces gastos en Comida $500/mes, llegarías 2 meses antes"
- Requiere: análisis de gastos por categoría + simulación de forecast

### Gráficos / Historial visual
- Donut de gastos por categoría
- Línea de evolución de ahorro neto mensual
- Comparativa mes actual vs. anterior

### Notificaciones push
- Hitos de meta (25%, 50%, 75%)
- Alerta de gasto alto vs. promedio
- Recordatorio de registrar movimientos

### Presupuestos mensuales por categoría
- Definir límite mensual por categoría
- Barra de progreso en dashboard
- Alerta al acercarse al límite

### iOS Widget
- Paridad con widget Android existente
- Requiere implementación nativa con WidgetKit

### FinancialObjective V2 — hecho (backend), pendiente frontend

Problema original: `Goal` y `Debt` se modelaban por separado aunque compartían el mismo motor de forecast. Tenían progreso inverso (Meta: `0 → objetivo`; Deuda: `saldo pendiente → 0`), lo cual generaba duplicación de lógica de cálculo, y `Debt` ni siquiera tenía forecast propio.

**Implementado** (change OpenSpec `unify-financial-objective`): `Goal`, `Debt`, `GoalContribution`, `DebtPayment` y `ForecastSnapshot` se reemplazaron por un único modelo `FinancialObjective` (tipos `SAVING_GOAL` / `DEBT_PAYOFF`), un ledger unificado `ObjectiveEntry` (`ADD`/`WITHDRAW`/`PAYMENT`/`INCREASE`) y `ObjectiveForecastSnapshot`. `ForecastService` ahora comparte un único cálculo de proyección (`remaining/rate → meses → fecha`, confianza por volumen de datos, tendencia por snapshot anterior) parametrizado por dirección: `remaining = targetAmount - currentAmount` (SAVING_GOAL) vs. `remaining = currentAmount` (DEBT_PAYOFF). `transactions.service.ts` también unificó la lógica de reversión de saldo (antes duplicada para `debtPayment`/`goalContribution`) en un solo lookup contra `ObjectiveEntry` con una tabla de signos compartida.

Esta migración fue destructiva a propósito: como el proyecto usa `prisma db push` sin migraciones versionadas y los datos existentes eran de prueba/personales, se optó por un backup manual (`pg_dump`) seguido de un reemplazo directo del schema, en vez de escribir un script de migración de datos.

**No implementado (a propósito, alcance de esta ronda)**: `GoalsController`/`DebtController` y las rutas `/goals`/`/debts` se mantuvieron exactamente iguales (`GoalsService`/`DebtService` son ahora adaptadores delgados sobre `FinancialObjectivesService`) — el frontend no requirió ningún cambio. No se expuso un endpoint `/objectives` nuevo. Sí se agregó `GET /debts/:id/forecast` (aditivo), dándole a `Debt` una fecha de pago estimada real por primera vez, aunque `DebtDetailScreen` todavía no lo consume.

**Próximo paso natural** (no iniciado): si en algún momento se quiere una sola pantalla/componente para metas y deudas en el frontend, ahí sí tendría sentido exponer `/objectives` y migrar `GoalDetailScreen`/`DebtDetailScreen`/`GoalCard`/`DebtCard` para aprovechar el modelo ya unificado en el backend.

---

## Notas Técnicas

- **Prisma 5 vs 7**: Se mantuvo Prisma 5.22.0 (compatible con CJS y `@prisma/client` clásico). No migrar a v7 hasta que NestJS soporte ESM nativo.
- **Módulo TS**: `commonjs` + `node` (no `nodenext`) para compatibilidad con Prisma.
- **Seguridad**: Todas las rutas de transactions y goals usan `JwtAuthGuard`. El userId se extrae del JWT, no del body.
- **DB URL**: Neon PostgreSQL. Si hay errores de conexión, verificar que el endpoint de Neon esté activo.
- **Railway**: Requiere `postinstall: "prisma generate"` porque `node_modules` se reinstala en cada deploy y el cliente Prisma no se commitea.
- **Frontend env**: No usar `react-native-dotenv` (problemas con Metro). En su lugar: script `generate-config.js` que lee `.env` → `src/config.ts`.
- **Auth state**: Usar React Context (no hook local con `useState`) para que el estado de autenticación sea observable por todo el árbol de componentes.
- **Scan de tickets**: Requiere `GROQ_API_KEY` en backend. El frontend envía imagen en base64 al endpoint `/transactions/scan-receipt`.
- **Dispositivo físico**: Usar IP de red local (no `localhost`) en `API_BASE_URL`.
