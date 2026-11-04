# ARQUITECTURA OFICIAL DE SYNTRACKER FX (Gold FX)

Este repositorio contiene la plataforma oficial de seguimiento operativo, auditoría y torneos de trading de **Gold FX** (`syntrackerfx.com`).

---

## 📂 Organización por Módulos
La aplicación está organizada en 5 módulos técnicos independientes:

1. [00 - Core & Sistema](modules/00_CORE_SISTEMA.md): Autenticación, cliente Supabase, sesión persistente, roles del staff y perfil de usuario.
2. [01 - Journal General & Métricas](modules/01_JOURNAL_GENERAL.md): Registro diario de trades, cuentas, calendario mensual, estadísticas y analítica.
3. [02 - Torneo de Trading MT5](modules/02_TORNEO_MT5.md): Participantes MT5, clasificación en vivo, cálculo de drawdown y reglas oficiales.
4. [03 - Bitácora VIP & Evolución 360°](modules/03_BITACORA_VIP.md): Mentoría 1-1, diagnósticos, psicotrading, tareas, feedback y medallero de honor.
5. [04 - Panel de Administración](modules/04_PANEL_ADMINISTRACION.md): Radar de faltas, membresías de alumnos, comunicados y monitor de bot.

---

## 🛠️ Compilación y Despliegue
- El comando `node build.js` compila, valida y ofusca el código fuente generando los artefactos en `dist/` y en la raíz.
- Despliegue continuo automático a través de **Vercel** enlazado a la rama `main`.
