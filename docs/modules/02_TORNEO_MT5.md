# MÓDULO 02: TORNEO DE TRADING (Gold FX)

## 📌 Descripción General
Módulo de competencia de trading en tiempo real sincronizado con MetaTrader 5 (MT5) a través del bot Python automatizado (`bot.py`):
1. **Participantes (`tournament_participants`):** Almacena las cuentas de torneo con credenciales MT5 (login, server, investor password), saldo inicial ($10,000), balance actual, equidad y estadísticas en vivo.
2. **Reglas de Competencia:**
   - **Límite de Drawdown Máximo:** Si el Drawdown máximo (`dd_max_pct`) es $\ge 5.0\%$, el participante queda automáticamente en estado `Descalificado`.
   - **Puntaje Oficial:** Basado en retorno porcentual neto (`return_pct`), disciplina y consistencia.
3. **Clasificación en Vivo (Leaderboard):**
   - Ranking oficial en vivo de participantes activos.
   - Puesto bruto por PnL vs Puesto Oficial con filtros de descalificación.
4. **Logros & Medallas de Torneo:** Insignias de rendimiento destacadas para los primeros lugares.

---

## 🗄️ Tabla Involucrada en Supabase
- **`tournament_participants`:** `[id, tournament_id, user_id, user_name, user_email, mt5_login, mt5_server, mt5_password, status, initial_balance, current_balance, net_pnl, return_pct, dd_daily_pct, dd_max_pct, discipline_score, win_rate, current_score, trades_count, win_count, loss_count, be_count, violations_count, badges, avatar_url, country, created_at]`
