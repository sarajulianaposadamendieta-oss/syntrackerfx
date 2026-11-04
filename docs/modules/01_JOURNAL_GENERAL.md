# MÓDULO 01: JOURNAL GENERAL & MÉTRICAS (Gold FX)

## 📌 Descripción General
Es el núcleo operativo donde los traders registran y analizan sus operaciones diarias:
1. **Gestión de Cuentas (`accounts`):** Soporta cuentas reales, demo y de evaluación de fondeo con balance inicial, broker e icono identificador.
2. **Registro de Trades (`trades`):** Registro de compras/ventas, activo (XAUUSD, sintéticos, etc.), sesión operativa (Nueva York, Londres, Tokio), setups (Alcista, Bajista, Rango), PnL, Ratio Riesgo/Beneficio (RR), capturas de pantalla y notas de psicología.
3. **GoldFX Discipline Score:** Algoritmo que puntúa de 0 a 100 el cumplimiento de reglas, gestión de riesgo y ejecución del trader en cada operación.
4. **Trade Log:** Historial cronológico con filtros por mes, cuenta activa y búsqueda dinámica.
5. **Calendario Mensual Interactivo:** Vista de rendimiento día por día, PnL diario y marcado de "Días sin Operar" (Inaction Days).
6. **Estadísticas & Analítica:** Win Rate, Profit Factor, Racha de victorias/derrotas, desglose por sesión y gráficos de frecuencia.

---

## 🗄️ Tablas Involucradas en Supabase
- **`accounts`:** `[id, user_id, name, type, broker, initial_balance, icon, created_at]`
- **`trades`:** `[id, user_id, date, account, asset, side, entry_time, exit_time, pnl, rr, session, setup, news, photo, notes, created_at, plan, confirmations]`
