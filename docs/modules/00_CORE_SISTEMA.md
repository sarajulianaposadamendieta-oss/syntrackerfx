# MÓDULO 00: CORE & SISTEMA (Gold FX)

## 📌 Descripción General
Este módulo gestiona la infraestructura central de la aplicación SynTracker FX (`syntrackerfx.com`):
1. **Cliente Supabase (`sb`):** Conexión REST y Auth, persistencia de sesión local, token refresh automático.
2. **Autenticación & Sesión:** Inicio de sesión, registro, recuperación de contraseña y auto-login al recargar (`autoInit`).
3. **Roles y Permisos Oficiales (`STAFF_ROLES`):** Asignación de credenciales para Desarrolladora, Mentores, Psicóloga y Administradores.
4. **Perfil de Usuario:** Datos personales, bandera de país, avatar circular y sincronización segura con `user_metadata` y la tabla pública `profiles`.
5. **Navegación & Shell:** Control de pestañas activas, diseño adaptable móvil y barra superior.

---

## 🔐 Roles Oficiales del Staff (`STAFF_ROLES`)
- **👩‍💻 Desarrolladora (Sara):** `parkjiminfromsara@gmail.com` (ID: `8ffa85d8-cf48-4b2b-a720-98ff14e99553`). Acceso total como Superadmin, auditoría de código, monitor del bot y consola administrativa.
- **👨‍🏫 Mentor Principal (Esteban Ochoa):** `estebangoldfx@gmail.com` (ID: `26b36306-b12c-481c-b43e-fe4f1452a210`).
- **🛡️ Administrador (Steven):** `infogoldfx@gmail.com` (ID: `84061dcc-f1dd-4a1f-8e2a-bbbe63045787`).
- **🧠 Psicóloga Gold FX:** `psico.goldfx@gmail.com` (ID: `2d09f625-f966-47f6-9b14-392e743d1a38`).

---

## 🗄️ Esquema de Base de Datos
- **`auth.users`:** Metadatos canónicos (`user_metadata.full_name`, `username`, `country`, `avatar_url`, `membership`, `vip_data`).
- **`profiles`:** Columnas: `[id, full_name, email, created_at, country]`.
  > *Regla de oro:* Nunca enviar campos no existentes como `username` a `profiles` para evitar error 400.
