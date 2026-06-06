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
| Deploy Backend | Railway | - |

## Notas Técnicas

- **Prisma 5 vs 7**: Se mantuvo Prisma 5.22.0 (compatible con CJS y `@prisma/client` clásico). No migrar a v7 hasta que NestJS soporte ESM nativo.
- **Módulo TS**: `commonjs` + `node` (no `nodenext`) para compatibilidad con Prisma.
- **Seguridad**: Todas las rutas de transactions y goals usan `JwtAuthGuard`. El userId se extrae del JWT, no del body.
- **DB URL**: Neon PostgreSQL. Si hay errores de conexión, verificar que el endpoint de Neon esté activo.
- **Railway**: Requiere `postinstall: "prisma generate"` porque `node_modules` se reinstala en cada deploy y el cliente Prisma no se commitea.
- **Frontend env**: No usar `react-native-dotenv` (problemas con Metro). En su lugar: script `generate-config.js` que lee `.env` → `src/config.ts`.
- **Auth state**: Usar React Context (no hook local con `useState`) para que el estado de autenticación sea observable por todo el árbol de componentes.
