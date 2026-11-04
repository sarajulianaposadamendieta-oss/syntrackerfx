


    const SUPABASE_URL = 'https://nuvoeaqorlzrrhscosim.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dm9lYXFvcmx6cnJoc2Nvc2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTU1NjcsImV4cCI6MjA5NzUzMTU2N30.dDrNTeuO20qQFjYulzeA6iaHBd3zLJNQG53YdZa-dqY';
    const ADMIN_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dm9lYXFvcmx6cnJoc2Nvc2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTk1NTU2NywiZXhwIjoyMDk3NTMxNTY3fQ.dNxaUeXs_RjlD-HlezKA0MMlc3Z7jkdbRhdDrlDMV08';

    // ── Supabase client ──
    const sb = (function () {
      const base = { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
      const STORAGE_KEY = 'syntracker_auth_session';
      let token = null, user = null, refreshToken = null;

      function saveSession(t, u, rt) {
        token = t || null;
        user = u || null;
        if (rt !== undefined) refreshToken = rt || null;
        try {
          if (token && user) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
              token: token,
              user: user,
              refresh_token: refreshToken,
              saved_at: Date.now()
            }));
            document.documentElement.classList.add('has-session');
          } else {
            localStorage.removeItem(STORAGE_KEY);
            document.documentElement.classList.remove('has-session');
          }
        } catch (e) {
          console.warn('LocalStorage not accessible:', e);
        }
      }

      function loadSession() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const d = JSON.parse(raw);
            if (d && d.token && d.user) {
              token = d.token;
              user = d.user;
              refreshToken = d.refresh_token || null;
              document.documentElement.classList.add('has-session');
              return { token, user, refresh_token: refreshToken };
            }
          }
        } catch (e) {
          console.warn('Error reading saved session:', e);
        }
        return null;
      }

      function h() { return Object.assign({}, base, { 'Authorization': 'Bearer ' + (token || SUPABASE_KEY) }); }

      async function signUp(email, password, name) {
        const r = await fetch(SUPABASE_URL + '/auth/v1/signup', { method: 'POST', headers: base, body: JSON.stringify({ email, password, data: { full_name: name } }) });
        const d = await r.json();
        if (d.error) throw new Error(d.error.message);
        if (d.access_token && d.user) {
          saveSession(d.access_token, d.user, d.refresh_token);
        }
        return d;
      }

      async function signIn(email, password) {
        const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: base, body: JSON.stringify({ email, password }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error_description || d.message || 'Error al iniciar sesión');
        saveSession(d.access_token, d.user, d.refresh_token);
        return d;
      }

      async function signOut() {
        try {
          await fetch(SUPABASE_URL + '/auth/v1/logout', { method: 'POST', headers: h() });
        } catch (e) {}
        saveSession(null, null, null);
      }

      async function verifySession() {
        const s = loadSession();
        if (!s || !s.token) return null;
        try {
          const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: h() });
          if (r.ok) {
            const u = await r.json();
            user = u;
            saveSession(token, user, refreshToken);
            return user;
          }
          // Si el token expiró, intentar renovar con refresh_token
          if (refreshToken) {
            const rf = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
              method: 'POST',
              headers: base,
              body: JSON.stringify({ refresh_token: refreshToken })
            });
            if (rf.ok) {
              const rd = await rf.json();
              saveSession(rd.access_token, rd.user, rd.refresh_token);
              return rd.user;
            }
            // Si el refresh_token es explícitamente inválido o expirado (400 o 401), cerrar sesión
            if (rf.status === 400 || rf.status === 401) {
              saveSession(null, null, null);
              return null;
            }
          }
          // Si es un error temporal del servidor (5xx) o fallo transitorio, mantener sesión con usuario en caché
          if (r.status >= 500 && user) {
            return user;
          }
        } catch (e) {
          // Si hubo error de red, mantener sesión con el usuario en caché para no forzar logout
          if (user) return user;
        }
        saveSession(null, null, null);
        return null;
      }

      function getUser() { return user; }

      async function query(table, opts) {
        opts = opts || {};
        let url = SUPABASE_URL + '/rest/v1/' + table + '?select=' + (opts.select || '*');
        if (opts.filter) url += '&' + opts.filter;
        if (opts.order) url += '&order=' + opts.order;
        let r = await fetch(url, { headers: h() });
        // Si el token expiró durante la sesión, renovarlo automáticamente y reintentar
        if (r.status === 401 && refreshToken) {
          const renewed = await verifySession();
          if (renewed) {
            r = await fetch(url, { headers: h() });
          }
        }
        if (!r.ok) return [];
        return r.json();
      }
      async function insert(table, data) {
        let r = await fetch(SUPABASE_URL + '/rest/v1/' + table, { method: 'POST', headers: h(), body: JSON.stringify(data) });
        if (r.status === 401 && refreshToken) {
          const renewed = await verifySession();
          if (renewed) {
            r = await fetch(SUPABASE_URL + '/rest/v1/' + table, { method: 'POST', headers: h(), body: JSON.stringify(data) });
          }
        }
        if (!r.ok) { const e = await r.json(); throw new Error(JSON.stringify(e)); }
        return r.json();
      }
      async function update(table, id, data) {
        let r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, { method: 'PATCH', headers: h(), body: JSON.stringify(data) });
        if (r.status === 401 && refreshToken) {
          const renewed = await verifySession();
          if (renewed) {
            r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, { method: 'PATCH', headers: h(), body: JSON.stringify(data) });
          }
        }
        if (!r.ok) { const e = await r.json(); throw new Error(JSON.stringify(e)); }
        return r.json();
      }
      async function remove(table, id) {
        let r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, { method: 'DELETE', headers: h() });
        if (r.status === 401 && refreshToken) {
          const renewed = await verifySession();
          if (renewed) {
            r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, { method: 'DELETE', headers: h() });
          }
        }
        return r.ok;
      }
      async function uploadFile(bucket, path, file) {
        const headers = {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + (token || SUPABASE_KEY),
          'Content-Type': file.type
        };
        const r = await fetch(SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path, {
          method: 'POST',
          headers: headers,
          body: file
        });
        if (!r.ok) {
          let errMsg = 'Error desconocido';
          try {
            const e = await r.json();
            errMsg = e.message || e.error || JSON.stringify(e);
          } catch (jsonErr) {
            try {
              errMsg = await r.text();
            } catch (txtErr) {
              errMsg = r.statusText || String(r.status);
            }
          }
          throw new Error(errMsg);
        }
        return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + path;
      }
      async function updateUser(data) {
        const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
          method: 'PUT',
          headers: h(),
          body: JSON.stringify(data)
        });
        if (!r.ok) {
          let errMsg = 'Error al actualizar usuario';
          try {
            const e = await r.json();
            errMsg = e.message || e.error || JSON.stringify(e);
          } catch (jsonErr) {
            try {
              errMsg = await r.text();
            } catch (txtErr) {
              errMsg = r.statusText || String(r.status);
            }
          }
          throw new Error(errMsg);
        }
        const d = await r.json();
        user = d.user || d;
        saveSession(token, user, refreshToken);
        return d;
      }
      async function recoverPassword(email) {
        const r = await fetch(SUPABASE_URL + '/auth/v1/recover', {
          method: 'POST',
          headers: base,
          body: JSON.stringify({ email: email })
        });
        if (!r.ok) {
          let errMsg = 'Error al enviar correo de recuperación';
          try {
            const e = await r.json();
            errMsg = e.error_description || e.message || errMsg;
          } catch(err) {}
          throw new Error(errMsg);
        }
        return r.json().catch(() => ({}));
      }
      function setToken(t, u, rt) {
        saveSession(t, u, rt);
      }
      function getToken() { return token; }
      return { signUp, signIn, signOut, getUser, query, insert, update, remove, uploadFile, updateUser, recoverPassword, setToken, getToken, loadSession, verifySession };
    })();

    // ── Auth UI ──
    function switchAuthTab(tab) {
      const tabsEl = document.querySelector('.auth-tabs');
      if (tabsEl) {
        tabsEl.style.display = (tab === 'forgot' || tab === 'reset') ? 'none' : 'flex';
      }
      document.querySelectorAll('.auth-tab').forEach((t, i) => t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register')));
      
      const lf = document.getElementById('auth-form-login');
      const rf = document.getElementById('auth-form-register');
      const ff = document.getElementById('auth-form-forgot');
      const rstf = document.getElementById('auth-form-reset');

      if (lf) lf.style.display = tab === 'login' ? 'flex' : 'none';
      if (rf) rf.style.display = tab === 'register' ? 'flex' : 'none';
      if (ff) ff.style.display = tab === 'forgot' ? 'flex' : 'none';
      if (rstf) rstf.style.display = tab === 'reset' ? 'flex' : 'none';

      document.getElementById('auth-error').classList.remove('show');
      document.getElementById('auth-success').classList.remove('show');
    }
    function showAuthError(m) { const e = document.getElementById('auth-error'); e.textContent = m; e.classList.add('show'); document.getElementById('auth-success').classList.remove('show'); }
    function showAuthSuccess(m) { const e = document.getElementById('auth-success'); e.textContent = m; e.classList.add('show'); document.getElementById('auth-error').classList.remove('show'); }
    function showLoading(v) { document.getElementById('loading-overlay').classList.toggle('show', v); }

    window.toast = function(msg, type = 'info', duration = 3800) {
      try {
        let container = document.getElementById('syntracker-toast-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'syntracker-toast-container';
          container.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:999999; display:flex; flex-direction:column; gap:10px; pointer-events:none; max-width:380px; width:calc(100% - 48px);';
          document.body.appendChild(container);
        }

        const toastEl = document.createElement('div');
        toastEl.style.cssText = 'pointer-events:auto; display:flex; align-items:center; gap:10px; padding:12px 16px; border-radius:10px; font-size:12.5px; font-weight:600; font-family:system-ui, -apple-system, sans-serif; box-shadow:0 12px 28px rgba(0,0,0,0.5); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); transform:translateY(12px); opacity:0; transition:all 0.25s cubic-bezier(0.16, 1, 0.3, 1);';

        let bg = 'rgba(24, 24, 27, 0.95)';
        let border = '1px solid rgba(255,255,255,0.12)';
        let textColor = '#f8fafc';
        let iconHtml = 'ℹ️';

        if (type === 'success') {
          bg = 'rgba(16, 36, 24, 0.96)';
          border = '1px solid rgba(74, 222, 128, 0.35)';
          textColor = '#86efac';
          iconHtml = '✓';
        } else if (type === 'error') {
          bg = 'rgba(45, 15, 15, 0.96)';
          border = '1px solid rgba(239, 68, 68, 0.35)';
          textColor = '#fca5a5';
          iconHtml = '✕';
        } else if (type === 'warning') {
          bg = 'rgba(45, 35, 10, 0.96)';
          border = '1px solid rgba(234, 179, 8, 0.4)';
          textColor = '#fde047';
          iconHtml = '⚠️';
        }

        toastEl.style.background = bg;
        toastEl.style.border = border;
        toastEl.style.color = textColor;

        const safeMsg = String(msg || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        toastEl.innerHTML = `
          <span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; font-size:11px; font-weight:800; flex-shrink:0;">${iconHtml}</span>
          <span style="flex:1; line-height:1.4;">${safeMsg}</span>
        `;

        container.appendChild(toastEl);
        requestAnimationFrame(() => {
          toastEl.style.transform = 'translateY(0)';
          toastEl.style.opacity = '1';
        });

        setTimeout(() => {
          toastEl.style.transform = 'translateY(12px)';
          toastEl.style.opacity = '0';
          setTimeout(() => {
            if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
          }, 300);
        }, duration);
      } catch (tErr) {
        console.log('[Toast]', msg);
      }
    };
    const toast = window.toast;

    function togglePassword() {
      const input = document.getElementById('login-pass');
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);
    }
    document.addEventListener('click', function(e) {
      if (e.target.closest('.auth-input-eye')) togglePassword();
    });

    async function doLogin() {
      const email = document.getElementById('login-email').value.trim(), pass = document.getElementById('login-pass').value;
      if (!email || !pass) return showAuthError('Completa todos los campos');
      showLoading(true);
      try { await sb.signIn(email, pass); await initApp(); }
      catch (e) { showAuthError(e.message); } finally { showLoading(false); }
    }
    async function doRegister() {
      const name = document.getElementById('reg-name').value.trim(), email = document.getElementById('reg-email').value.trim(), pass = document.getElementById('reg-pass').value;
      if (!name || !email || !pass) return showAuthError('Completa todos los campos');
      if (pass.length < 6) return showAuthError('La contraseña debe tener al menos 6 caracteres');
      showLoading(true);
      try {
        await sb.signUp(email, pass, name);
        showAuthSuccess('¡Cuenta creada con éxito! Ya puedes iniciar sesión.');
        switchAuthTab('login'); document.getElementById('login-email').value = email;
      } catch (e) { showAuthError(e.message); } finally { showLoading(false); }
    }
    async function doSendRecovery() {
      const emailEl = document.getElementById('forgot-email');
      const email = emailEl ? emailEl.value.trim() : '';
      if (!email) return showAuthError('Ingresa tu correo electrónico registrado');
      showLoading(true);
      try {
        await sb.recoverPassword(email);
        showAuthSuccess('¡Correo enviado! Revisa tu bandeja de entrada o spam para restablecer tu contraseña.');
        if (emailEl) emailEl.value = '';
      } catch (e) {
        showAuthError(e.message || 'Error al enviar correo de recuperación');
      } finally {
        showLoading(false);
      }
    }
    async function doResetPassword() {
      const p1El = document.getElementById('reset-pass');
      const p2El = document.getElementById('reset-pass-confirm');
      const p1 = p1El ? p1El.value : '';
      const p2 = p2El ? p2El.value : '';
      if (!p1 || !p2) return showAuthError('Completa todos los campos');
      if (p1.length < 6) return showAuthError('La contraseña debe tener al menos 6 caracteres');
      if (p1 !== p2) return showAuthError('Las contraseñas no coinciden');
      showLoading(true);
      try {
        await sb.updateUser({ password: p1 });
        showAuthSuccess('¡Contraseña actualizada con éxito! Ya puedes iniciar sesión con tu nueva clave.');
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, null, window.location.pathname);
        }
        setTimeout(function () {
          switchAuthTab('login');
          if (p1El) p1El.value = '';
          if (p2El) p2El.value = '';
        }, 2200);
      } catch (e) {
        showAuthError(e.message || 'Error al actualizar contraseña');
      } finally {
        showLoading(false);
      }
    }
    function checkRecoveryFlow() {
      try {
        var hash = window.location.hash || '';
        var search = window.location.search || '';
        var rawStr = hash.startsWith('#') ? hash.substring(1) : (search.startsWith('?') ? search.substring(1) : '');
        if (!rawStr) return;
        var params = new URLSearchParams(rawStr);
        var type = params.get('type');
        var accessToken = params.get('access_token');
        var errorCode = params.get('error_code');
        var errorDesc = params.get('error_description');

        if (errorCode || errorDesc) {
          showAuthError(decodeURIComponent(errorDesc || errorCode));
          return;
        }

        if (type === 'recovery' && accessToken) {
          sb.setToken(accessToken);
          switchAuthTab('reset');
          showAuthSuccess('Ingresa tu nueva contraseña para actualizar el acceso a tu cuenta.');
        }
      } catch (err) {
        console.error('Error checking recovery flow:', err);
      }
    }
    async function doLogout() {
      showLoading(true);
      try {
        await sb.signOut();
      } catch (e) {}
      trades = [];
      accounts = [];
      userConfirmations = [];
      document.documentElement.classList.remove('has-session');
      const authScreen = document.getElementById('auth-screen');
      if (authScreen) authScreen.style.display = 'flex';
      showLoading(false);
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      const lf = document.getElementById('auth-form-login');
      const rf = document.getElementById('auth-form-register');
      const ff = document.getElementById('auth-form-forgot');
      const rstf = document.getElementById('auth-form-reset');

      if (lf && lf.style.display !== 'none') doLogin();
      else if (rf && rf.style.display !== 'none') doRegister();
      else if (ff && ff.style.display !== 'none') doSendRecovery();
      else if (rstf && rstf.style.display !== 'none') doResetPassword();
    });

    // ── App state ──
    let trades = [];
    let accounts = [];
    let userConfirmations = [];

    function tradeFromRow(t) {
      let rawNotes = t.notes || '';
      let extractedWhy = null;

      // Extraer [MOTIVO:...]
      if (rawNotes.startsWith('[MOTIVO:')) {
        const endIdx = rawNotes.indexOf(']');
        if (endIdx > -1) {
          extractedWhy = rawNotes.substring(8, endIdx);
          rawNotes = rawNotes.substring(endIdx + 1).trim();
        }
      }

      // Extraer y parsear [GOLDFX_META]{...} — invisible en la UI
      var goldfxMeta = {};
      var metaIdx = rawNotes.indexOf('[GOLDFX_META]');
      if (metaIdx > -1) {
        try { goldfxMeta = JSON.parse(rawNotes.substring(metaIdx + 13)); } catch(e) {}
        rawNotes = rawNotes.substring(0, metaIdx).trim();
      }

      // Parsear fotos (soporte multi-imagen)
      let parsedPhotos = [];
      if (t.photo) {
        if (typeof t.photo === 'string') {
          const trimmed = t.photo.trim();
          if (trimmed.startsWith('[')) {
            try {
              const arr = JSON.parse(trimmed);
              if (Array.isArray(arr)) parsedPhotos = arr;
            } catch(e) {
              parsedPhotos = [t.photo];
            }
          } else {
            parsedPhotos = [t.photo];
          }
        } else if (Array.isArray(t.photo)) {
          parsedPhotos = t.photo;
        }
      }

      return {
        id: t.id, date: t.date, account: t.account, asset: t.asset, side: t.side,
        entryTime: t.entry_time || '—', exitTime: t.exit_time || '—',
        pnl: parseFloat(t.pnl) || 0, rr: parseFloat(t.rr) || 0,
        session: t.session || '—', setup: t.setup || '—', news: t.news || 'no',
        photos: parsedPhotos,
        photo: parsedPhotos[0] || null,
        notes: rawNotes, plan: t.plan || null,
        plan_why: extractedWhy || t.plan_why || null,
        confirmations: Array.isArray(t.confirmations) ? t.confirmations : [],
        // Campos del motor GoldFX
        entry_type:       goldfxMeta.entry_type       || null,
        market_cond:      goldfxMeta.market_cond      || null,
        result_type:      goldfxMeta.result_type      || null,
        emotion:          goldfxMeta.emotion          || null,
        audit:            goldfxMeta.audit            || {},
        discipline_score: goldfxMeta.discipline_score != null ? goldfxMeta.discipline_score : null
      };
    }

    // ── Global Countries & Flags Data ──
    const COUNTRIES_LIST = [
      { code: 'CO', name: 'Colombia', flag: '🇨🇴', flagImg: 'https://flagcdn.com/w160/co.png' },
      { code: 'MX', name: 'México', flag: '🇲🇽', flagImg: 'https://flagcdn.com/w160/mx.png' },
      { code: 'AR', name: 'Argentina', flag: '🇦🇷', flagImg: 'https://flagcdn.com/w160/ar.png' },
      { code: 'CL', name: 'Chile', flag: '🇨🇱', flagImg: 'https://flagcdn.com/w160/cl.png' },
      { code: 'PE', name: 'Perú', flag: '🇵🇪', flagImg: 'https://flagcdn.com/w160/pe.png' },
      { code: 'ES', name: 'España', flag: '🇪🇸', flagImg: 'https://flagcdn.com/w160/es.png' },
      { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', flagImg: 'https://flagcdn.com/w160/us.png' },
      { code: 'EC', name: 'Ecuador', flag: '🇪🇨', flagImg: 'https://flagcdn.com/w160/ec.png' },
      { code: 'VE', name: 'Venezuela', flag: '🇻🇪', flagImg: 'https://flagcdn.com/w160/ve.png' },
      { code: 'BO', name: 'Bolivia', flag: '🇧🇴', flagImg: 'https://flagcdn.com/w160/bo.png' },
      { code: 'UY', name: 'Uruguay', flag: '🇺🇾', flagImg: 'https://flagcdn.com/w160/uy.png' },
      { code: 'PY', name: 'Paraguay', flag: '🇵🇾', flagImg: 'https://flagcdn.com/w160/py.png' },
      { code: 'PA', name: 'Panamá', flag: '🇵🇦', flagImg: 'https://flagcdn.com/w160/pa.png' },
      { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', flagImg: 'https://flagcdn.com/w160/cr.png' },
      { code: 'DO', name: 'Rep. Dominicana', flag: '🇩🇴', flagImg: 'https://flagcdn.com/w160/do.png' },
      { code: 'GT', name: 'Guatemala', flag: '🇬🇹', flagImg: 'https://flagcdn.com/w160/gt.png' },
      { code: 'SV', name: 'El Salvador', flag: '🇸🇻', flagImg: 'https://flagcdn.com/w160/sv.png' },
      { code: 'HN', name: 'Honduras', flag: '🇭🇳', flagImg: 'https://flagcdn.com/w160/hn.png' },
      { code: 'BR', name: 'Brasil', flag: '🇧🇷', flagImg: 'https://flagcdn.com/w160/br.png' },
      { code: 'CA', name: 'Canadá', flag: '🇨🇦', flagImg: 'https://flagcdn.com/w160/ca.png' },
      { code: 'UK', name: 'Reino Unido', flag: '🇬🇧', flagImg: 'https://flagcdn.com/w160/gb.png' },
      { code: 'DE', name: 'Alemania', flag: '🇩🇪', flagImg: 'https://flagcdn.com/w160/de.png' },
      { code: 'FR', name: 'Francia', flag: '🇫🇷', flagImg: 'https://flagcdn.com/w160/fr.png' },
      { code: 'IT', name: 'Italia', flag: '🇮🇹', flagImg: 'https://flagcdn.com/w160/it.png' },
      { code: 'OTHER', name: 'Internacional', flag: '🌐', flagImg: 'https://flagcdn.com/w160/un.png' }
    ];

    const COUNTRIES_MAP = {};
    COUNTRIES_LIST.forEach(function (c) {
      COUNTRIES_MAP[c.code] = c;
    });

    function getUserCountryInfo(code) {
      let c = (code || 'CO').toUpperCase();
      if (COUNTRIES_MAP[c]) return COUNTRIES_MAP[c];
      return { code: 'OTHER', name: 'Internacional', flag: '🌐', flagImg: 'https://flagcdn.com/w160/un.png' };
    }

    // ── ROLES DE EQUIPO & STAFF OFICIAL (GOLD FX) ──
    const STAFF_ROLES = {
      'parkjiminfromsara@gmail.com': {
        role: 'superadmin',
        label: 'Desarrolladora',
        display: '👩‍💻 Desarrolladora',
        badgeStyle: 'background:rgba(168,85,247,0.18); color:#c084fc; border:1px solid rgba(168,85,247,0.4);',
        adminTitle: '👩‍💻 Desarrolladora (Sara)'
      },
      'estebangoldfx@gmail.com': {
        role: 'mentor',
        label: 'Mentor',
        display: '👨‍🏫 Mentor',
        badgeStyle: 'background:rgba(234,179,8,0.18); color:#facc15; border:1px solid rgba(234,179,8,0.4);',
        adminTitle: '👨‍🏫 Mentor Gold FX (Esteban)'
      },
      'infogoldfx@gmail.com': {
        role: 'admin',
        label: 'Admin',
        display: '🛡️ Admin',
        badgeStyle: 'background:rgba(14,165,233,0.18); color:#38bdf8; border:1px solid rgba(14,165,233,0.4);',
        adminTitle: '🛡️ Administrador (Steven)'
      },
      'psico.goldfx@gmail.com': {
        role: 'psicologa',
        label: 'Psicóloga',
        display: '🧠 Psicóloga',
        badgeStyle: 'background:rgba(244,63,94,0.18); color:#fb7185; border:1px solid rgba(244,63,94,0.4);',
        adminTitle: '🧠 Psicóloga Gold FX'
      }
    };

    const STAFF_IDS = {
      '8ffa85d8-cf48-4b2b-a720-98ff14e99553': 'parkjiminfromsara@gmail.com',
      '26b36306-b12c-481c-b43e-fe4f1452a210': 'estebangoldfx@gmail.com',
      '84061dcc-f1dd-4a1f-8e2a-bbbe63045787': 'infogoldfx@gmail.com',
      '2d09f625-f966-47f6-9b14-392e743d1a38': 'psico.goldfx@gmail.com'
    };

    function getStaffInfo(user) {
      const u = user || (typeof sb !== 'undefined' ? sb.getUser() : null);
      if (!u) return null;
      const email = (u.email || (u.user_metadata && u.user_metadata.email) || '').toLowerCase().trim();
      const userId = (u.id || '').trim();
      if (STAFF_ROLES[email]) return STAFF_ROLES[email];
      if (STAFF_IDS[userId] && STAFF_ROLES[STAFF_IDS[userId]]) return STAFF_ROLES[STAFF_IDS[userId]];

      const meta = u.user_metadata || {};
      const metaRole = (meta.role || '').toLowerCase().trim();
      if (metaRole === 'superadmin') {
        return {
          role: 'superadmin',
          label: meta.role_label || 'Desarrolladora',
          display: '👩‍💻 ' + (meta.role_label || 'Desarrolladora'),
          badgeStyle: 'background:rgba(168,85,247,0.18); color:#c084fc; border:1px solid rgba(168,85,247,0.4);',
          adminTitle: '👩‍💻 Desarrolladora'
        };
      }
      if (metaRole === 'mentor') {
        return {
          role: 'mentor',
          label: meta.role_label || 'Mentor',
          display: '👨‍🏫 ' + (meta.role_label || 'Mentor'),
          badgeStyle: 'background:rgba(234,179,8,0.18); color:#facc15; border:1px solid rgba(234,179,8,0.4);',
          adminTitle: '👨‍🏫 Mentor Gold FX'
        };
      }
      if (metaRole === 'psicologa' || metaRole === 'psicóloga' || metaRole === 'psicologo' || metaRole === 'psicólogo') {
        return {
          role: 'psicologa',
          label: meta.role_label || 'Psicóloga',
          display: '🧠 ' + (meta.role_label || 'Psicóloga'),
          badgeStyle: 'background:rgba(244,63,94,0.18); color:#fb7185; border:1px solid rgba(244,63,94,0.4);',
          adminTitle: '🧠 Psicóloga Gold FX'
        };
      }
      if (metaRole === 'admin' || metaRole === 'administrador') {
        return {
          role: 'admin',
          label: meta.role_label || 'Admin',
          display: '🛡️ ' + (meta.role_label || 'Admin'),
          badgeStyle: 'background:rgba(14,165,233,0.18); color:#38bdf8; border:1px solid rgba(14,165,233,0.4);',
          adminTitle: '🛡️ Administrador'
        };
      }
      return null;
    }

    function getAdminRole(user) {
      const staff = getStaffInfo(user);
      return staff ? staff.role : null;
    }

    function isAdminUser(user) {
      return getAdminRole(user) !== null;
    }

    function isSuperAdminUser(user) {
      return getAdminRole(user) === 'superadmin';
    }

    function isSaraUser(user) {
      const u = user || (typeof sb !== 'undefined' ? sb.getUser() : null);
      if (!u) return false;
      const email = (u.email || (u.user_metadata && u.user_metadata.email) || '').toLowerCase().trim();
      const userId = (u.id || '').trim();
      return email === 'parkjiminfromsara@gmail.com' ||
             userId === '8ffa85d8-cf48-4b2b-a720-98ff14e99553' ||
             (u.user_metadata && u.user_metadata.role === 'superadmin');
    }

    function getUserBadgeInfo(user) {
      const u = user || (typeof sb !== 'undefined' ? sb.getUser() : null);
      if (!u) return null;
      const staff = getStaffInfo(u);
      if (staff) {
        return { label: staff.display, style: staff.badgeStyle, isStaff: true };
      }
      const meta = u.user_metadata || {};
      const m = ((meta.membership || '') + '').toUpperCase().trim();
      if (m === 'VIP') {
        return { label: '🟡 VIP', style: 'background:rgba(234,179,8,0.18); color:#facc15; border:1px solid rgba(234,179,8,0.4);', isStaff: false };
      }
      if (m === 'LIFETIME') {
        return { label: '🟣 Lifetime', style: 'background:rgba(168,85,247,0.18); color:#c084fc; border:1px solid rgba(168,85,247,0.4);', isStaff: false };
      }
      if (m === 'ANUAL') {
        return { label: '🔵 Anual', style: 'background:rgba(59,130,246,0.18); color:#60a5fa; border:1px solid rgba(59,130,246,0.4);', isStaff: false };
      }
      if (m === 'MENSUAL') {
        return { label: '🟢 Mensual', style: 'background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.4);', isStaff: false };
      }
      return null;
    }

    window.STAFF_ROLES = STAFF_ROLES;
    window.STAFF_IDS = STAFF_IDS;
    window.getStaffInfo = getStaffInfo;
    window.getAdminRole = getAdminRole;
    window.isAdminUser = isAdminUser;
    window.isSuperAdminUser = isSuperAdminUser;
    window.isSaraUser = isSaraUser;
    window.getUserBadgeInfo = getUserBadgeInfo;

    function getUserProfileData(user) {
      if (!user) user = sb.getUser();
      if (!user) return { name: 'Estudiante', username: '', country: 'CO', email: '', avatarUrl: null };
      
      const meta = user.user_metadata || {};
      let name = meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'Estudiante');
      let username = meta.username || '';
      let country = meta.country || 'CO';
      let avatarUrl = meta.avatar_url || null;

      if (username.startsWith('@')) username = username.substring(1);

      return {
        name: name,
        username: username,
        country: country,
        email: user.email || '',
        avatarUrl: avatarUrl
      };
    }

    function renderUserAvatar(user, name) {
      const avs = document.querySelectorAll('.user-av');
      if (!avs.length) return;
      let avatarUrl = user && user.user_metadata && user.user_metadata.avatar_url;
      avs.forEach(av => {
        if (avatarUrl) {
          av.innerHTML = `<img src="${avatarUrl}" alt="Avatar" />`;
          av.style.border = '2px solid #ffcd1b';
          av.style.background = 'none';
          av.style.borderRadius = '50%';
        } else {
          const letter = (name && name.trim()) ? name.trim()[0].toUpperCase() : 'E';
          av.textContent = letter;
          av.style.border = 'none';
          av.style.background = 'linear-gradient(135deg, #ffcd1b, #a67726)';
          av.style.borderRadius = '10px';
        }
      });
    }

    function renderUserProfile(user) {
      if (!user) user = sb.getUser();
      if (!user) return;
      const data = getUserProfileData(user);
      const cInfo = getUserCountryInfo(data.country);

      // Sidebar items
      const nameEl = document.querySelector('#sidebar-user-name .user-name-text') || document.querySelector('.user-name');
      const flagEl = document.getElementById('sidebar-user-flag');
      const handleEl = document.getElementById('sidebar-user-handle') || document.querySelector('.user-email');
      const roleBadgeEl = document.getElementById('sidebar-user-role-badge');

      if (nameEl) nameEl.textContent = data.name;
      if (flagEl) {
        flagEl.textContent = cInfo.flag;
        flagEl.title = cInfo.name;
      }
      if (handleEl) {
        handleEl.textContent = data.username ? ('@' + data.username) : (data.email || '—');
      }
      if (roleBadgeEl) {
        const bInfo = getUserBadgeInfo(user);
        if (bInfo) {
          roleBadgeEl.textContent = bInfo.label;
          roleBadgeEl.style.cssText = `font-size:9.5px; font-weight:800; padding:1.5px 7px; border-radius:999px; ${bInfo.style}`;
          roleBadgeEl.style.display = 'inline-block';
        } else {
          roleBadgeEl.style.display = 'none';
        }
      }

      // Banner de bienvenida VIP si está visible
      const studentWelcomeName = document.getElementById('vip-student-welcome-name');
      if (studentWelcomeName) studentWelcomeName.textContent = 'Hola, ' + data.name;

      renderUserAvatar(user, data.name);
    }

    function openProfileModal() {
      const user = sb.getUser();
      if (!user) return;
      const data = getUserProfileData(user);

      const nameInput = document.getElementById('prof-name');
      const userInput = document.getElementById('prof-username');
      const countryInput = document.getElementById('prof-country');
      const emailInput = document.getElementById('prof-email');

      if (nameInput) nameInput.value = data.name;
      if (userInput) userInput.value = data.username;
      if (countryInput) countryInput.value = data.country || 'CO';
      if (emailInput) emailInput.value = data.email;

      renderUserAvatar(user, data.name);
      document.getElementById('profile-modal').classList.add('open');
    }

    async function saveUserProfile() {
      const user = sb.getUser();
      if (!user) return;

      const name = (document.getElementById('prof-name').value || '').trim();
      let username = (document.getElementById('prof-username').value || '').trim();
      if (username.startsWith('@')) username = username.substring(1).trim();
      const country = document.getElementById('prof-country').value || 'CO';

      if (!name) {
        alert('Por favor ingresa tu nombre completo.');
        return;
      }

      showLoading(true);
      try {
        const updateData = {
          full_name: name,
          username: username,
          country: country
        };

        // 1. Update auth user metadata
        await sb.updateUser({ data: updateData });
        if (!user.user_metadata) user.user_metadata = {};
        user.user_metadata.full_name = name;
        user.user_metadata.username = username;
        user.user_metadata.country = country;

        // 2. Update profiles table (only existing table columns: full_name, country)
        try {
          await sb.update('profiles', user.id, {
            full_name: name,
            country: country
          });
        } catch (pe) {
          console.warn('Error sincronizando tabla profiles:', pe);
        }

        // 3. Update tournament participants table if registered
        try {
          const myParts = await sb.query('tournament_participants', { filter: 'user_id=eq.' + user.id });
          if (Array.isArray(myParts)) {
            for (const pt of myParts) {
              await sb.update('tournament_participants', pt.id, {
                user_name: name + (username ? ` (@${username})` : ''),
                country: country
              });
            }
          }
        } catch (tpErr) {}

        try {
        renderUserProfile(user);
        checkAdminNavVisibility();
      } catch (uiNavErr) {
        console.error('Error inicializando perfil/navegación admin:', uiNavErr);
      }
        closeModal('profile-modal');
        alert('¡Perfil actualizado con éxito!');
      } catch (err) {
        console.error('Error al guardar el perfil:', err);
        alert('Error al guardar el perfil: ' + (err.message || err));
      } finally {
        showLoading(false);
      }
    }

    async function handleAvatarChange(input) {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert("La imagen excede el límite de 2MB.");
        input.value = "";
        return;
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert("Formato no soportado. Usa JPEG, PNG o WebP.");
        input.value = "";
        return;
      }
      const user = sb.getUser();
      if (!user) return;
      showLoading(true);
      try {
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `${user.id}_${Date.now()}.${ext}`;
        const publicUrl = await sb.uploadFile('Avatars', fileName, file);
        await sb.updateUser({ data: { avatar_url: publicUrl } });
        if (!user.user_metadata) user.user_metadata = {};
        user.user_metadata.avatar_url = publicUrl;

        try {
          await sb.update('profiles', user.id, { avatar_url: publicUrl });
        } catch (dbErr) {
          try {
            await sb.update('users', user.id, { avatar_url: publicUrl });
          } catch (dbErr2) {}
        }
        try {
          const myParts = await sb.query('tournament_participants', { filter: 'user_id=eq.' + user.id });
          if (Array.isArray(myParts)) {
            for (const pt of myParts) {
              await sb.update('tournament_participants', pt.id, { avatar_url: publicUrl });
            }
          }
        } catch (tpErr) {}
        
        renderUserProfile(user);
        alert("Foto de perfil actualizada con éxito.");
      } catch (err) {
        console.error("Error al actualizar la foto de perfil:", err);
        alert("Error al actualizar la foto de perfil: " + err.message);
      } finally {
        showLoading(false);
        input.value = "";
      }
    }