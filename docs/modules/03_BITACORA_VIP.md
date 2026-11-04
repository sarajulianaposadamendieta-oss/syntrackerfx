# MÓDULO 03: BITÁCORA VIP & EVOLUCIÓN 360° (Gold FX)

## 📌 Descripción General
Módulo exclusivo de mentoría personalizada para estudiantes con membresía VIP o Lifetime de la Academia Gold FX:
1. **Acceso & Bloqueo (Upsell):** Los no-VIP ven una pantalla de bloqueo elegante con los 6 beneficios VIP y un botón de contacto por WhatsApp.
2. **Selector de Alumno (Modo Staff):** Los administradores y mentores pueden seleccionar a cualquier alumno VIP de la academia para revisar y calificar su proceso.
3. **Modo Auditor 360°:** El staff puede presionar *"Auditar Journal Completo"* para entrar directamente al Journal de cualquier alumno y ver sus trades en tiempo real.
4. **Subpestañas de la Bitácora VIP:**
   - **1. Perfil & Diagnóstico:** Nivel del trader, objetivo de capital, dificultades emocionales y técnicas, con historial cronológico editable.
   - **2. Rendimiento Operativo & Feedback:** Visualización de trades del alumno con retroalimentación editable del mentor y calificación (Válida / Inválida).
   - **3. Psicotrading:** Autoevaluaciones emocionales del trader antes/durante/después del trade, notas privadas de la psicóloga y subida de archivos/PDFs a Supabase Storage (`vip-documents`). Botón de borrado de evaluaciones.
   - **4. Sesiones 1-1:** Agendamiento de mentorías por Zoom con fecha, mentor asignado, link y estado (Agendada / Realizada).
   - **5. Homework & Tareas:** Asignación de tareas por el mentor, subida de entregas por el estudiante, retroalimentación del mentor e historial cronológico persistido.
   - **6. Evaluación Bimestral:** Formulario de evaluación con URL configurable remotamente y estado de entrega.
   - **7. Evolución 360° & Medallero de Honor VIP:** Las 5 insignias oficiales de Gold FX:
     1. 🏆 **Consistencia:** Regularidad y compromiso en el proceso operativo.
     2. 🛡️ **Disciplina:** Cumplimiento de reglas y plan de trading.
     3. ❄️ **Mente Fría:** Control emocional ante el miedo o la avaricia.
     4. 👑 **Analista Élite:** Excelencia en el análisis técnico y validación de escenarios.
     5. 🎯 **Misión Trader:** Auto-desbloqueada para todos los miembros VIP al iniciar su formación. (Las otras 4 son asignadas y revocadas libremente por el staff).

---

## 🗄️ Almacenamiento en Supabase
- **`auth.users` -> `user_metadata.vip_data`:** Estructura JSON completa que contiene diagnósticos, sesiones, psicotrading, homeworks, feedback de trades e insignias asignadas (`badges`).
- **Supabase Storage:** Bucket `vip-documents` para reportes de psicotrading y adjuntos de tareas.
