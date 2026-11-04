
    async function initApp() {
      const user = sb.getUser(); if (!user) return;
      const authScreen = document.getElementById('auth-screen');
      if (authScreen) authScreen.style.display = 'none';
      document.documentElement.classList.add('has-session');

      // Sincronizar info de perfil desde profiles si user_metadata no lo tiene
      try {
        const profileData = await sb.query('profiles', { filter: 'id=eq.' + user.id });
        if (profileData && profileData.length > 0) {
          const pr = profileData[0];
          if (!user.user_metadata) user.user_metadata = {};
          if (pr.full_name && !user.user_metadata.full_name) user.user_metadata.full_name = pr.full_name;
          if (pr.country && !user.user_metadata.country) user.user_metadata.country = pr.country;
        }
      } catch (e) {
        console.warn('Error leyendo tabla profiles:', e);
      }

      try {
        renderUserProfile(user);
        checkAdminNavVisibility();
      } catch (uiNavErr) {
        console.error('Error inicializando perfil/navegación admin:', uiNavErr);
      }

      const datePill = document.getElementById('date-pill');
      if (datePill) datePill.textContent = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
      showLoading(true);
      try {
        await Promise.all([loadAccounts(), loadTrades(), loadConfirmations()]);
      } catch (loadErr) {
        console.error('Error cargando datos del journal:', loadErr);
      }
      try {
        buildAccountFilter();
        renderAll();
      } catch (renderErr) {
        console.error('Error renderizando journal:', renderErr);
      } finally {
        showLoading(false);
      }
    }

    let auditedStudent = null;
    window.auditedStudent = auditedStudent;

    // ── Multi-Photo Management State ──
    let currentPhotosData = [];
    let editPhotosData = [];
    window.currentPhotosData = currentPhotosData;
    window.editPhotosData = editPhotosData;

    async function loadTrades() {
      const u = sb.getUser();
      if (!u) return;
      try {
        let targetId = u.id;
        let useAdmin = false;
        if (auditedStudent && auditedStudent.id) {
          targetId = auditedStudent.id;
          useAdmin = true;
        }

        let data;
        if (useAdmin) {
          const res = await fetch(SUPABASE_URL + '/rest/v1/trades?select=*&user_id=eq.' + targetId + '&order=date.asc,created_at.asc', {
            headers: { 'apikey': ADMIN_SERVICE_KEY, 'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY }
          });
          data = res.ok ? await res.json() : [];
        } else {
          data = await sb.query('trades', { select: '*', filter: 'user_id=eq.' + targetId, order: 'date.asc,created_at.asc' });
        }
        trades = (Array.isArray(data) ? data : []).map(tradeFromRow);
      } catch (e) {
        console.error('Error cargando trades:', e);
        trades = [];
      }
    }

    async function loadAccounts() {
      const u = sb.getUser();
      if (!u) return;
      try {
        let targetId = u.id;
        let useAdmin = false;
        if (auditedStudent && auditedStudent.id) {
          targetId = auditedStudent.id;
          useAdmin = true;
        }

        let data;
        if (useAdmin) {
          const res = await fetch(SUPABASE_URL + '/rest/v1/accounts?select=*&user_id=eq.' + targetId + '&order=created_at.asc', {
            headers: { 'apikey': ADMIN_SERVICE_KEY, 'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY }
          });
          data = res.ok ? await res.json() : [];
        } else {
          data = await sb.query('accounts', { select: '*', filter: 'user_id=eq.' + targetId, order: 'created_at.asc' });
        }

        if (Array.isArray(data) && data.length > 0) {
          accounts = data.map(function (a) {
            return {
              id: a.id, name: a.name, type: a.type, broker: a.broker || '',
              initialBalance: parseFloat(a.initial_balance) || 0, icon: a.icon || '💰',
              iconClass: a.type === 'Capital Real' ? 'gold' : 'target'
            };
          });
        } else { accounts = []; }
      } catch (e) {
        console.error('Error cargando cuentas:', e);
        accounts = [];
      }
      refreshAccountSelects();
    }

    async function loadConfirmations() {
      const u = sb.getUser();
      if (!u) return;
      try {
        const data = await sb.query('user_confirmations', { select: '*', filter: 'user_id=eq.' + u.id, order: 'created_at.asc' });
        userConfirmations = Array.isArray(data) ? data : [];
      } catch (e) {
        console.error('Error cargando confirmaciones:', e);
        userConfirmations = [];
      }
    }



    function renderConfGrid(containerId, selectedArr) {
      const container = document.getElementById(containerId);
      if (!container) return;
      if (!userConfirmations.length) {
        container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0;">No tienes confirmaciones creadas.</div>';
        return;
      }
      container.innerHTML = userConfirmations.map(function(c) {
        const isChecked = selectedArr && selectedArr.indexOf(c.name) !== -1;
        return '<label class="conf-item"><input type="checkbox" value="' + c.name.replace(/"/g, '&quot;') + '" ' + (isChecked ? 'checked' : '') + '> <span>' + c.name + '</span></label>';
      }).join('');
    }

    function getSelectedConf(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return [];
      const checked = container.querySelectorAll('input[type="checkbox"]:checked');
      return Array.from(checked).map(function(cb) { return cb.value; });
    }

    function refreshAccountSelects() {
      const opts = accounts.map(function (a) { return '<option>' + a.name + '</option>'; }).join('');
      const sel = document.getElementById('tm-account');
      if (sel) sel.innerHTML = opts || '<option>Sin cuentas</option>';
      const esel = document.getElementById('edit-account');
      if (esel) esel.innerHTML = opts || '<option>Sin cuentas</option>';
    }

    function togglePlanWhy(prefix) {
      var val = document.getElementById(prefix + '-plan').value;
      var wrap = document.getElementById(prefix + '-plan-why-wrap');
      if (wrap) wrap.style.display = (val === 'No' || val === 'Medio') ? 'block' : 'none';
    }

    let activeBePrefix = 'tm';
    function setBE(prefix) {
      activeBePrefix = prefix;
      const bePnl = document.getElementById('be-calc-pnl');
      if (bePnl) bePnl.value = '';
      openModal('be-calc-modal');
    }
    function applyBe() {
      const pnlVal = parseFloat(document.getElementById('be-calc-pnl').value) || 0;
      
      const pnlInput = document.getElementById(activeBePrefix + '-pnl');
      const rrInput = document.getElementById(activeBePrefix + '-rr');
      if (pnlInput) pnlInput.value = pnlVal.toFixed(2);
      if (rrInput) rrInput.value = '0.00';
      
      const resSelId = activeBePrefix + '-result-sel';
      const resHiddenId = activeBePrefix + '-result';
      selectSetupBtnByVal(resSelId, resHiddenId, 'BE');
      
      closeModal('be-calc-modal');
    }
    window.setBE = setBE;
    window.applyBe = applyBe;




    // ══════════════════════════════════════════════════════════
    // GOLDFX DISCIPLINE SCORE ENGINE
    // ══════════════════════════════════════════════════════════
    function calculateDisciplineScore() {
      var score = 0;

      // ── Categoría 1: Cumplimiento del Setup (Máx 40 pts) ──
      var cat1 = {
        'aud-setup-condicion':   6,
        'aud-setup-expansion':   6,
        'aud-setup-contraccion': 6,
        'aud-setup-validacion':  6,
        'aud-setup-nivel':       6,
        'aud-setup-gatillo':     10
      };
      Object.keys(cat1).forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.checked) score += cat1[id];
      });

      // ── Categoría 2: Gestión de Riesgo (Máx 30 pts) ──
      var cat2 = {
        'aud-risk-unaop':       15,  // Una operación diaria
        'aud-risk-nosobreoperar': 10, // No sobreoperar
        'aud-risk-rrmin':        5   // RR mínimo respetado
      };
      Object.keys(cat2).forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.checked) score += cat2[id];
      });

      // ── Categoría 3: Ejecución (Máx 20 pts) ──
      var cat3 = {
        'aud-exec-params':      10,  // Todos los parámetros
        'aud-exec-noperseguir':  5,  // No perseguir precio
        'aud-exec-notarde':      5   // No entrar tarde
      };
      Object.keys(cat3).forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.checked) score += cat3[id];
      });

      // ── Categoría 4: Comportamiento (Máx 10 pts) ──
      var cat4 = {
        'aud-beh-journal':   5,  // Journal completado
        'aud-beh-reflexion': 5   // Reflexión escrita
      };
      Object.keys(cat4).forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.checked) score += cat4[id];
      });

      // ── Penalizaciones (Restas) ──
      var penalties = {
        'aud-setup-sinconfirm': -10,  // Entró sin confirmación
        'aud-risk-sobreapal':   -15,  // Sobreapalancamiento
        'aud-risk-moversl':     -10,  // Mover SL por miedo
        'aud-risk-aumentar':    -10   // Aumentar riesgo tras pérdida
      };
      Object.keys(penalties).forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.checked) score += penalties[id];
      });

      // ── Control de límites: nunca < 0 ni > 100 ──
      return Math.min(100, Math.max(0, score));
    }

    // ── Add Trade ──
    async function addTrade() {
      const user = sb.getUser();
      if (!user) {
        alert('Debes iniciar sesión para registrar trades.');
        return;
      }

      // ── Validar cuenta seleccionada ──
      let acctVal = (document.getElementById('tm-account') && document.getElementById('tm-account').value) || '';
      if (!acctVal || acctVal === 'Sin cuentas') {
        if (accounts && accounts.length > 0) {
          refreshAccountSelects();
          acctVal = (document.getElementById('tm-account') && document.getElementById('tm-account').value) || accounts[0].name;
        } else {
          alert('Por favor crea una cuenta de trading en la pestaña "Mis Cuentas" antes de registrar tu primer trade.');
          closeModal('trade-modal');
          goTo('cuentas');
          openAcctModal();
          return;
        }
      }

      const finalNotes = (document.getElementById('tm-notes') && document.getElementById('tm-notes').value.trim()) || '';

      // ── Recoger datos de Auditoría ──
      var auditFields = [
        'aud-setup-condicion','aud-setup-expansion','aud-setup-contraccion',
        'aud-setup-validacion','aud-setup-nivel','aud-setup-gatillo','aud-setup-sinconfirm',
        'aud-risk-unaop','aud-risk-nosobreoperar','aud-risk-rrmin',
        'aud-risk-sobreapal','aud-risk-moversl','aud-risk-aumentar',
        'aud-exec-params','aud-exec-noperseguir','aud-exec-notarde',
        'aud-beh-journal','aud-beh-reflexion'
      ];
      var auditData = {};
      auditFields.forEach(function(id) {
        var el = document.getElementById(id);
        auditData[id] = el ? el.checked : false;
      });

      // ── Calcular GoldFX Discipline Score ──
      var disciplineScore = calculateDisciplineScore();

      // ── Empaquetar metadatos en notes (compatible con schema actual) ──
      var entryType  = document.getElementById('tm-entry-type')  ? document.getElementById('tm-entry-type').value  : '';
      var marketCond = document.getElementById('tm-market-cond') ? document.getElementById('tm-market-cond').value : '';
      var resultType = document.getElementById('tm-result')      ? document.getElementById('tm-result').value      : '';
      var emotion    = document.getElementById('tm-emotion')      ? document.getElementById('tm-emotion').value      : '';
      var metaBlock  = '\n[GOLDFX_META]' + JSON.stringify({
        entry_type: entryType || null, market_cond: marketCond || null,
        result_type: resultType || null, emotion: emotion || null,
        audit: auditData, discipline_score: disciplineScore
      });
      var notesWithMeta = (finalNotes || '') + metaBlock;

      const photoPayload = currentPhotosData.length === 0 ? null : (currentPhotosData.length === 1 ? currentPhotosData[0] : JSON.stringify(currentPhotosData));

      const tradeData = {
        user_id: user.id,
        account: acctVal,
        asset: (document.getElementById('tm-asset') && document.getElementById('tm-asset').value.trim()) || 'EURUSD',
        side: (document.getElementById('tm-side') && document.getElementById('tm-side').value) || 'Long',
        entry_time: (document.getElementById('tm-entry') && document.getElementById('tm-entry').value) || null,
        exit_time: (document.getElementById('tm-exit') && document.getElementById('tm-exit').value) || null,
        pnl: parseFloat(document.getElementById('tm-pnl') ? document.getElementById('tm-pnl').value : 0) || 0,
        rr: parseFloat(document.getElementById('tm-rr') ? document.getElementById('tm-rr').value : 0) || 0,
        session: (document.getElementById('tm-session') && document.getElementById('tm-session').value) || 'Londres',
        setup: buildSetupValue('tm-bias', 'tm-tipo'),
        date: (document.getElementById('tm-date') && document.getElementById('tm-date').value) || new Date().toISOString().slice(0, 10),
        photo: photoPayload,
        notes: notesWithMeta
      };

      showLoading(true);
      try {
        const result = await sb.insert('trades', tradeData);
        const saved = Array.isArray(result) ? result[0] : result;
        if (saved && saved.id) {
          trades.push(tradeFromRow(saved));
        } else {
          await loadTrades();
        }
      } catch (e) {
        console.error('Error guardando trade:', e);
        alert('Error al guardar operación: ' + (e.message || e));
        return; // No resetear ni cerrar modal si falló la petición para no perder datos
      } finally {
        showLoading(false);
      }

      // ── Reset del formulario sólo tras guardado exitoso ──
      removePhoto();
      resetSetupSelectors('tm-bias-sel', 'tm-bias', 'tm-tipo-sel', 'tm-tipo');
      // Limpiar resultado seleccionado
      var resultSel = document.getElementById('tm-result-sel');
      if (resultSel) resultSel.querySelectorAll('.setup-btn').forEach(function(b){ b.classList.remove('active'); });
      var resultHidden = document.getElementById('tm-result'); if(resultHidden) resultHidden.value = '';
      // Limpiar checkboxes de auditoría
      auditFields.forEach(function(id){ var el = document.getElementById(id); if(el) el.checked = false; });
      // Limpiar campos de texto y selects
      ['tm-asset','tm-entry','tm-exit','tm-pnl','tm-rr','tm-notes','tm-entry-type','tm-market-cond','tm-emotion'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.value = '';
      });
      closeModal('trade-modal');
      renderAll();
      if (typeof toast === 'function') {
        toast('Operación añadida al Journal con éxito', 'success');
      }
    }

    // ── Edit Trade ──
    function openEditModal(tradeId) {
      const t = trades.find(function (x) { return x.id === tradeId; }); if (!t) return;
      document.getElementById('edit-id').value = t.id;
      document.getElementById('edit-account').value = t.account;
      document.getElementById('edit-asset').value = t.asset;
      document.getElementById('edit-side').value = t.side;
      document.getElementById('edit-entry').value = t.entryTime === '—' ? '' : t.entryTime;
      document.getElementById('edit-exit').value = t.exitTime === '—' ? '' : t.exitTime;
      document.getElementById('edit-pnl').value = t.pnl;
      document.getElementById('edit-rr').value = t.rr;
      document.getElementById('edit-session').value = t.session === '—' ? 'Londres' : t.session;
      // Parse setup string into bias + tipo selectors
      var setupStr = (t.setup && t.setup !== '—') ? t.setup : '';
      resetSetupSelectors('edit-bias-sel', 'edit-bias', 'edit-tipo-sel', 'edit-tipo');
      ['Alcista','Bajista'].forEach(function(v){
        if (setupStr.includes(v)) selectSetupBtnByVal('edit-bias-sel', 'edit-bias', v);
      });
      ['Continuación','Regresión'].forEach(function(v){
        if (setupStr.includes(v)) selectSetupBtnByVal('edit-tipo-sel', 'edit-tipo', v);
      });
      document.getElementById('edit-date').value = t.date;
      document.getElementById('edit-notes').value = t.notes || '';
      // Nuevos campos
      var etEl = document.getElementById('edit-entry-type'); if(etEl) etEl.value = t.entry_type || '';
      var mcEl = document.getElementById('edit-market-cond'); if(mcEl) mcEl.value = t.market_cond || '';
      var emEl = document.getElementById('edit-emotion'); if(emEl) emEl.value = t.emotion || '';
      // Resultado (botones)
      var resSel = document.getElementById('edit-result-sel');
      if(resSel) resSel.querySelectorAll('.setup-btn').forEach(function(b){ b.classList.remove('active'); });
      var resHid = document.getElementById('edit-result'); if(resHid) resHid.value = '';
      if(t.result_type) selectSetupBtnByVal('edit-result-sel', 'edit-result', t.result_type);
      // Fotos
      editPhotosData = (t.photos && t.photos.length) ? [...t.photos] : (t.photo ? [t.photo] : []);
      renderEditPhotoPreviews();
      openModal('edit-modal');
    }

    async function saveEditTrade() {
      const id = document.getElementById('edit-id').value;
      const finalNotes = document.getElementById('edit-notes').value.trim();

      // Recoger nuevos campos
      var entryType  = document.getElementById('edit-entry-type')  ? document.getElementById('edit-entry-type').value  : '';
      var marketCond = document.getElementById('edit-market-cond') ? document.getElementById('edit-market-cond').value : '';
      var resultType = document.getElementById('edit-result')      ? document.getElementById('edit-result').value      : '';
      var emotion    = document.getElementById('edit-emotion')      ? document.getElementById('edit-emotion').value      : '';

      // Preservar datos de auditoría existentes
      var existingAudit = {};
      var existingScore = null;
      const tExist = trades.find(function (x) { return x.id === id; });
      if (tExist) {
        existingAudit = tExist.audit || {};
        existingScore = tExist.discipline_score != null ? tExist.discipline_score : null;
      }

      // Serializar en metaBlock
      var metaBlock = '\n[GOLDFX_META]' + JSON.stringify({
        entry_type: entryType || null, market_cond: marketCond || null,
        result_type: resultType || null, emotion: emotion || null,
        audit: existingAudit, discipline_score: existingScore
      });
      var notesWithMeta = (finalNotes || '') + metaBlock;

      const photoPayload = editPhotosData.length === 0 ? null : (editPhotosData.length === 1 ? editPhotosData[0] : JSON.stringify(editPhotosData));

      const data = {
        account: document.getElementById('edit-account').value,
        asset: document.getElementById('edit-asset').value,
        side: document.getElementById('edit-side').value,
        entry_time: document.getElementById('edit-entry').value || null,
        exit_time: document.getElementById('edit-exit').value || null,
        pnl: parseFloat(document.getElementById('edit-pnl').value) || 0,
        rr: parseFloat(document.getElementById('edit-rr').value) || 0,
        session: document.getElementById('edit-session').value,
        setup: buildSetupValue('edit-bias', 'edit-tipo'),
        date: document.getElementById('edit-date').value,
        notes: notesWithMeta,
        photo: photoPayload
      };
      showLoading(true);
      try {
        await sb.update('trades', id, data);
        const idx = trades.findIndex(function (x) { return x.id === id; });
        if (idx >= 0) {
          trades[idx] = tradeFromRow(Object.assign({}, trades[idx], {
            id: id, account: data.account, asset: data.asset, side: data.side,
            entry_time: data.entry_time, exit_time: data.exit_time,
            pnl: data.pnl, rr: data.rr, session: data.session,
            setup: data.setup, date: data.date, notes: data.notes,
            photo: data.photo
          }));
        }
      } catch (e) {
        console.error('Error al guardar cambios del trade:', e);
        alert('Error al guardar cambios: ' + (e.message || e));
        return;
      } finally {
        showLoading(false);
      }
      closeModal('edit-modal');
      renderAll();
      if (typeof toast === 'function') {
        toast('Cambios guardados con éxito', 'success');
      }
    }

    // ── Setup Selector Helpers ──
    function selectSetupBtn(selectorId, hiddenId, btn) {
      document.querySelectorAll('#' + selectorId + ' .setup-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById(hiddenId).value = btn.dataset.val;
    }
    function selectSetupBtnByVal(selectorId, hiddenId, val) {
      var btn = document.querySelector('#' + selectorId + ' [data-val="' + val + '"]');
      if (!btn) return;
      document.querySelectorAll('#' + selectorId + ' .setup-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById(hiddenId).value = val;
    }
    function resetSetupSelectors(biasSel, biasId, tipoSel, tipoId) {
      document.querySelectorAll('#' + biasSel + ' .setup-btn').forEach(function(b){ b.classList.remove('active'); });
      document.querySelectorAll('#' + tipoSel + ' .setup-btn').forEach(function(b){ b.classList.remove('active'); });
      document.getElementById(biasId).value = '';
      document.getElementById(tipoId).value = '';
    }
    function buildSetupValue(biasId, tipoId) {
      var bias = document.getElementById(biasId).value;
      var tipo = document.getElementById(tipoId).value;
      if (bias && tipo) return bias + ' · ' + tipo;
      if (bias) return bias;
      if (tipo) return tipo;
      return null;
    }

    // ── Delete Trade ──
    function openDeleteModal(tradeId) {
      document.getElementById('del-id').value = tradeId;
      openModal('del-modal');
    }
    async function confirmDelete() {
      const id = document.getElementById('del-id').value;
      showLoading(true);
      try {
        await sb.remove('trades', id);
        trades = trades.filter(function (t) { return t.id !== id; });
      } catch (e) { console.error(e); }
      finally { showLoading(false); }
      closeModal('del-modal'); renderAll();
    }

    // ── View Notes ──
    function openNotesModal(notes) {
      document.getElementById('notes-content').textContent = notes || 'Sin notas.';
      openModal('notes-modal');
    }

    // ── Create Account ──
    async function createAccount() {
      const name = document.getElementById('am-name').value.trim();
      const type = document.getElementById('am-type').value;
      const broker = document.getElementById('am-broker').value.trim();
      const balance = parseFloat(document.getElementById('am-balance').value) || 0;
      if (!name) return;
      showLoading(true);
      try {
        const result = await sb.insert('accounts', { user_id: sb.getUser().id, name, type, broker, initial_balance: balance, icon: type === 'Capital Real' ? '💰' : '🎯' });
        const saved = Array.isArray(result) ? result[0] : result;
        if (saved && saved.id) {
          accounts.push({
            id: saved.id, name: saved.name, type: saved.type, broker: saved.broker || '',
            initialBalance: parseFloat(saved.initial_balance) || 0, icon: saved.icon || '💰',
            iconClass: saved.type === 'Capital Real' ? 'gold' : 'target'
          });
          refreshAccountSelects(); renderAll();
        }
      } finally { showLoading(false); }
      ['am-name', 'am-broker', 'am-balance'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
      closeModal('acct-modal');
    }

    // ── Navigation ──
    const pageNames = { dashboard: 'Dashboard', tradelog: 'Trade Log', calendario: 'Calendario', estadisticas: 'Estadísticas', analisis: 'Análisis', comparar: 'Comparar Meses', cuentas: 'Mis Cuentas', torneo: 'Torneo de Trading', admin: 'Panel de Administración', vip: 'BITÁCORA VIP' };
    function goTo(id, el) {
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
      document.querySelectorAll('.mob-nav-item').forEach(function (m) { m.classList.remove('active'); });

      // Página BITÁCORA VIP: Cualquier usuario puede ingresar; renderVipModule mostrará la vista autorizada o la pantalla de bloqueo/upsell según su membresía
      if (id !== 'vip' && typeof vipSimulateLockedView !== 'undefined') {
        vipSimulateLockedView = false;
      }

      const targetPage = document.getElementById('page-' + id);
      if (targetPage) targetPage.classList.add('active');

      // Highlight sidebar nav item
      const sideNavMatch = document.querySelector(`.nav-item[onclick*="'${id}'"]`);
      if (sideNavMatch) sideNavMatch.classList.add('active');

      // Highlight mobile bottom nav item
      const mobNavMatch = document.querySelector(`.mob-nav-item[data-page="${id}"]`);
      if (mobNavMatch) mobNavMatch.classList.add('active');

      const tbTitle = document.getElementById('tb-title');
      if (tbTitle) tbTitle.textContent = pageNames[id] || id;

      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (id === 'dashboard') renderDashboard();
      if (id === 'tradelog') renderTrades();
      if (id === 'calendario') renderCalendar();
      if (id === 'analisis') renderAnalisis();
      if (id === 'estadisticas') renderStats();
      if (id === 'comparar') renderComparar();
      if (id === 'cuentas') renderAccounts();
      if (id === 'admin') {
        renderAdminDashboard();
      }
      if (id === 'vip') {
        renderVipModule();
      }
      if (id === 'torneo') {
        loadTournamentData();
        startTournamentPolling();
      } else if (tournamentPollInterval) {
        clearInterval(tournamentPollInterval);
        tournamentPollInterval = null;
      }
    }
    window.goTo = goTo;

    let tournamentPollInterval = null;
    function startTournamentPolling() {
      if (tournamentPollInterval) clearInterval(tournamentPollInterval);
      tournamentPollInterval = setInterval(() => {
        const pTorneo = document.getElementById('page-torneo');
        if (pTorneo && pTorneo.classList.contains('active')) {
          loadTournamentData();
        } else {
          clearInterval(tournamentPollInterval);
          tournamentPollInterval = null;
        }
      }, 15000);
    }
    function setView(v, btn) { document.querySelectorAll('.tog-btn').forEach(function (b) { b.classList.remove('active'); }); btn.classList.add('active'); }

    // ── Account state ──
    let activeAccount = 'global';

    // ── Trade Log month & global filter ──
    let tlDate = new Date();
    let tlMode = 'mes'; // 'global' | 'mes'
    const TL_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    
    function setTlMode(mode) {
      tlMode = mode;
      var gBtn = document.getElementById('tl-mode-global');
      var mBtn = document.getElementById('tl-mode-mes');
      var nav = document.getElementById('tl-month-nav');
      if (gBtn) gBtn.classList.toggle('active', mode === 'global');
      if (mBtn) mBtn.classList.toggle('active', mode === 'mes');
      if (nav) nav.style.display = mode === 'mes' ? 'flex' : 'none';
      renderTrades();
    }

    function updateTlMonthTitle() {
      var el = document.getElementById('tl-month-title');
      if (el) el.innerHTML = '<span>' + TL_MONTHS[tlDate.getMonth()] + ' ' + tlDate.getFullYear() + '</span> <span style="font-size:10px;color:var(--yellow);">▾</span>';
    }
    function changeTlMonth(d) {
      tlDate.setMonth(tlDate.getMonth() + d);
      var now = new Date();
      var isNow = tlDate.getFullYear() === now.getFullYear() && tlDate.getMonth() === now.getMonth();
      var btn = document.getElementById('tl-today-btn');
      if (btn) btn.classList.toggle('active', isNow);
      renderTrades();
    }
    function goTlToday(btn) {
      tlDate = new Date();
      if (btn) btn.classList.add('active');
      renderTrades();
    }
    function getTlFilteredTrades() {
      var base = getFilteredTrades();
      if (tlMode === 'global') {
        return base;
      }
      var yr = tlDate.getFullYear(), mo = tlDate.getMonth();
      return base.filter(function(t){
        var d = new Date(t.date + 'T00:00:00');
        return d.getFullYear() === yr && d.getMonth() === mo;
      });
    }

    // ── Estadísticas month filter ──
    let stDate = new Date();
    let stMode = 'mes'; // 'global' | 'mes'
    function setStMode(mode) {
      stMode = mode;
      var gBtn = document.getElementById('st-mode-global');
      var mBtn = document.getElementById('st-mode-mes');
      var nav = document.getElementById('st-month-nav');
      if (gBtn) gBtn.classList.toggle('active', mode === 'global');
      if (mBtn) mBtn.classList.toggle('active', mode === 'mes');
      if (nav) nav.style.display = mode === 'mes' ? 'flex' : 'none';
      renderStats();
    }
    function updateStMonthTitle() {
      var el = document.getElementById('st-month-title');
      if (el) el.innerHTML = '<span>' + TL_MONTHS[stDate.getMonth()] + ' ' + stDate.getFullYear() + '</span> <span style="font-size:10px;color:var(--yellow);">▾</span>';
    }
    function changeStMonth(d) {
      stDate.setMonth(stDate.getMonth() + d);
      var now = new Date();
      var isNow = stDate.getFullYear() === now.getFullYear() && stDate.getMonth() === now.getMonth();
      var btn = document.getElementById('st-today-btn');
      if (btn) btn.classList.toggle('active', isNow);
      renderStats();
    }
    function goStToday(btn) {
      stDate = new Date();
      if (btn) btn.classList.add('active');
      renderStats();
    }
    function getStFilteredTrades() {
      var base = getFilteredTrades();
      var yr = stDate.getFullYear(), mo = stDate.getMonth();
      return base.filter(function(t){
        var d = new Date(t.date + 'T00:00:00');
        return d.getFullYear() === yr && d.getMonth() === mo;
      });
    }

    // ── Análisis month filter ──
    let anDate = new Date();
    let anMode = 'mes'; // 'global' | 'mes'
    function setAnMode(mode) {
      anMode = mode;
      var gBtn = document.getElementById('an-mode-global');
      var mBtn = document.getElementById('an-mode-mes');
      var nav = document.getElementById('an-month-nav');
      if (gBtn) gBtn.classList.toggle('active', mode === 'global');
      if (mBtn) mBtn.classList.toggle('active', mode === 'mes');
      if (nav) nav.style.display = mode === 'mes' ? 'flex' : 'none';
      renderAnalisis();
    }
    function updateAnMonthTitle() {
      var el = document.getElementById('an-month-title');
      if (el) el.innerHTML = '<span>' + TL_MONTHS[anDate.getMonth()] + ' ' + anDate.getFullYear() + '</span> <span style="font-size:10px;color:var(--yellow);">▾</span>';
    }
    function changeAnMonth(d) {
      anDate.setMonth(anDate.getMonth() + d);
      var now = new Date();
      var isNow = anDate.getFullYear() === now.getFullYear() && anDate.getMonth() === now.getMonth();
      var btn = document.getElementById('an-today-btn');
      if (btn) btn.classList.toggle('active', isNow);
      renderAnalisis();
    }
    function goAnToday(btn) {
      anDate = new Date();
      if (btn) btn.classList.add('active');
      renderAnalisis();
    }
    function getAnFilteredTrades() {
      var base = getFilteredTrades();
      var yr = anDate.getFullYear(), mo = anDate.getMonth();
      return base.filter(function(t){
        var d = new Date(t.date + 'T00:00:00');
        return d.getFullYear() === yr && d.getMonth() === mo;
      });
    }

    // ── Quick Jump Date Modal Picker ──
    function openJumpPicker(target) {
      var targetSection = target || 'calendario';
      var targetInput = document.getElementById('jp-target-section');
      if (targetInput) targetInput.value = targetSection;
      
      var curDate = new Date();
      if (targetSection === 'tradelog') curDate = tlDate;
      else if (targetSection === 'calendario') curDate = calDate;
      else if (targetSection === 'estadisticas') curDate = stDate;
      else if (targetSection === 'analisis') curDate = anDate;

      var mSel = document.getElementById('jp-month');
      var yInp = document.getElementById('jp-year');
      if (mSel) mSel.value = curDate.getMonth();
      if (yInp) yInp.value = curDate.getFullYear();

      openModal('jump-picker-modal');
    }

    function applyJumpPicker() {
      var targetInput = document.getElementById('jp-target-section');
      var targetSection = targetInput ? targetInput.value : 'calendario';
      var mSel = document.getElementById('jp-month');
      var yInp = document.getElementById('jp-year');

      var mo = mSel ? parseInt(mSel.value, 10) : new Date().getMonth();
      var yr = yInp ? parseInt(yInp.value, 10) : new Date().getFullYear();

      if (isNaN(yr) || yr < 2015 || yr > 2035) {
        alert('Por favor ingresa un año válido entre 2015 y 2035');
        return;
      }

      if (targetSection === 'tradelog') {
        tlDate = new Date(yr, mo, 1);
        if (tlMode === 'global') setTlMode('mes');
        updateTlMonthTitle();
        renderTrades();
      } else if (targetSection === 'calendario') {
        calDate = new Date(yr, mo, 1);
        renderCalendar();
      } else if (targetSection === 'estadisticas') {
        stDate = new Date(yr, mo, 1);
        if (stMode === 'global') setStMode('mes');
        updateStMonthTitle();
        renderStats();
      } else if (targetSection === 'analisis') {
        anDate = new Date(yr, mo, 1);
        if (anMode === 'global') setAnMode('mes');
        updateAnMonthTitle();
        renderAnalisis();
      }

      closeModal('jump-picker-modal');
    }

    function buildAccountFilter() {
      var wrap = document.getElementById('account-filter-wrap');
      if (wrap) {
        var html = '<button class="tog-btn ' + (activeAccount === 'global' ? 'active' : '') + '" data-acct="global" onclick="setAccountFilter(this)">🌐 Global</button>';
        accounts.forEach(function (a) {
          html += '<button class="tog-btn ' + (activeAccount === a.name ? 'active' : '') + '" data-acct="' + a.name.replace(/"/g, '&quot;') + '" onclick="setAccountFilter(this)">' + a.name + '</button>';
        });
        wrap.innerHTML = html;
      }

      var activeText = activeAccount === 'global' ? 'Todas las cuentas' : activeAccount;
      var activeTextEl = document.getElementById('acct-dropdown-active-text');
      if (activeTextEl) activeTextEl.textContent = activeText;
      
      var menu = document.getElementById('acct-dropdown-menu');
      if (menu) {
        var menuHtml = '<div class="acct-dropdown-item ' + (activeAccount === 'global' ? 'active' : '') + '" onclick="setAccountFilterDropdown(\'global\')">' +
          '<div class="acct-dropdown-item-content"><div class="acct-dropdown-item-title">Todas las cuentas</div></div>' +
          (activeAccount === 'global' ? '<svg width="14" height="10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 5l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
          '</div>';
          
        accounts.forEach(function(a) {
          var tCount = trades.filter(function(t){ return t.account === a.name; }).length;
          var subtext = a.initialBalance;
          if (a.broker) subtext += ' · ' + a.broker;
          var isActive = activeAccount === a.name;
          menuHtml += '<div class="acct-dropdown-item ' + (isActive ? 'active' : '') + '" onclick="setAccountFilterDropdown(\'' + a.name.replace(/'/g, "\\'") + '\')">' +
            '<div class="acct-dropdown-item-content">' +
              '<div class="acct-dropdown-item-title">' + a.name + '</div>' +
              '<div class="acct-dropdown-item-sub">' + subtext + '</div>' +
            '</div>' +
            (isActive ? '<svg width="14" height="10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 5l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<div class="acct-dropdown-item-count">' + tCount + '</div>') +
            '</div>';
        });
        menu.innerHTML = menuHtml;
      }
    }

    function setAccountFilterDropdown(acct) {
      activeAccount = acct;
      toggleAcctDropdown(false);
      buildAccountFilter();
      renderAll();
    }

    function toggleAcctDropdown(forceState) {
      var menu = document.getElementById('acct-dropdown-menu');
      if (!menu) return;
      if (typeof forceState === 'boolean') {
        if (forceState) menu.classList.add('open');
        else menu.classList.remove('open');
      } else {
        menu.classList.toggle('open');
      }
    }

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.acct-dropdown')) {
        toggleAcctDropdown(false);
      }
    });

    function setAccountFilter(btn) {
      activeAccount = btn.dataset.acct;
      buildAccountFilter();
      renderAll();
    }

    function getFilteredTrades() {
      if (activeAccount === 'global') return trades;
      return trades.filter(function (t) { return t.account === activeAccount; });
    }

    // ── Edit Account ──
    function openEditAccount(id) {
      var a = accounts.find(function (x) { return x.id === id; }); if (!a) return;
      document.getElementById('eam-id').value = a.id;
      document.getElementById('eam-name').value = a.name;
      document.getElementById('eam-type').value = a.type;
      document.getElementById('eam-broker').value = a.broker || '';
      document.getElementById('eam-balance').value = a.initialBalance;
      openModal('edit-acct-modal');
    }

    async function saveEditAccount() {
      var id = document.getElementById('eam-id').value;
      var data = {
        name: document.getElementById('eam-name').value.trim(),
        type: document.getElementById('eam-type').value,
        broker: document.getElementById('eam-broker').value.trim(),
        initial_balance: parseFloat(document.getElementById('eam-balance').value) || 0,
        icon: document.getElementById('eam-type').value === 'Capital Real' ? '💰' : '🎯'
      };
      if (!data.name) return;
      showLoading(true);
      try {
        await sb.update('accounts', id, data);
        var idx2 = accounts.findIndex(function (x) { return x.id === id; });
        if (idx2 >= 0) {
          accounts[idx2] = Object.assign(accounts[idx2], {
            name: data.name, type: data.type, broker: data.broker,
            initialBalance: data.initial_balance, icon: data.icon,
            iconClass: data.type === 'Capital Real' ? 'gold' : 'target'
          });
        }
        refreshAccountSelects();
        buildAccountFilter();
        renderAll();
      } catch (e) { console.error(e); alert('Error al guardar cambios'); }
      finally { showLoading(false); }
      closeModal('edit-acct-modal');
    }

    // ── Delete Account ──
    function openDeleteAccount(id) {
      var a = accounts.find(function (x) { return x.id === id; });
      if (!a) return;
      document.getElementById('del-acct-id').value = id;
      document.getElementById('del-acct-name').textContent = a.name;
      var tradeCount = trades.filter(function (t) { return t.account === a.name; }).length;
      document.getElementById('del-acct-warning').textContent = tradeCount > 0
        ? '⚠️ Esta cuenta tiene ' + tradeCount + ' trade(s). Solo se elimina la cuenta, los trades se mantienen.'
        : 'Esta acción no se puede deshacer.';
      openModal('del-acct-modal');
    }

    async function confirmDeleteAccount() {
      var id = document.getElementById('del-acct-id').value;
      showLoading(true);
      try {
        await sb.remove('accounts', id);
        accounts = accounts.filter(function (a) { return a.id !== id; });
        if (activeAccount !== 'global') {
          var still = accounts.find(function (a) { return a.name === activeAccount; });
          if (!still) activeAccount = 'global';
        }
        refreshAccountSelects();
        buildAccountFilter();
        renderAll();
      } catch (e) { console.error(e); alert('Error al eliminar cuenta'); }
      finally { showLoading(false); }
      closeModal('del-acct-modal');
    }

    // ── Deposit / Withdrawal Management ──
    function openDepositModal(id) {
      var a = accounts.find(function (x) { return x.id === id; });
      if (!a) return;
      document.getElementById('dep-acct-id').value = a.id;
      document.getElementById('dep-acct-name').value = a.name + ' (' + (a.type || 'Cuenta') + ')';
      document.getElementById('dep-amount').value = '';
      document.getElementById('dep-note').value = '';
      document.getElementById('dep-type').value = 'deposit';
      updateDepositModalLabels();
      openModal('deposit-modal');
      setTimeout(function() {
        var el = document.getElementById('dep-amount');
        if (el) el.focus();
      }, 100);
    }

    function updateDepositModalLabels() {
      var type = document.getElementById('dep-type').value;
      var btn = document.getElementById('dep-submit-btn');
      var lbl = document.getElementById('dep-amount-label');
      if (type === 'deposit') {
        if (btn) {
          btn.textContent = 'Confirmar Depósito';
          btn.className = 'btn-green';
        }
        if (lbl) lbl.textContent = 'Monto a Depositar ($)';
      } else {
        if (btn) {
          btn.textContent = 'Confirmar Retiro';
          btn.className = 'btn-cancel';
          btn.style.background = 'var(--red)';
          btn.style.color = '#fff';
        }
        if (lbl) lbl.textContent = 'Monto a Retirar ($)';
      }
    }

    async function submitDeposit() {
      var id = document.getElementById('dep-acct-id').value;
      var type = document.getElementById('dep-type').value;
      var amount = parseFloat(document.getElementById('dep-amount').value);
      var note = (document.getElementById('dep-note').value || '').trim();

      if (!amount || isNaN(amount) || amount <= 0) {
        alert('Por favor ingresa un monto válido mayor a 0.');
        return;
      }

      var a = accounts.find(function (x) { return x.id === id; });
      if (!a) return;

      var currentBal = parseFloat(a.initialBalance) || 0;
      var newBalance = currentBal;

      if (type === 'deposit') {
        newBalance = currentBal + amount;
      } else {
        if (amount > currentBal) {
          if (!confirm('El monto a retirar ($' + amount.toFixed(2) + ') supera el capital base de la cuenta ($' + currentBal.toFixed(2) + '). ¿Deseas continuar?')) {
            return;
          }
        }
        newBalance = Math.max(0, currentBal - amount);
      }

      showLoading(true);
      try {
        await sb.update('accounts', id, { initial_balance: newBalance });
        a.initialBalance = newBalance;
        
        refreshAccountSelects();
        buildAccountFilter();
        renderAll();

        closeModal('deposit-modal');
      } catch (e) {
        console.error('Error al registrar movimiento de capital:', e);
        alert('Error al registrar el movimiento en la cuenta.');
      } finally {
        showLoading(false);
      }
    }

    function openTradeModal() {
      refreshAccountSelects();
      const dateInput = document.getElementById('tm-date');
      if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
      }
      renderConfGrid('tm-confirmations', []);
      openModal('trade-modal');
    }
    function openAcctModal() {
      openModal('acct-modal');
    }
    function openModal(id) {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'flex';
        el.classList.add('open');
      }
    }
    function closeModal(id) {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        el.classList.remove('open');
      }
    }
    window.openModal = openModal;
    window.closeModal = closeModal;
    function closeOnBg(e, id) { if (e.target === document.getElementById(id)) closeModal(id); }
    function selectNews(btn) { document.querySelectorAll('.news-btn').forEach(function (b) { b.classList.remove('active'); }); btn.classList.add('active'); document.getElementById('news-val').value = btn.dataset.val; }

    // ── Multi-Photo Management ──

    function compressImage(dataUrl, callback) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var MAX = 2560; // HD resolution limit
        var w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        var compressed = canvas.toDataURL('image/jpeg', 0.95);
        callback(compressed);
      };
      img.src = dataUrl;
    }

    function processMultipleFiles(files, targetArray, onDone) {
      if (!files || !files.length) return;
      var fileList = Array.from(files).filter(function(f){ return f.type.startsWith('image/'); });
      if (!fileList.length) return;
      var count = fileList.length;
      var loaded = 0;
      fileList.forEach(function(file) {
        if (file.size > 10 * 1024 * 1024) {
          alert('La imagen "' + file.name + '" excede los 10MB.');
          loaded++;
          if (loaded === count && onDone) onDone();
          return;
        }
        var r = new FileReader();
        r.onload = function(e) {
          compressImage(e.target.result, function(compressed) {
            targetArray.push(compressed);
            loaded++;
            if (loaded === count && onDone) onDone();
          });
        };
        r.readAsDataURL(file);
      });
    }

    function handlePhoto(input) {
      processMultipleFiles(input.files, currentPhotosData, function() {
        renderPhotoPreviews();
        input.value = '';
      });
    }

    function renderPhotoPreviews() {
      var gallery = document.getElementById('photo-gallery-preview');
      var placeholder = document.getElementById('photo-placeholder');
      var actionsBar = document.getElementById('photo-actions-bar');
      var drop = document.getElementById('photo-drop');
      if (!gallery) return;

      if (currentPhotosData.length > 0) {
        gallery.style.display = 'grid';
        if (placeholder) placeholder.style.display = 'none';
        if (actionsBar) actionsBar.style.display = 'flex';
        if (drop) drop.style.padding = '8px';

        gallery.innerHTML = currentPhotosData.map(function(src, idx) {
          return `
            <div class="photo-thumb-card" onclick="event.stopPropagation();">
              <span class="photo-thumb-badge">#${idx + 1}</span>
              <button type="button" class="photo-thumb-del" onclick="event.stopPropagation(); removePhotoIndex(${idx})" title="Quitar foto">✕</button>
              <img src="${src}" alt="Foto ${idx + 1}" onclick="openLightboxFromSrc('${src}')">
            </div>
          `;
        }).join('');
      } else {
        gallery.style.display = 'none';
        gallery.innerHTML = '';
        if (placeholder) placeholder.style.display = 'flex';
        if (actionsBar) actionsBar.style.display = 'none';
        if (drop) drop.style.padding = '20px';
      }
    }

    function removePhotoIndex(idx) {
      if (idx >= 0 && idx < currentPhotosData.length) {
        currentPhotosData.splice(idx, 1);
        renderPhotoPreviews();
      }
    }

    function removePhoto() {
      currentPhotosData = [];
      renderPhotoPreviews();
      var input = document.getElementById('photo-input');
      if (input) input.value = '';
    }

    function dragOver(e) { e.preventDefault(); document.getElementById('photo-drop').classList.add('drag-over'); }
    function dropPhoto(e) {
      e.preventDefault();
      document.getElementById('photo-drop').classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files) {
        processMultipleFiles(e.dataTransfer.files, currentPhotosData, function() {
          renderPhotoPreviews();
        });
      }
    }

    // ── Edit modal photo handling ──
    function handleEditPhoto(input) {
      processMultipleFiles(input.files, editPhotosData, function() {
        renderEditPhotoPreviews();
        input.value = '';
      });
    }

    function renderEditPhotoPreviews() {
      var gallery = document.getElementById('edit-photo-gallery-preview');
      var placeholder = document.getElementById('edit-photo-placeholder');
      var actionsBar = document.getElementById('edit-photo-actions-bar');
      var drop = document.getElementById('edit-photo-drop');
      if (!gallery) return;

      if (editPhotosData.length > 0) {
        gallery.style.display = 'grid';
        if (placeholder) placeholder.style.display = 'none';
        if (actionsBar) actionsBar.style.display = 'flex';
        if (drop) drop.style.padding = '8px';

        gallery.innerHTML = editPhotosData.map(function(src, idx) {
          return `
            <div class="photo-thumb-card" onclick="event.stopPropagation();">
              <span class="photo-thumb-badge">#${idx + 1}</span>
              <button type="button" class="photo-thumb-del" onclick="event.stopPropagation(); removeEditPhotoIndex(${idx})" title="Quitar foto">✕</button>
              <img src="${src}" alt="Foto ${idx + 1}" onclick="openLightboxFromSrc('${src}')">
            </div>
          `;
        }).join('');
      } else {
        gallery.style.display = 'none';
        gallery.innerHTML = '';
        if (placeholder) placeholder.style.display = 'flex';
        if (actionsBar) actionsBar.style.display = 'none';
        if (drop) drop.style.padding = '20px';
      }
    }

    function removeEditPhotoIndex(idx) {
      if (idx >= 0 && idx < editPhotosData.length) {
        editPhotosData.splice(idx, 1);
        renderEditPhotoPreviews();
      }
    }

    function removeEditPhoto() {
      editPhotosData = [];
      renderEditPhotoPreviews();
      var input = document.getElementById('edit-photo-input');
      if (input) input.value = '';
    }

    function editDragOver(e) { e.preventDefault(); document.getElementById('edit-photo-drop').classList.add('drag-over'); }
    function editDropPhoto(e) {
      e.preventDefault();
      document.getElementById('edit-photo-drop').classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files) {
        processMultipleFiles(e.dataTransfer.files, editPhotosData, function() {
          renderEditPhotoPreviews();
        });
      }
    }

    // ── Enhanced Lightbox Gallery ──
    let currentLightboxPhotos = [];
    let currentLightboxIndex = 0;

    function openLightboxGallery(photosOrTradeId, initialIdx) {
      if (!initialIdx) initialIdx = 0;
      if (typeof photosOrTradeId === 'string') {
        const t = trades.find(function(x){ return x.id === photosOrTradeId; });
        if (t && t.photos && t.photos.length) {
          currentLightboxPhotos = t.photos;
        } else if (t && t.photo) {
          currentLightboxPhotos = [t.photo];
        } else if (photosOrTradeId.startsWith('http') || photosOrTradeId.startsWith('data:')) {
          currentLightboxPhotos = [photosOrTradeId];
        } else {
          currentLightboxPhotos = [];
        }
      } else if (Array.isArray(photosOrTradeId)) {
        currentLightboxPhotos = photosOrTradeId;
      } else {
        currentLightboxPhotos = [];
      }

      if (!currentLightboxPhotos.length) return;
      currentLightboxIndex = Math.max(0, Math.min(initialIdx, currentLightboxPhotos.length - 1));
      renderLightboxView();
      var lb = document.getElementById('lightbox');
      if (lb) lb.classList.add('open');
    }

    function openLightboxFromSrc(src) {
      openLightboxGallery([src], 0);
    }
    function openLightbox(src) {
      openLightboxGallery([src], 0);
    }
    function openLightboxFromImg(imgEl) {
      if (imgEl && imgEl.src) openLightboxGallery([imgEl.src], 0);
    }

    function renderLightboxView() {
      var img = document.getElementById('lb-img');
      var counter = document.getElementById('lb-counter');
      var prevBtn = document.getElementById('lb-prev');
      var nextBtn = document.getElementById('lb-next');
      var thumbs = document.getElementById('lb-thumbs');

      if (img && currentLightboxPhotos[currentLightboxIndex]) {
        img.src = currentLightboxPhotos[currentLightboxIndex];
      }

      if (counter) {
        counter.textContent = `Foto ${currentLightboxIndex + 1} de ${currentLightboxPhotos.length}`;
        counter.style.display = currentLightboxPhotos.length > 1 ? 'block' : 'none';
      }

      if (prevBtn) prevBtn.style.display = currentLightboxPhotos.length > 1 ? 'flex' : 'none';
      if (nextBtn) nextBtn.style.display = currentLightboxPhotos.length > 1 ? 'flex' : 'none';

      if (thumbs) {
        if (currentLightboxPhotos.length > 1) {
          thumbs.style.display = 'flex';
          thumbs.innerHTML = currentLightboxPhotos.map(function(p, i) {
            return `<img src="${p}" class="lb-thumb-item ${i === currentLightboxIndex ? 'active' : ''}" onclick="setLightboxIndex(${i})">`;
          }).join('');
        } else {
          thumbs.style.display = 'none';
          thumbs.innerHTML = '';
        }
      }
    }

    function setLightboxIndex(idx) {
      if (idx >= 0 && idx < currentLightboxPhotos.length) {
        currentLightboxIndex = idx;
        renderLightboxView();
      }
    }

    function nextLightboxImage() {
      if (currentLightboxPhotos.length > 1) {
        currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxPhotos.length;
        renderLightboxView();
      }
    }

    function prevLightboxImage() {
      if (currentLightboxPhotos.length > 1) {
        currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxPhotos.length) % currentLightboxPhotos.length;
        renderLightboxView();
      }
    }

    function closeLightbox() {
      var lb = document.getElementById('lightbox');
      if (lb) lb.classList.remove('open');
    }

    function closeLightboxOnBg(e) {
      if (e.target.id === 'lightbox') closeLightbox();
    }

    document.addEventListener('keydown', function(e) {
      var lb = document.getElementById('lightbox');
      if (lb && lb.classList.contains('open')) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowRight') nextLightboxImage();
        else if (e.key === 'ArrowLeft') prevLightboxImage();
      }
    });

    // ── Trade Side Panel Photo Navigation ──
    let _activePanelTradeId = null;
    let _activePanelPhotoIdx = 0;

    function setPanelPhotoIndex(tradeId, idx) {
      const t = trades.find(function(x){ return x.id === tradeId; });
      if (!t) return;
      const pList = (t.photos && t.photos.length) ? t.photos : (t.photo ? [t.photo] : []);
      if (!pList[idx]) return;
      _activePanelPhotoIdx = idx;
      const imgEl = document.getElementById('tdp-active-img');
      if (imgEl) imgEl.src = pList[idx];
      document.querySelectorAll('.tdp-thumb-strip-item').forEach(function(im, i){
        im.style.borderColor = i === idx ? 'var(--yellow)' : 'rgba(255,255,255,0.15)';
        im.style.opacity = i === idx ? '1' : '0.5';
      });
    }

    // ── Trade Detail Modal Photo Navigation ──
    let _activeDetailTradeId = null;
    let _activeDetailPhotoIdx = 0;

    function setDetailModalPhotoIndex(tradeId, idx) {
      const t = trades.find(function(x){ return x.id === tradeId; });
      if (!t) return;
      const pList = (t.photos && t.photos.length) ? t.photos : (t.photo ? [t.photo] : []);
      if (!pList[idx]) return;
      _activeDetailPhotoIdx = idx;
      const imgEl = document.getElementById('td-active-img');
      if (imgEl) imgEl.src = pList[idx];
      const countEl = document.getElementById('td-img-counter');
      if (countEl) countEl.textContent = `Foto ${idx + 1} de ${pList.length}`;
      document.querySelectorAll('.td-thumb-strip-item').forEach(function(im, i){
        im.style.borderColor = i === idx ? 'var(--yellow)' : 'rgba(255,255,255,0.15)';
        im.style.opacity = i === idx ? '1' : '0.5';
      });
    }

    function openTradeDetail(tradeId) {
      var t = trades.find(function (x) { return x.id === tradeId; });
      if (!t) return;
      _activeDetailTradeId = tradeId;
      _activeDetailPhotoIdx = 0;

      var imgContent = document.getElementById('td-img-content');
      var imgLabel = document.getElementById('td-img-label');
      const pList = (t.photos && t.photos.length) ? t.photos : (t.photo ? [t.photo] : []);

      if (pList.length > 0) {
        imgContent.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;width:100%;">
            <div style="position:relative;width:100%;text-align:center;">
              <img id="td-active-img" src="${pList[0]}" alt="" style="width:100%;max-height:380px;object-fit:contain;border-radius:10px;cursor:zoom-in;" onclick="openLightboxGallery('${t.id}', _activeDetailPhotoIdx)">
              <div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.7);padding:2px 8px;border-radius:6px;font-size:10px;color:#fff;pointer-events:none;">🔍 Clic para ampliar</div>
            </div>
            ${pList.length > 1 ? `
              <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:10px;">
                <span id="td-img-counter" style="font-size:11px;font-weight:700;font-family:var(--mono);color:var(--yellow);">Foto 1 de ${pList.length}</span>
                <div style="display:flex;gap:6px;overflow-x:auto;max-width:300px;padding:2px;">
                  ${pList.map((src, idx) => `
                    <img src="${src}" class="td-thumb-strip-item" onclick="setDetailModalPhotoIndex('${t.id}', ${idx})" style="width:42px;height:28px;border-radius:4px;object-fit:cover;cursor:pointer;border:1.5px solid ${idx === 0 ? 'var(--yellow)' : 'rgba(255,255,255,0.15)'};opacity:${idx === 0 ? '1' : '0.5'};transition:all 0.15s;">
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `;
        if (imgLabel) imgLabel.textContent = pList.length > 1 ? `${pList.length} Fotos` : 'Captura';
      } else {
        imgContent.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;opacity:0.3;color:var(--text-muted);"><span style="font-size:60px">📷</span><span>Sin captura</span></div>';
        if (imgLabel) imgLabel.textContent = 'Sin imagen';
      }

      document.getElementById('td-asset').textContent = t.asset + ' · ' + t.date;
      document.getElementById('td-date').textContent = t.account + '  ·  ' + t.session;
      var pnlBadge = document.getElementById('td-pnl-badge');
      var isWin = t.pnl >= 0;
      pnlBadge.textContent = (isWin ? '+' : '') + '$' + t.pnl.toFixed(2);
      pnlBadge.style.cssText = 'padding:6px 16px;border-radius:8px;font-size:20px;font-weight:800;font-family:var(--mono);white-space:nowrap;background:' + (isWin ? 'rgba(255,205,27,0.12)' : 'rgba(239,68,68,0.12)') + ';color:' + (isWin ? '#22c55e' : '#ef4444') + ';border:1px solid ' + (isWin ? 'rgba(255,205,27,0.3)' : 'rgba(239,68,68,0.3)') + ';';
      document.getElementById('td-account').textContent = t.account;
      var sideEl = document.getElementById('td-side');
      sideEl.textContent = t.side;
      sideEl.style.color = t.side === 'Long' ? 'var(--green)' : 'var(--red)';
      document.getElementById('td-rr').textContent = t.rr ? t.rr + 'R' : '—';
      document.getElementById('td-session').textContent = t.session;
      document.getElementById('td-setup').textContent = (t.setup && t.setup !== '—') ? t.setup : '—';
      var newsMap = { no: 'Sin noticia', naranja: 'Naranja', roja: 'Roja' };
      document.getElementById('td-news').textContent = newsMap[t.news] || '—';
      document.getElementById('td-entry').textContent = (t.entryTime && t.entryTime !== '—') ? t.entryTime : '—';
      document.getElementById('td-exit').textContent = (t.exitTime && t.exitTime !== '—') ? t.exitTime : '—';
      var planEl = document.getElementById('td-plan');
      planEl.textContent = t.plan === 'Si' ? '✔ Sí' : (t.plan === 'No' ? '✖ No' : '— Sin registrar');
      planEl.style.color = t.plan === 'Si' ? '#ffcd1b' : (t.plan === 'No' ? '#ef4444' : 'var(--text-muted)');
      var notesWrap = document.getElementById('td-notes-wrap');
      if (t.notes) { document.getElementById('td-notes').textContent = t.notes; notesWrap.style.display = 'block'; }
      else { notesWrap.style.display = 'none'; }
      var editBtn = document.getElementById('td-edit-btn');
      if (editBtn) editBtn.onclick = function () { closeModal('trade-detail-modal'); openEditModal(t.id); };
      openModal('trade-detail-modal');
    }

    // ── Trade Side Panel ──
    var _panelVisible = true;
    function toggleDetailPanel() {
      _panelVisible = !_panelVisible;
      var split = document.getElementById('tl-split');
      var btn = document.getElementById('tl-panel-toggle');
      if (split) split.classList.toggle('panel-hidden', !_panelVisible);
      if (btn) btn.classList.toggle('active', _panelVisible);
    }

    function showTradePanel(tradeId) {
      var t = trades.find(function (x) { return x.id === tradeId; });
      if (!t) return;
      _activePanelTradeId = tradeId;
      _activePanelPhotoIdx = 0;

      // Highlight selected row
      document.querySelectorAll('#trades-body tr').forEach(function(r){ r.classList.remove('tr-selected'); });
      var selRow = document.getElementById('tr-' + tradeId);
      if (selRow) selRow.classList.add('tr-selected');

      // Build panel HTML
      var isWin = t.pnl >= 0;
      var pnlColor = isWin ? '#ffcd1b' : '#ef4444';
      var pnlBg = isWin ? 'rgba(255,205,27,0.12)' : 'rgba(239,68,68,0.12)';
      var pnlBorder = isWin ? 'rgba(255,205,27,0.3)' : 'rgba(239,68,68,0.3)';
      const pList = (t.photos && t.photos.length) ? t.photos : (t.photo ? [t.photo] : []);

      var imgHtml = pList.length > 0
        ? `
          <div style="position:relative;width:100%;">
            <img id="tdp-active-img" src="${pList[0]}" onclick="openLightboxGallery('${t.id}', _activePanelPhotoIdx)" style="width:100%;max-height:220px;object-fit:contain;display:block;cursor:zoom-in;border-radius:6px;">
            <div class="tdp-zoom-hint">🔍 Ampliar ${pList.length > 1 ? '(' + pList.length + ' fotos)' : ''}</div>
          </div>
          ${pList.length > 1 ? `
            <div style="display:flex;gap:5px;padding:6px 0 0 0;overflow-x:auto;width:100%;">
              ${pList.map((src, idx) => `
                <img src="${src}" class="tdp-thumb-strip-item" onclick="event.stopPropagation(); setPanelPhotoIndex('${t.id}', ${idx})" style="width:40px;height:26px;border-radius:4px;object-fit:cover;cursor:pointer;border:1.5px solid ${idx === 0 ? 'var(--yellow)' : 'rgba(255,255,255,0.15)'};opacity:${idx === 0 ? '1' : '0.5'};transition:all 0.15s;">
              `).join('')}
            </div>
          ` : ''}
        `
        : '<div class="tdp-img-placeholder">📷</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Sin captura</div>';

      var notesHtml = t.notes
        ? '<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:4px;">Notas</div><div class="tdp-notes">' + t.notes + '</div>'
        : '';
      var discScore = t.discipline_score;
      var discColor = discScore != null ? (discScore >= 80 ? '#ffcd1b' : '#ef4444') : 'var(--text-muted)';
      var discText = discScore != null ? discScore + '%' : '—';
      var panel = document.getElementById('tl-detail-panel');
      panel.className = 'tl-detail-panel';
      panel.innerHTML =
        '<div class="tdp-img-box">' + imgHtml + '</div>' +
        '<div class="tdp-body">' +
          '<div class="tdp-header">' +
            '<div><div class="tdp-asset">' + t.asset + '</div><div class="tdp-sub">' + t.date + ' &nbsp;·&nbsp; ' + t.session + '</div></div>' +
            '<div class="tdp-pnl" style="background:' + pnlBg + ';color:' + pnlColor + ';border:1px solid ' + pnlBorder + '">' + (isWin ? '+' : '') + '$' + t.pnl.toFixed(2) + '</div>' +
          '</div>' +
          '<div class="tdp-grid">' +
            '<div class="tdp-field"><div class="tdp-field-l">Cuenta</div><div class="tdp-field-v">' + t.account + '</div></div>' +
            '<div class="tdp-field"><div class="tdp-field-l">Dirección</div><div class="tdp-field-v" style="color:' + (t.side === 'Long' ? 'var(--green)' : 'var(--red)') + '">' + t.side + '</div></div>' +
            '<div class="tdp-field"><div class="tdp-field-l">R:R</div><div class="tdp-field-v">' + (t.rr ? t.rr + 'R' : '—') + '</div></div>' +
            '<div class="tdp-field"><div class="tdp-field-l">Sesión</div><div class="tdp-field-v">' + t.session + '</div></div>' +
            '<div class="tdp-field"><div class="tdp-field-l">Condición</div><div class="tdp-field-v">' + (t.market_cond || '—') + '</div></div>' +
            '<div class="tdp-field"><div class="tdp-field-l">Tipo Entrada</div><div class="tdp-field-v">' + (t.entry_type || '—') + '</div></div>' +
            '<div class="tdp-field"><div class="tdp-field-l">Entrada</div><div class="tdp-field-v">' + (t.entryTime || '—') + '</div></div>' +
            '<div class="tdp-field"><div class="tdp-field-l">Salida</div><div class="tdp-field-v">' + (t.exitTime || '—') + '</div></div>' +
          '</div>' +
          '<div class="tdp-plan-row"><span style="font-size:11px;color:var(--text-muted);">🎯 Disciplina</span><span style="font-weight:800;color:' + discColor + '">' + discText + '</span></div>' +
          notesHtml +
          '<div class="tdp-actions">' +
            '<button class="btn-cancel" onclick="openEditModal(\'' + t.id + '\')" style="font-size:12px;">✏️ Editar</button>' +
            '<button class="btn-cancel" onclick="openDeleteModal(\'' + t.id + '\')" style="font-size:12px;color:var(--red);">🗑️ Borrar</button>' +
          '</div>' +
        '</div>';
      // Make panel visible if hidden
      if (!_panelVisible) toggleDetailPanel();
    }
            function computeStats(tradeList) {
        // Excluir registros de INACCIÓN de todas las estadísticas
        tradeList = tradeList.filter(function(t){ return t.asset !== 'INACCIÓN'; });
        const total = tradeList.length;
        // Consider BE based on result_type, falling back to pnl threshold
        const wins = tradeList.filter(function (t) {
          if (t.result_type === 'TP') return true;
          if (t.result_type === 'BE' || t.result_type === 'SL') return false;
          return t.pnl >= 0.01;
        });
        const losses = tradeList.filter(function (t) {
          if (t.result_type === 'SL') return true;
          if (t.result_type === 'BE' || t.result_type === 'TP') return false;
          return t.pnl <= -0.01;
        });
        const bes = tradeList.filter(function (t) {
          if (t.result_type === 'BE') return true;
          if (t.result_type === 'TP' || t.result_type === 'SL') return false;
          return t.pnl > -0.01 && t.pnl < 0.01;
        });
        
        const netPnl = tradeList.reduce(function (s, t) { return s + t.pnl; }, 0);
        
        // Win Rate logic: Wins / (Wins + Losses)
        const wrDenom = wins.length + losses.length;
        const forcedWinRate = wrDenom ? (wins.length / wrDenom * 100) : 0;
        
        const avgWin = wins.length ? wins.reduce(function (s, t) { return s + t.pnl; }, 0) / wins.length : 0;
        const avgLoss = losses.length ? Math.abs(losses.reduce(function (s, t) { return s + t.pnl; }, 0) / losses.length) : 0;
        const totalW = wins.reduce(function (s, t) { return s + t.pnl; }, 0);
        const totalL = Math.abs(losses.reduce(function (s, t) { return s + t.pnl; }, 0));
        const profitFactor = totalL ? totalW / totalL : (totalW > 0 ? Infinity : 0);
        const payoffRatio = avgLoss ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0);
        const expectancy = total ? netPnl / total : 0;
        const bestTrade = total ? Math.max.apply(null, tradeList.map(function (t) { return t.pnl; })) : 0;
        const worstTrade = total ? Math.min.apply(null, tradeList.map(function (t) { return t.pnl; })) : 0;
        const avgWinRR = wins.length ? wins.reduce(function (s, t) { return s + t.rr; }, 0) / wins.length : 0;

        // Sort trades chronologically to ensure accurate sequence metrics (drawdown, streaks)
        const sortedTrades = [...tradeList].sort(function(a, b) {
          return new Date(a.date + 'T' + (a.entryTime && a.entryTime !== '—' ? a.entryTime : '00:00:00')) - new Date(b.date + 'T' + (b.entryTime && b.entryTime !== '—' ? b.entryTime : '00:00:00'));
        });

        // Equity-based Drawdown calculation
        var uniqueAccounts = {};
        tradeList.forEach(function(t) { if (t.account) uniqueAccounts[t.account] = true; });
        var acctNames = Object.keys(uniqueAccounts);
        var initialBalance = 0;
        if (acctNames.length === 0) {
          initialBalance = (typeof accounts !== 'undefined' && accounts.length) ? accounts.reduce(function (sum, a) { return sum + a.initialBalance; }, 0) : 10000;
        } else {
          acctNames.forEach(function(name) {
            var a = (typeof accounts !== 'undefined') ? accounts.find(function(acc) { return acc.name === name; }) : null;
            if (a) initialBalance += a.initialBalance;
          });
        }
        if (initialBalance <= 0) initialBalance = 10000;

        let peak = initialBalance, runBal = initialBalance, maxDD = 0;
        sortedTrades.forEach(function (t) { 
          runBal += t.pnl; 
          if (runBal > peak) peak = runBal; 
          var dd = (peak - runBal) / peak * 100; 
          if (dd > maxDD) maxDD = dd; 
        });

        // Win/Loss Streaks (excluding Break Evens)
        let curStreak = 0, curType = null, curWin = 0, curLoss = 0;
        sortedTrades.forEach(function (t) {
          var isBE = t.result_type === 'BE' || (t.result_type !== 'TP' && t.result_type !== 'SL' && t.pnl > -0.01 && t.pnl < 0.01);
          if (isBE) return; // Skip BE
          var isWin = t.result_type === 'TP' || (t.result_type !== 'SL' && t.pnl >= 0.01);
          var type = isWin ? 'w' : 'l';
          if (type === curType) { 
            curStreak++; 
          } else { 
            curStreak = 1; 
            curType = type; 
          }
          if (type === 'w' && curStreak > curWin) curWin = curStreak;
          if (type === 'l' && curStreak > curLoss) curLoss = curStreak;
        });

        var liveStreak = 0, liveType = null;
        for (var i = sortedTrades.length - 1; i >= 0; i--) {
          var t = sortedTrades[i];
          var isBE = t.result_type === 'BE' || (t.result_type !== 'TP' && t.result_type !== 'SL' && t.pnl > -0.01 && t.pnl < 0.01);
          if (isBE) continue; // Skip BE
          var isWin = t.result_type === 'TP' || (t.result_type !== 'SL' && t.pnl >= 0.01);
          var tp = isWin ? 'w' : 'l';
          if (liveType === null) { 
            liveType = tp; 
            liveStreak = 1; 
          }
          else if (tp === liveType) { 
            liveStreak++; 
          }
          else break;
        }

        // BE Days
        var daysMap = {};
        tradeList.forEach(function(t){
          if(!daysMap[t.date]) daysMap[t.date] = 0;
          daysMap[t.date] += t.pnl;
        });
        var beDays = Object.values(daysMap).filter(function(v){ return Math.abs(v) < 0.001; }).length;

        // Plan stats
        var planStats = { Si: 0, No: 0, Medio: 0 };
        var planWhys = {};
        tradeList.forEach(function(t){
          if(t.plan === 'Si') planStats.Si++;
          else if(t.plan === 'No') planStats.No++;
          else if(t.plan === 'Medio') planStats.Medio++;
          
          if(t.plan_why) {
            var k = String(t.plan_why).trim();
            planWhys[k] = (planWhys[k]||0)+1;
          }
        });

        // byEntryType stats
        var byEntryType = {};
        tradeList.forEach(function(t){
          var et = t.entry_type || null;
          if(!et) return;
          if(!byEntryType[et]) byEntryType[et] = { pnl: 0, count: 0, wins: 0, bes: 0 };
          byEntryType[et].pnl += t.pnl;
          byEntryType[et].count++;
          var isWin = t.result_type === 'TP' || (t.result_type !== 'SL' && t.result_type !== 'BE' && t.pnl >= 0.01);
          var isBE = t.result_type === 'BE' || (t.result_type !== 'TP' && t.result_type !== 'SL' && t.pnl > -0.01 && t.pnl < 0.01);
          if(isWin) byEntryType[et].wins++;
          if(isBE) byEntryType[et].bes++;
        });

        return {
          total, wins: wins.length, losses: losses.length, bes: bes.length, beDays, planStats, planWhys, netPnl, winRate: forcedWinRate, avgWin, avgLoss,
          profitFactor, payoffRatio, expectancy, bestTrade, worstTrade, avgWinRR, maxDD,
          bestWinStreak: curWin, worstLossStreak: curLoss, liveStreak, liveType,
          byEntryType: byEntryType
        };
      }

      function generateInsights(trades) {
        // Respect the selected timeframe/month trades
        const validTrades = (trades || []).filter(function (t) { return t.asset !== 'INACCIÓN'; });
        
        if (validTrades.length === 0) {
          return '<div class="stats-card" style="margin-bottom:18px;">' +
            '<div class="stats-card-title" style="margin-bottom:14px;">🧠 Cerebro GoldFX (Hallazgos)</div>' +
            '<div style="color:var(--text-muted); font-size:12.5px; text-align:center; padding:24px 0;">No hay suficientes datos de operaciones en este período para generar hallazgos.</div>' +
            '</div>';
        }
        const insights = [];

        // 1. Mejor Sesión por P&L
        const sessionPnl = {};
        validTrades.forEach(function (t) {
          if (!t.session) return;
          sessionPnl[t.session] = (sessionPnl[t.session] || 0) + parseFloat(t.pnl);
        });
        let bestSession = null;
        let maxSessionPnl = -Infinity;
        Object.keys(sessionPnl).forEach(function (s) {
          if (sessionPnl[s] > maxSessionPnl) {
            maxSessionPnl = sessionPnl[s];
            bestSession = s;
          }
        });
        if (bestSession && maxSessionPnl > 0) {
          insights.push("📈 Tu mejor sesión es " + bestSession + ".");
        } else {
          insights.push("📈 Sin datos suficientes para determinar la mejor sesión por P&L.");
        }

        // 2. Tipo de Entrada Más Rentable (% ganancias)
        const entryWins = {};
        let totalPositivePnl = 0;
        validTrades.forEach(function (t) {
          var pnlVal = parseFloat(t.pnl);
          if (pnlVal > 0) {
            totalPositivePnl += pnlVal;
            if (t.entry_type) {
              entryWins[t.entry_type] = (entryWins[t.entry_type] || 0) + pnlVal;
            }
          }
        });
        let bestEntryType = null;
        let maxEntryPnl = -Infinity;
        Object.keys(entryWins).forEach(function (et) {
          if (entryWins[et] > maxEntryPnl) {
            maxEntryPnl = entryWins[et];
            bestEntryType = et;
          }
        });
        if (bestEntryType && totalPositivePnl > 0) {
          const entryPct = (entryWins[bestEntryType] / totalPositivePnl) * 100;
          insights.push("📈 Tus operaciones de " + bestEntryType.toLowerCase() + " generan el " + entryPct.toFixed(0) + "% de tus ganancias.");
        } else {
          insights.push("📈 Sin datos de tipos de entrada rentables registrados.");
        }

        // 3. WR de trades con disciplina < 70%
        const lowDiscTrades = validTrades.filter(function (t) {
          return t.discipline_score != null && t.discipline_score !== "" && parseFloat(t.discipline_score) < 70;
        });
        if (lowDiscTrades.length > 0) {
          const discWins = lowDiscTrades.filter(function (t) {
            return t.result_type === 'TP' || (t.result_type !== 'SL' && t.result_type !== 'BE' && parseFloat(t.pnl) >= 0.01);
          }).length;
          const discWr = (discWins / lowDiscTrades.length) * 100;
          insights.push("⚠️ Tus operaciones con disciplina menor a 70% tienen un WR de " + discWr.toFixed(0) + "%.");
        } else {
          insights.push("🟢 Mantienes una excelente disciplina: no hay trades con puntuación menor a 70%.");
        }

        // 4. Emoción dominante en pérdidas (requires at least 1 loss)
        const losingTrades = validTrades.filter(function (t) { return parseFloat(t.pnl) <= -0.01; });
        if (losingTrades.length > 0) {
          const emoCounts = {};
          losingTrades.forEach(function (t) {
            if (t.emotion && t.emotion !== 'N/A' && t.emotion !== 'Neutral' && t.emotion !== '') {
              emoCounts[t.emotion] = (emoCounts[t.emotion] || 0) + 1;
            }
          });
          let domEmo = null;
          let maxEmoCount = 0;
          Object.keys(emoCounts).forEach(function (e) {
            if (emoCounts[e] > maxEmoCount) {
              maxEmoCount = emoCounts[e];
              domEmo = e;
            }
          });
          if (domEmo && maxEmoCount > 0) {
            const emoPct = (maxEmoCount / losingTrades.length) * 100;
            const articles = {
              'Miedo': 'El miedo',
              'Impaciencia': 'La impaciencia',
              'Frustración': 'La frustración',
              'Confianza': 'La confianza',
              'Calma': 'La calma',
              'Claridad': 'La claridad',
              'Duda': 'La duda',
              'Avaricia': 'La avaricia',
              'Venganza': 'La venganza',
              'Arrepentimiento': 'El arrepentimiento',
              'Neutral': 'La actitud neutral'
            };
            const emotionLabel = articles[domEmo] || ('La emoción ' + domEmo);
            insights.push("⚠️ " + emotionLabel + " aparece en el " + emoPct.toFixed(0) + "% de tus pérdidas.");
          } else {
            insights.push("🟢 No se registra una emoción dominante negativa en tus pérdidas.");
          }
        } else {
          insights.push("🟢 Sin pérdidas registradas para analizar fallas emocionales.");
        }

        // Build premium HTML block
        let html = '<div class="stats-card" style="margin-bottom:18px;">' +
          '<div class="stats-card-title" style="margin-bottom:14px;">🧠 Cerebro GoldFX (Hallazgos)</div>' +
          '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">';
        insights.forEach(function(ins) {
          const isAlert = ins.startsWith('⚠️');
          const borderColor = isAlert ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-bronze)';
          const textColor = isAlert ? '#ef4444' : 'var(--yellow)';
          const bgColor = isAlert ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 205, 27, 0.03)';
          html += 
            '<div style="background:' + bgColor + '; border:1px solid ' + borderColor + '; border-radius:12px; padding:14px 18px; display:flex; align-items:center; gap:10px;">' +
              '<span style="font-size:13px; font-weight:600; color:' + textColor + '; line-height:1.4;">' + ins + '</span>' +
            '</div>';
        });
        html += '</div></div>';
        return html;
      }



      let activeAnDiscTimeframe = 'all';

      window.changeAnDiscTimeframe = function(tf, event) {
        if(event) {
          var parent = event.currentTarget.parentElement;
          parent.querySelectorAll('.tog-btn').forEach(function(b) { b.classList.remove('active'); });
          event.currentTarget.classList.add('active');
        }
        activeAnDiscTimeframe = tf;
        renderAnalisis();
      }

      function getDisciplineBreakdown(trades) {
        var validTrades = trades.filter(function (t) { return t.asset !== 'INACCIÓN'; });
        
        // Filter based on selected timeframe
        if (activeAnDiscTimeframe === '7d' || activeAnDiscTimeframe === '30d') {
          var cutoff = new Date();
          var days = activeAnDiscTimeframe === '7d' ? 7 : 30;
          cutoff.setDate(cutoff.getDate() - days);
          validTrades = validTrades.filter(function(t) {
            return new Date(t.date + 'T00:00:00') >= cutoff;
          });
        }

        var html = 
          '<div class="stats-card" style="margin-bottom:18px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">' +
              '<div class="stats-card-title" style="margin:0;font-size:16px;">Desglose de Disciplina</div>' +
              '<div class="toggle-group" style="padding:2px; display:flex; gap:2px;">' +
                '<button class="tog-btn' + (activeAnDiscTimeframe === '7d' ? ' active' : '') + '" onclick="changeAnDiscTimeframe(\'7d\', event)">7 días</button>' +
                '<button class="tog-btn' + (activeAnDiscTimeframe === '30d' ? ' active' : '') + '" onclick="changeAnDiscTimeframe(\'30d\', event)">30 días</button>' +
                '<button class="tog-btn' + (activeAnDiscTimeframe === 'all' ? ' active' : '') + '" onclick="changeAnDiscTimeframe(\'all\', event)">Histórico</button>' +
              '</div>' +
            '</div>';

        if (validTrades.length === 0) {
          html += '<div style="color:var(--text-muted); font-size:12.5px; text-align:center; padding:24px 0;">No hay suficientes datos de operaciones para el rango seleccionado.</div></div>';
          return html;
        }

        var totalConsist = 0;
        var totalRisk = 0;
        var totalEmo = 0;
        var totalGold = 0;

        validTrades.forEach(function (t) {
          var audit = t.audit || {};
          
          // 1. Consistencia (Setup + Ejecución) - Máx 60 pts
          var consistScore = 0;
          if (audit['aud-setup-condicion']) consistScore += 6;
          if (audit['aud-setup-expansion']) consistScore += 6;
          if (audit['aud-setup-contraccion']) consistScore += 6;
          if (audit['aud-setup-validacion']) consistScore += 6;
          if (audit['aud-setup-nivel']) consistScore += 6;
          if (audit['aud-setup-gatillo']) consistScore += 10;
          if (audit['aud-exec-params']) consistScore += 10;
          if (audit['aud-exec-noperseguir']) consistScore += 5;
          if (audit['aud-exec-notarde']) consistScore += 5;
          if (audit['aud-setup-sinconfirm']) consistScore -= 10;
          consistScore = Math.max(0, Math.min(60, consistScore));
          totalConsist += (consistScore / 60) * 100;

          // 2. Gestión de Riesgo - Máx 30 pts
          var riskScore = 0;
          if (audit['aud-risk-unaop']) riskScore += 15;
          if (audit['aud-risk-nosobreoperar']) riskScore += 10;
          if (audit['aud-risk-rrmin']) riskScore += 5;
          if (audit['aud-risk-sobreapal']) riskScore -= 15;
          if (audit['aud-risk-moversl']) riskScore -= 10;
          if (audit['aud-risk-aumentar']) riskScore -= 10;
          riskScore = Math.max(0, Math.min(30, riskScore));
          totalRisk += (riskScore / 30) * 100;

          // 3. Control Emocional - Máx 10 pts
          var emoScore = 0;
          if (audit['aud-beh-journal']) emoScore += 5;
          if (audit['aud-beh-reflexion']) emoScore += 5;
          if (['Miedo', 'Impaciencia', 'Frustración', 'Avaricia', 'Venganza', 'Arrepentimiento', 'Duda'].indexOf(t.emotion) !== -1) {
            emoScore -= 5;
          }
          emoScore = Math.max(0, Math.min(10, emoScore));
          totalEmo += (emoScore / 10) * 100;

          // 4. GoldFX Score
          var gScore = t.discipline_score != null && t.discipline_score !== "" ? parseFloat(t.discipline_score) : 0;
          totalGold += gScore;
        });

        var count = validTrades.length;
        var consistencia = Math.round(totalConsist / count);
        var riesgo = Math.round(totalRisk / count);
        var emocional = Math.round(totalEmo / count);
        var goldfx = Math.round(totalGold / count);

        function getDisciplineColor(score) {
          if (score >= 85) return 'var(--green)';
          if (score >= 70) return 'var(--yellow)';
          return 'var(--red)';
        }

        function getDisciplineEmoji(score) {
          if (score >= 85) return '🟢';
          if (score >= 70) return '🟡';
          return '🔴';
        }

        html +=
          '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; align-items:stretch;">' +
            '<div style="display:flex; flex-direction:column; gap:10px; justify-content:center;">' +
              '<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:10px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.03);">' +
                '<span style="font-size:13px; font-weight:600; color:var(--text-secondary);">Consistencia</span>' +
                '<span style="font-size:14px; font-weight:700; color:\' + getDisciplineColor(consistencia) + \';">' + getDisciplineEmoji(consistencia) + ' ' + consistencia + '%</span>' +
              '</div>' +
              '<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:10px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.03);">' +
                '<span style="font-size:13px; font-weight:600; color:var(--text-secondary);">Gestión de Riesgo</span>' +
                '<span style="font-size:14px; font-weight:700; color:\' + getDisciplineColor(riesgo) + \';">' + getDisciplineEmoji(riesgo) + ' ' + riesgo + '%</span>' +
              '</div>' +
              '<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:10px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.03);">' +
                '<span style="font-size:13px; font-weight:600; color:var(--text-secondary);">Control Emocional</span>' +
                '<span style="font-size:14px; font-weight:700; color:\' + getDisciplineColor(emocional) + \';">' + getDisciplineEmoji(emocional) + ' ' + emocional + '%</span>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px; background:rgba(255, 205, 27, 0.02); border:1px dashed var(--border-bronze); border-radius:14px; min-height:110px;">' +
              '<div style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Discipline Score Promedio</div>' +
              '<div style="font-size:32px; font-weight:800; color:var(--yellow); font-family:var(--mono);">🏆 ' + goldfx + '<span style="font-size:16px; font-weight:500; color:var(--text-muted);">/100</span></div>' +
            '</div>' +
          '</div>' +
        '</div>';
        return html;
      }

      function openDayDetail(date) {
        var dayTrades = trades.filter(function(t) { return t.date === date && t.asset !== 'INACCIÓN'; });
        if (dayTrades.length === 0) return;
        
        var tradeLogBtn = document.querySelector(".nav-item[onclick*='tradelog']");
        if (tradeLogBtn) {
          goTo('tradelog', tradeLogBtn);
          setTimeout(function() {
            showTradePanel(dayTrades[0].id);
          }, 100);
        } else {
          openTradeDetail(dayTrades[0].id);
        }
      }

      function renderAll() {
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderTrades === 'function') renderTrades();
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderStats === 'function') renderStats();
        if (typeof renderAnalisis === 'function') renderAnalisis();
        if (typeof renderComparar === 'function') renderComparar();
        if (typeof renderAccounts === 'function') renderAccounts();
      }

      window.updateDisciplineCard = function() {
        var tradesForAn = typeof anMode !== 'undefined' && anMode === 'global' ? getFilteredTrades() : getAnFilteredTrades();
        var filtered = [...tradesForAn];
        filtered.sort(function (a, b) {
          return new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00');
        });

        if (activeDiscTimeframe === 'last') {
          filtered = filtered.slice(0, 1);
        } else if (activeDiscTimeframe === '7d' || activeDiscTimeframe === '30d') {
          var cutoff = new Date();
          var days = activeDiscTimeframe === '7d' ? 7 : 30;
          cutoff.setDate(cutoff.getDate() - days);
          filtered = filtered.filter(function(t) {
            return new Date(t.date + 'T00:00:00') >= cutoff;
          });
        }
        var container = document.getElementById('discipline-breakdown-container');
        if (container) {
          container.innerHTML = getDisciplineBreakdown(filtered);
        }
      }

      function renderDashboard() {

        const trades = getFilteredTrades();
        const page = document.getElementById('page-dashboard');
        if (!trades.length) {
          page.innerHTML = 
            '<div style="text-align: center; margin-bottom: 20px; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: 10px;">"ECOSISTEMA GOLDFX"</div>' +
            '<div class="dashboard-header-card" style="flex-wrap: wrap; gap: 20px; margin-bottom:20px;">' +
              '<div>' +
                '<div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Balance Global</div>' +
                '<div style="font-size:36px; font-weight:800; font-family:var(--mono); color:#ffffff;">$0.00</div>' +
              '</div>' +
              '<div style="display:flex; gap:16px; flex-wrap: wrap;">' +
                '<div class="stat-pill" style="min-width:140px;">' +
                  '<div class="stat-pill-label">Win Rate</div>' +
                  '<div class="stat-pill-val" style="color:var(--yellow);">0.0%</div>' +
                  '<div class="stat-pill-sub">Promedio histórico</div>' +
                '</div>' +
                '<div class="stat-pill" style="min-width:140px;">' +
                  '<div class="stat-pill-label">Profit Factor</div>' +
                  '<div class="stat-pill-val" style="color:#ffffff;">0.00</div>' +
                  '<div class="stat-pill-sub">Ganancia vs Pérdida</div>' +
                '</div>' +
                '<div class="stat-pill" style="min-width:140px;">' +
                  '<div class="stat-pill-label">Total Trades</div>' +
                  '<div class="stat-pill-val" style="color:#ffffff;">0</div>' +
                  '<div class="stat-pill-sub">Operaciones registradas</div>' +
                '</div>' +
                '<div class="stat-pill" style="min-width:140px;">' +
                  '<div class="stat-pill-label">Payoff Ratio</div>' +
                  '<div class="stat-pill-val" style="color:var(--yellow);">0.00</div>' +
                  '<div class="stat-pill-sub">Relación R/B</div>' +
                '</div>' +
                '<div class="stat-pill" style="min-width:140px;">' +
                  '<div class="stat-pill-label">DD Máximo</div>' +
                  '<div class="stat-pill-val" style="color:#ffffff;">-0.00%</div>' +
                  '<div class="stat-pill-sub">Riesgo máximo</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="empty-state" style="height: calc(100vh - 400px);"><div class="empty-icon">❌</div><div class="empty-title">Sin trades todavía</div><div class="empty-sub">Añade tu primer trade para ver las estadísticas avanzadas</div></div>';
          return;
        }
        const s = computeStats(trades);
        
        var totalInit, bannerLabel;
        if (activeAccount === 'global') {
          totalInit = accounts.reduce(function (sum, a) { return sum + a.initialBalance; }, 0);
          bannerLabel = 'BALANCE GLOBAL';
        } else {
          var activeAcctObj = accounts.find(function (a) { return a.name === activeAccount; });
          totalInit = activeAcctObj ? activeAcctObj.initialBalance : 0;
          bannerLabel = activeAccount.toUpperCase();
        }
        const totalBal = totalInit + s.netPnl;
        const pct = totalInit > 0 ? (s.netPnl / totalInit * 100) : 0;
        const pc = s.netPnl >= 0 ? 'var(--green)' : 'var(--red)';
        const wc = s.winRate >= 50 ? 'var(--green)' : 'var(--red)';

        let eqTabsHtml = '<button class="eq-tab active" data-acct="global">Global</button>';
        accounts.forEach(function (a) { eqTabsHtml += '<button class="eq-tab" data-acct="' + a.name.replace(/"/g, '&quot;') + '">' + a.name + '</button>'; });

        const scoredTrades = trades.filter(function (t) { return t.asset !== 'INACCIÓN' && t.discipline_score != null && t.discipline_score !== ""; });
        const avgDisc = scoredTrades.length ? scoredTrades.reduce(function (sum, t) { return sum + parseFloat(t.discipline_score); }, 0) / scoredTrades.length : 0;

        page.innerHTML =
          '<div style="text-align: center; margin-bottom: 20px; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: 10px;">"ECOSISTEMA GOLDFX"</div>' +
          '<div class="dashboard-header-card">' +
            '<div style="position:absolute;top:10px;right:10px;font-size:10px;opacity:0.5;color:var(--text-muted);">V.1.2-FIX</div>' +
            '<div>' +
              '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:8px;">' + bannerLabel + '</div>' +
              '<div style="font-size:42px;font-weight:800;font-family:var(--mono);color:#fff;margin-bottom:4px;">$' + totalBal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '</div>' +
              '<div style="font-size:13px;color:rgba(255,255,255,0.3);font-family:var(--mono)">Capital inicial: $' + totalInit.toLocaleString() + '</div>' +
            '</div>' +
            '<div style="text-align:right;">' +
              '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:8px;">NET P&L TOTAL</div>' +
              '<div style="font-size:36px;font-weight:800;font-family:var(--mono);color:' + pc + '">' + (s.netPnl >= 0 ? '+' : '') + '$' + s.netPnl.toFixed(2) + '</div>' +
              '<div style="font-size:14px;color:' + pc + ';margin-top:4px;font-family:var(--mono);font-weight:600">' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%</div>' +
            '</div>' +
          '</div>' +

          '<div class="stats-card" style="padding:24px; margin-bottom:20px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
              '<div class="stats-card-title" style="margin:0;font-size:18px;">Curva de Equity</div>' +
              '<div style="display:flex;align-items:center;gap:14px;">' +
                '<div class="eq-tabs" id="eq-tabs" style="margin:0;">' + eqTabsHtml + '</div>' +
                '<div id="eq-net-badge" style="background:rgba(255,205,27,0.1);color:var(--green);padding:6px 12px;border-radius:8px;font-size:14px;font-weight:700;font-family:var(--mono);"></div>' +
              '</div>' +
            '</div>' +
            '<div style="position:relative;height:180px;width:100%;">' +
              '<canvas id="eq-canvas" style="width:100%;height:100%;display:block;cursor:crosshair;"></canvas>' +
              '<div id="eq-tooltip" style="display:none;position:absolute;background:#0d0c12;border:1px solid #1e1d24;border-radius:10px;padding:12px 16px;pointer-events:none;z-index:10;box-shadow:0 8px 24px rgba(0,0,0,0.6);">' +
                '<div id="eq-tt-date" style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;"></div>' +
                '<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">Equity: <span id="eq-tt-eq" style="color:var(--green);font-family:var(--mono);"></span></div>' +
                '<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:4px;">Trade: <span id="eq-tt-tr" style="font-family:var(--mono);"></span></div>' +
                '<div id="eq-tt-asset" style="font-size:11px;color:rgba(255,255,255,0.4);"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">' +
            '<div class="stat-pill"><div class="stat-pill-label">Win Rate</div><div class="stat-pill-val" style="color:' + wc + '">' + s.winRate.toFixed(1) + '%</div><div class="stat-pill-sub">' + s.wins + 'W / ' + s.losses + 'L / ' + s.bes + 'BE</div></div>' +
            '<div class="stat-pill"><div class="stat-pill-label">Profit Factor</div><div class="stat-pill-val" style="color:' + (s.profitFactor >= 1 ? 'var(--yellow)' : '#ffffff') + '">' + (isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞') + '</div><div class="stat-pill-sub">gross W / gross L</div></div>' +
            '<div class="stat-pill"><div class="stat-pill-label">Payoff Ratio</div><div class="stat-pill-val" style="color:var(--yellow);">' + (isFinite(s.payoffRatio) ? s.payoffRatio.toFixed(2) : '∞') + '</div><div class="stat-pill-sub">Relación R/B</div></div>' +
            '<div class="stat-pill"><div class="stat-pill-label">DD Máximo</div><div class="stat-pill-val" style="color:#ffffff;">-' + s.maxDD.toFixed(2) + '%</div><div class="stat-pill-sub">Riesgo máximo</div></div>' +
            '<div class="stat-pill"><div class="stat-pill-label">Total Trades</div><div class="stat-pill-val" style="color:#ffffff;">' + s.total + '</div><div class="stat-pill-sub">Operaciones registradas</div></div>' +
            '<div class="stat-pill"><div class="stat-pill-label">GoldFX Score Global</div><div class="stat-pill-val" style="color:var(--yellow);">🎯 ' + Math.round(avgDisc) + '%</div><div class="stat-pill-sub">Promedio de disciplina</div></div>' +
          '</div>';

        requestAnimationFrame(function () { 
          initEqTabs(activeAccount); 
        });
      }

      let _eqAccount = 'global';
      function initEqTabs(initialAcct) {
        var container = document.getElementById('eq-tabs');
        if (!container) return;
        // Mark correct tab as active
        var target = initialAcct || 'global';
        container.querySelectorAll('.eq-tab').forEach(function (t) {
          t.classList.toggle('active', t.dataset.acct === target);
        });
        container.addEventListener('click', function (e) {
          var btn = e.target.closest('.eq-tab');
          if (!btn) return;
          document.querySelectorAll('#eq-tabs .eq-tab').forEach(function (t) { t.classList.remove('active'); });
          btn.classList.add('active');
          switchEqTab(btn.dataset.acct);
        });
        switchEqTab(target);
      }

      function switchEqTab(acct) {
        _eqAccount = acct || 'global';
        var init, tlist;
        if (_eqAccount === 'global') {
          init = accounts.reduce(function (sum, a) { return sum + a.initialBalance; }, 0);
          tlist = getFilteredTrades();
        } else {
          var acctObj = accounts.find(function (a) { return a.name === _eqAccount; });
          init = acctObj ? acctObj.initialBalance : 0;
          tlist = trades.filter(function (t) { return t.account === _eqAccount; });
        }
        
        var sortedTlist = [...tlist].sort(function(a, b) {
          return new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00');
        });
        
        var runBal = init, pts = [{ x: 'Inicio', dateRaw: '', y: runBal, trade: 0, asset: '' }];
        sortedTlist.forEach(function (t) { 
          runBal += t.pnl; 
          pts.push({ 
             x: t.date.slice(5),
             dateRaw: t.date,
             y: runBal,
             trade: t.pnl,
             asset: t.asset
          }); 
        });
        
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        pts.forEach(p => {
          if (p.dateRaw) {
             let parts = p.dateRaw.split('-');
             if (parts.length === 3) {
                 p.x = months[parseInt(parts[1])-1] + ' ' + parseInt(parts[2]);
             }
          }
        });

        var netPnl = runBal - init;
        var badge = document.getElementById('eq-net-badge');
        if (badge) {
           badge.textContent = (netPnl >= 0 ? '+' : '') + '$' + netPnl.toFixed(2);
           badge.style.color = netPnl >= 0 ? 'var(--green)' : 'var(--red)';
           badge.style.background = netPnl >= 0 ? '#112a1f' : '#2a1111';
        }

        drawEquityCurve(pts, init);
      }

      let _eqCurveListeners = null;
      function drawEquityCurve(points, baseline) {
        var canvas = document.getElementById('eq-canvas'); if (!canvas || points.length < 1) return;
        var dpr = window.devicePixelRatio || 1, W = canvas.offsetWidth, H = 240;
        canvas.width = W * dpr; canvas.height = H * dpr;
        var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
        var vals = points.map(function (p) { return p.y; });
        var minV = Math.min.apply(null, vals), maxV = Math.max.apply(null, vals);
        var paddingY = (maxV - minV) * 0.1;
        if (paddingY === 0) paddingY = 10;
        var chartMin = minV - paddingY;
        var chartMax = maxV + paddingY;
        var range = chartMax - chartMin;
        
        var pad = { t: 20, b: 30, l: 32, r: 20 }, cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
        var px = function (i) { return points.length > 1 ? pad.l + (i / (points.length - 1)) * cw : pad.l; };
        var py = function (v) { return pad.t + ch - ((v - chartMin) / range) * ch; };
        
        function formatMoney(n) { 
           if (n >= 1000) return (n/1000).toFixed(1) + 'k';
           return '$' + n.toFixed(0); 
        }

        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '7.5px var(--mono)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        
        var ySteps = 5;
        for (var i = 0; i <= ySteps; i++) {
           var v = chartMin + (range / ySteps) * i;
           var yPos = py(v);
           ctx.fillText(formatMoney(v), pad.l - 8, yPos);
           ctx.beginPath();
           ctx.moveTo(pad.l, yPos);
           ctx.lineTo(W - pad.r, yPos);
           ctx.stroke();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        if (points.length > 0) {
           ctx.fillText(points[0].x, px(0), H - pad.b + 10);
           if (points.length > 1) {
              ctx.fillText(points[points.length-1].x, px(points.length-1), H - pad.b + 10);
           }
        }

        if (points.length > 1) {
            var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
            grad.addColorStop(0, 'rgba(255, 205, 27, 0.2)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
            ctx.beginPath();
            points.forEach(function (p, i) { if (i === 0) ctx.moveTo(px(i), py(p.y)); else ctx.lineTo(px(i), py(p.y)); });
            ctx.lineTo(px(points.length - 1), pad.t + ch);
            ctx.lineTo(px(0), pad.t + ch);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Draw Line with Glow
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Outer Glow
        ctx.beginPath();
        points.forEach(function (p, i) { if (i === 0) ctx.moveTo(px(i), py(p.y)); else ctx.lineTo(px(i), py(p.y)); });
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffcd1b';
        ctx.strokeStyle = '#ffcd1b';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner Bright Line
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffcd1b';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Sharp White Core
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();

        var chartImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

        var tt = document.getElementById('eq-tooltip');
        var ttDate = document.getElementById('eq-tt-date');
        var ttEq = document.getElementById('eq-tt-eq');
        var ttTr = document.getElementById('eq-tt-tr');
        var ttAsset = document.getElementById('eq-tt-asset');

        if (_eqCurveListeners) {
           canvas.removeEventListener('mousemove', _eqCurveListeners.move);
           canvas.removeEventListener('mouseleave', _eqCurveListeners.leave);
        }

        function handleHover(e) {
           if (points.length < 1) return;
           var rect = canvas.getBoundingClientRect();
           var mouseX = e.clientX - rect.left;
           
           var closestIdx = 0;
           var minDist = Infinity;
           points.forEach(function(p, i) {
              var dx = Math.abs(mouseX - px(i));
              if (dx < minDist) { minDist = dx; closestIdx = i; }
           });

           var p = points[closestIdx];
           var cx = px(closestIdx);
           var cy = py(p.y);

           ctx.putImageData(chartImage, 0, 0);

           ctx.beginPath();
           ctx.moveTo(cx, pad.t);
           ctx.lineTo(cx, pad.t + ch);
           ctx.strokeStyle = 'rgba(255,255,255,0.2)';
           ctx.lineWidth = 1;
           ctx.stroke();

           ctx.beginPath();
           ctx.arc(cx, cy, 5, 0, 2*Math.PI);
           ctx.fillStyle = 'var(--green)';
           ctx.fill();
           ctx.lineWidth = 2;
           ctx.strokeStyle = '#111d14';
           ctx.stroke();

           tt.style.display = 'block';
           ttDate.textContent = p.x;
           ttEq.textContent = '$' + p.y.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
           
           if (closestIdx === 0) {
              ttTr.textContent = '—';
              ttTr.style.color = 'var(--text-muted)';
              ttAsset.textContent = 'Capital Inicial';
           } else {
              var pnlStr = (p.trade >= 0 ? '+' : '') + '$' + p.trade.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
              ttTr.textContent = pnlStr;
              ttTr.style.color = p.trade >= 0 ? 'var(--green)' : 'var(--red)';
              ttAsset.textContent = p.asset;
           }

           var ttW = tt.offsetWidth || 150;
           var ttH = tt.offsetHeight || 80;
           var tx = cx + 15;
           var ty = cy - ttH / 2;
           if (tx + ttW > W) tx = cx - ttW - 15;
           if (ty < 0) ty = 10;
           if (ty + ttH > H) ty = H - ttH - 10;
           
           tt.style.left = tx + 'px';
           tt.style.top = ty + 'px';
        }

        function handleLeave() {
           ctx.putImageData(chartImage, 0, 0);
           tt.style.display = 'none';
        }

        _eqCurveListeners = { move: handleHover, leave: handleLeave };
        canvas.addEventListener('mousemove', handleHover);
        canvas.addEventListener('mouseleave', handleLeave);
      }
      function drawDailyPnl(dates, vals) {
        var canvas = document.getElementById('daily-canvas'); if (!canvas || !vals.length) return;
        var dpr = window.devicePixelRatio || 1, W = canvas.offsetWidth, H = 150;
        canvas.width = W * dpr; canvas.height = H * dpr;
        var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
        var maxAbs = Math.max.apply(null, vals.map(Math.abs).concat([1]));
        var pad = { t: 8, b: 8, l: 6, r: 6 }, cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
        var bw = Math.max(4, cw / vals.length - 3), zeroY = pad.t + ch / 2;
        ctx.beginPath(); ctx.moveTo(pad.l, zeroY); ctx.lineTo(W - pad.r, zeroY); ctx.strokeStyle = 'rgba(125,148,130,.12)'; ctx.lineWidth = 1; ctx.stroke();
        vals.forEach(function (v, i) { var x = pad.l + (i / vals.length) * cw + (cw / vals.length - bw) / 2, h = Math.max(2, (Math.abs(v) / maxAbs) * (ch / 2 - 4)), y = v >= 0 ? zeroY - h : zeroY; ctx.fillStyle = v >= 0 ? 'rgba(255,205,27,.85)' : 'rgba(239,68,68,.85)'; ctx.fillRect(x, y, bw, h); });
      }

      // ── TRADE LOG ──
      const newsLabels = { no: '— Sin noticia', naranja: '🟠 Naranja', roja: '🔴 Roja' };
      function renderTrades() {
        updateTlMonthTitle();
        const trades = getTlFilteredTrades();
        const s = computeStats(trades);
        var pnlEl = document.getElementById('tl-pnl'), wrEl = document.getElementById('tl-wr'), totEl = document.getElementById('tl-total');
        var awEl = document.getElementById('tl-avgw'), alEl = document.getElementById('tl-avgl'), pfEl = document.getElementById('tl-pf');
        if (pnlEl) { pnlEl.textContent = (s.netPnl >= 0 ? '+' : '') + '$' + s.netPnl.toFixed(2); pnlEl.className = 'stat-pill-val ' + (s.netPnl >= 0 ? 'green' : 'red'); }
        if (wrEl) { wrEl.textContent = s.winRate.toFixed(1) + '%'; wrEl.className = 'stat-pill-val ' + (s.winRate >= 50 ? 'green' : 'red'); }
        if (totEl) totEl.textContent = s.total;
        if (awEl) awEl.textContent = '$' + s.avgWin.toFixed(2);
        if (alEl) alEl.textContent = '$' + s.avgLoss.toFixed(2);
        if (pfEl) pfEl.textContent = isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞';
        document.getElementById('trades-count').innerHTML = trades.length + ' trades &nbsp;&nbsp;&bull;&nbsp;&nbsp; <span style="color:var(--green);font-weight:600;">' + s.wins + ' W</span> / <span style="color:var(--red);font-weight:600;">' + s.losses + ' L</span> / <span style="color:var(--purple);font-weight:600;">' + s.bes + ' BE</span>';
        const tbody = document.getElementById('trades-body');
        if (!trades.length) { tbody.innerHTML = '<tr><td colspan="16" class="no-trades">Sin trades todavía</td></tr>'; return; }
        tbody.innerHTML = [...trades].reverse().map(function (t) {
          var nc = t.news === 'naranja' ? 'naranja' : t.news === 'roja' ? 'roja' : 'none';
          var condHtml = t.market_cond ? '<span style="font-size:11px;">' + t.market_cond + '</span>' : '<span style="color:var(--text-muted);font-size:12px">—</span>';
          var entryTypeHtml = t.entry_type ? '<span style="font-size:11px;">' + t.entry_type + '</span>' : '<span style="color:var(--text-muted);font-size:12px">—</span>';
          var resultColor = t.result_type === 'TP' ? 'var(--green)' : t.result_type === 'SL' ? 'var(--red)' : 'var(--purple)';
          var resultHtml = t.result_type ? '<span style="font-weight:700;color:' + resultColor + ';font-size:11px;">' + t.result_type + '</span>' : '<span style="color:var(--text-muted);font-size:12px">—</span>';
          var emotionMap = { 'Confianza':'😌', 'Calma':'🧘', 'Claridad':'💡', 'Neutral':'🤔', 'Duda':'❓', 'Miedo':'😰', 'Impaciencia':'😤', 'Frustración':'😡', 'Avaricia':'🤑', 'Venganza':'⚔️', 'Arrepentimiento':'🤦' };
          var emotionHtml = t.emotion ? '<span style="font-size:12px;" title="' + t.emotion + '">' + (emotionMap[t.emotion]||'') + ' ' + t.emotion + '</span>' : '<span style="color:var(--text-muted);font-size:12px">—</span>';
          
          var discVal = t.discipline_score != null && t.discipline_score !== "" ? parseFloat(t.discipline_score) : null;
          var discCol = discVal !== null ? (discVal >= 85 ? 'var(--green)' : (discVal >= 70 ? 'var(--yellow)' : 'var(--red)')) : 'var(--text-muted)';
          var discHtml = discVal !== null ? '<span style="font-family:var(--mono);font-size:12px;font-weight:700;color:' + discCol + ';">' + discVal + '%</span>' : '<span style="color:var(--text-muted);font-size:12px">—</span>';
          var safeId = t.id;
          var photoList = (t.photos && t.photos.length) ? t.photos : (t.photo ? [t.photo] : []);
          var photoHtml = photoList.length > 0
            ? '<div class="trade-thumb-wrap" style="position:relative;display:inline-block;" onclick="event.stopPropagation();openLightboxGallery(\'' + safeId + '\', 0)">'
            + '<img class="trade-thumb" src="' + photoList[0] + '" alt="">'
            + (photoList.length > 1 ? '<span class="thumb-multi-badge">+' + (photoList.length - 1) + '</span>' : '')
            + '</div>'
            : '<span style="color:var(--text-muted);font-size:12px">—</span>';
          var notesHtml = t.notes ? '<button class="ta n" title="Ver notas" onclick="openNotesModal(\'' + t.notes.replace(/'/g, "\\'").replace(/\\n/g, ' ') + '\')">📝</button>' : '<span style="color:var(--text-muted);font-size:12px">—</span>';
          return '<tr style="cursor:pointer;" id="tr-' + safeId + '" onclick="showTradePanel(\'' + safeId + '\')">' +
            '<td style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">' + t.date + '</td>' +
            '<td>' + t.account + '</td>' +
            '<td style="font-weight:600;color:var(--text-primary)">' + t.asset + '</td>' +
            '<td><span class="side-tag ' + (t.side === 'Long' ? 'side-long' : 'side-short') + '">' + t.side + '</span></td>' +
            '<td style="font-family:var(--mono)">' + t.entryTime + '</td>' +
            '<td style="font-family:var(--mono)">' + t.exitTime + '</td>' +
            '<td style="font-family:var(--mono);font-weight:700;color:' + (t.pnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (t.pnl >= 0 ? '+' : '') + '$' + t.pnl.toFixed(2) + '</td>' +
            '<td style="font-family:var(--mono)">' + t.rr.toFixed(2) + 'R</td>' +
            '<td>' + t.session + '</td>' +
            '<td>' + condHtml + '</td>' +
            '<td>' + entryTypeHtml + '</td>' +
            '<td>' + resultHtml + '</td>' +
            '<td>' + emotionHtml + '</td>' +
            '<td>' + discHtml + '</td>' +
            '<td>' + notesHtml + '</td>' +
            '<td><div class="tact">' +
            '<button class="ta e" title="Editar" onclick="event.stopPropagation();openEditModal(\'' + safeId + '\')">✏️</button>' +
            '<button class="ta d" title="Eliminar" onclick="event.stopPropagation();openDeleteModal(\'' + safeId + '\')">🗑️</button>' +
            '</div></td>' +
            '</tr>';
        }).join('');
      }

      // ── CALENDAR ──
      let calDate = new Date();
      function renderCalendar() {
        const trades = getFilteredTrades();
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const yr = calDate.getFullYear(), mo = calDate.getMonth();
        var cmt = document.getElementById('cal-month-title');
        if (cmt) cmt.innerHTML = '<span>' + months[mo] + ' ' + yr + '</span> <span style="font-size:10px;color:var(--yellow);">▾</span>';

        const mTrades = trades.filter(function (t) {
          var d = new Date(t.date + 'T00:00:00');
          return d.getFullYear() === yr && d.getMonth() === mo;
        });
        const ms = computeStats(mTrades);

        // Header stats
        var cn = document.getElementById('cal-net'), cw = document.getElementById('cal-wr'), cc = document.getElementById('cal-count');
        if (cn) { cn.textContent = (ms.netPnl >= 0 ? '+' : '') + '$' + ms.netPnl.toFixed(2); cn.style.color = ms.netPnl >= 0 ? 'var(--green)' : 'var(--red)'; }
        if (cw) { cw.textContent = ms.winRate.toFixed(1) + '%'; cw.style.color = ms.winRate >= 50 ? 'var(--green)' : 'var(--red)'; }
        if (cc) cc.textContent = ms.total;

        // ── Build enriched day map ──
        var dayMap = {};
        var inactionMap = {}; // track inaction days separately
        var emoIcons = { 'Confianza':'😌', 'Calma':'🧘', 'Claridad':'💡', 'Neutral':'🤔', 'Duda':'❓', 'Miedo':'😰', 'Impaciencia':'😤', 'Frustración':'😡', 'Avaricia':'🤑', 'Venganza':'⚔️', 'Arrepentimiento':'🤦' };
        mTrades.forEach(function (t) {
          var d = new Date(t.date + 'T00:00:00').getDate();
          // Handle INACCIÓN records
          if (t.asset === 'INACCIÓN') {
            inactionMap[d] = t.notes || '🛌 Sin razón';
            return;
          }
          if (!dayMap[d]) dayMap[d] = { pnl: 0, count: 0, wins: 0, discScores: [], emotions: {} };
          dayMap[d].pnl += t.pnl; dayMap[d].count++;
          if (t.pnl > 0) dayMap[d].wins++;
          if (t.discipline_score != null) dayMap[d].discScores.push(t.discipline_score);
          if (t.emotion) {
            dayMap[d].emotions[t.emotion] = (dayMap[d].emotions[t.emotion] || 0) + 1;
          }
        });

        // ── Calculate streaks ──
        var allDates = {};
        trades.forEach(function(t){
          if (t.asset === 'INACCIÓN') return; // Evitar que días sin operar (inacción) rompan las rachas de disciplina y journal
          var dk = t.date;
          if(!allDates[dk]) allDates[dk] = { scores: [], hasJournal: false, riskOk: true };
          if(t.discipline_score != null) allDates[dk].scores.push(t.discipline_score);
          if(t.audit && t.audit['aud-beh-journal']) allDates[dk].hasJournal = true;
          // Risk streak: check risk audit items
          if(t.audit) {
            if(t.audit['aud-risk-sobreapal'] || t.audit['aud-risk-moversl'] || t.audit['aud-risk-aumentar']) allDates[dk].riskOk = false;
          }
        });
        var sortedDates = Object.keys(allDates).sort().reverse();
        var streakPlan = 0, streakJournal = 0, streakRisk = 0;
        for(var si=0; si<sortedDates.length; si++){
          var sd = allDates[sortedDates[si]];
          var avgS = sd.scores.length ? sd.scores.reduce(function(a,b){return a+b;},0)/sd.scores.length : 0;
          if(avgS >= 70 && sd.scores.length > 0) streakPlan++; else break;
        }
        for(var si=0; si<sortedDates.length; si++){
          if(allDates[sortedDates[si]].hasJournal) streakJournal++; else break;
        }
        // Risk streak counts consecutive trades (not days) - Excluir inacción
        var allTradesSorted = trades.filter(function(t) { return t.asset !== 'INACCIÓN'; }).sort(function(a,b){
          return new Date(b.date + 'T' + (b.entryTime && b.entryTime !== '—' ? b.entryTime : '00:00:00')) - new Date(a.date + 'T' + (a.entryTime && a.entryTime !== '—' ? a.entryTime : '00:00:00'));
        });
        for(var si=0; si<allTradesSorted.length; si++){
          var ta = allTradesSorted[si];
          if(ta.audit && !ta.audit['aud-risk-sobreapal'] && !ta.audit['aud-risk-moversl'] && !ta.audit['aud-risk-aumentar']) streakRisk++; else break;
        }
        var spEl = document.getElementById('streak-plan'); if(spEl) spEl.textContent = streakPlan;
        var srEl = document.getElementById('streak-risk'); if(srEl) srEl.textContent = streakRisk;
        var sjEl = document.getElementById('streak-journal'); if(sjEl) sjEl.textContent = streakJournal;

        // Max abs pnl for bar scaling
        var maxDayAbs = 0;
        Object.values(dayMap).forEach(function (d) { if (Math.abs(d.pnl) > maxDayAbs) maxDayAbs = Math.abs(d.pnl); });
        if (maxDayAbs === 0) maxDayAbs = 1;

        var body2 = document.getElementById('cal-body'); body2.innerHTML = '';
        var firstDay = new Date(yr, mo, 1).getDay();
        var daysInMonth = new Date(yr, mo + 1, 0).getDate();
        var daysInPrev = new Date(yr, mo, 0).getDate();
        var today = new Date();

        var cells = [];
        for (var i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, other: true });
        for (var d = 1; d <= daysInMonth; d++) {
          var isToday = d === today.getDate() && mo === today.getMonth() && yr === today.getFullYear();
          cells.push({ day: d, today: isToday, data: dayMap[d] });
        }
        var next = 1;
        while (cells.length % 7 !== 0) cells.push({ day: next++, other: true });

        for (var i = 0; i < cells.length; i += 7) {
          var week = cells.slice(i, i + 7);
          var weekPnl = 0, weekTrades = 0;

          week.forEach(function (c) {
            var div = document.createElement('div');
            var cls = 'cal-cell';
            if (c.other) cls += ' other-month';
            if (c.today) cls += ' today';

            // Check if this is an inaction day
            var isInaction = !c.other && inactionMap[c.day] && !c.data;

            if (!c.other && c.data && !isInaction) {
              cls += c.data.pnl >= 0 ? ' win-day' : ' loss-day';
              var cellDate = yr + '-' + String(mo+1).padStart(2,'0') + '-' + String(c.day).padStart(2,'0');
              div.style.cursor = 'pointer';
              div.setAttribute('onclick', "openDayDetail('" + cellDate + "')");
            }
            div.className = cls;

            var inner = '';

            if (isInaction) {
              // ── Render inaction day ──
              var reasonText = inactionMap[c.day];
              inner += '<div class="cal-header-row"><span class="cal-trades"></span><span class="cal-num">' + c.day + '</span></div>';
              inner += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:2px;">';
              inner += '<div style="font-size:16px;line-height:1;">' + (reasonText.startsWith('⭕') ? '⭕' : reasonText.startsWith('📚') ? '📚' : '🛑') + '</div>';
              inner += '<div style="font-size:8px;color:var(--text-muted);text-align:center;line-height:1.2;">' + reasonText.replace(/^[⭕📚🛑]\s?/, '') + '</div>';
              inner += '</div>';
            } else if (!c.other && c.data) {
              weekPnl += c.data.pnl;
              weekTrades += c.data.count;
              var isWin = c.data.pnl >= 0;
              var pnlClass = isWin ? 'win' : 'loss';

              // Header: trades left, day# right
              inner += '<div class="cal-header-row">';
              inner += '<span class="cal-trades">' + c.data.count + ' trade' + (c.data.count > 1 ? 's' : '') + '</span>';
              inner += '<span class="cal-num">' + c.day + '</span>';
              inner += '</div>';

              // P&L bottom-left with K format
              var pnlAbs = Math.abs(c.data.pnl);
              var pnlStr = pnlAbs >= 1000 ? '$' + (pnlAbs/1000).toFixed(2) + 'K' : '$' + pnlAbs.toFixed(2);
              if(!isWin) pnlStr = '-' + pnlStr;
              inner += '<div class="cal-pnl ' + pnlClass + '">' + pnlStr + '</div>';

              // Discipline Score + Emotion at bottom
              var avgDisc = c.data.discScores.length
                ? Math.round(c.data.discScores.reduce(function(a,b){return a+b;},0) / c.data.discScores.length)
                : null;
              var domEmo = null, domCount = 0;
              Object.keys(c.data.emotions).forEach(function(ek){
                if(c.data.emotions[ek] > domCount) { domCount = c.data.emotions[ek]; domEmo = ek; }
              });
              if(avgDisc != null || domEmo) {
                var discColor = avgDisc != null ? (avgDisc >= 80 ? 'var(--yellow)' : (avgDisc >= 50 ? 'var(--text-muted)' : '#ef4444')) : 'var(--text-muted)';
                var moodLine = '<div style="display:flex;align-items:center;gap:3px;font-size:9px;line-height:1;margin-top:4px;">';
                if(avgDisc != null) moodLine += '<span style="color:' + discColor + ';font-weight:700;">🎯' + avgDisc + '%</span>';
                if(domEmo) moodLine += '<span style="font-size:11px;" title="' + domEmo + '">' + (emoIcons[domEmo]||'') + '</span>';
                moodLine += '</div>';
                inner += moodLine;
              }
            } else if (!c.other) {
              // Day number only + header for empty days
              inner += '<div class="cal-header-row"><span class="cal-trades"></span><span class="cal-num">' + c.day + '</span></div>';
              if (!isInaction) {
                // Empty day — clickable to register inaction
                var cellDate = yr + '-' + String(mo+1).padStart(2,'0') + '-' + String(c.day).padStart(2,'0');
                div.style.cursor = 'pointer';
                div.setAttribute('onclick', "openInactionModal('" + cellDate + "')");
              }
            } else {
              // Other month day
              inner += '<div class="cal-header-row"><span class="cal-trades"></span><span class="cal-num">' + c.day + '</span></div>';
            }

            div.innerHTML = inner;
            body2.appendChild(div);
          });

          // Week summary column
          var weekNum = Math.floor(i / 7) + 1;
          var ws = document.createElement('div');
          ws.className = 'cal-cell week-col' + (weekPnl > 0 ? ' win-day' : weekPnl < 0 ? ' loss-day' : '');
          var wClass = weekPnl > 0 ? 'win' : weekPnl < 0 ? 'loss' : 'flat';
          var wAbs = Math.abs(weekPnl);
          var wStr = wAbs >= 1000 ? '$' + (wAbs/1000).toFixed(2) + 'K' : '$' + wAbs.toFixed(0);
          if(weekPnl < 0) wStr = '-' + wStr;
          ws.innerHTML =
            '<span class="week-label">W' + weekNum + '</span>' +
            '<span class="week-val ' + wClass + '">' + wStr + '</span>' +
            '<span class="week-trades">' + (weekTrades > 0 ? weekTrades + ' trade' + (weekTrades > 1 ? 's':'') : '0 trades') + '</span>';
          body2.appendChild(ws);
        }
      }
      function changeMonth(d) { calDate.setMonth(calDate.getMonth() + d); renderCalendar(); }
      function goToday() { calDate = new Date(); renderCalendar(); }

      // ── CALENDAR EXPORT (Tarjeta Mensual) ──
      function openCalendarExportModal() {
        renderCalendarExportCard();
        openModal('cal-export-modal');
      }

      function renderCalendarExportCard() {
        const container = document.getElementById('cal-export-card');
        if (!container) return;

        const trades = getFilteredTrades();
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const yr = calDate.getFullYear(), mo = calDate.getMonth();
        const monthName = months[mo];

        const mTrades = trades.filter(function (t) {
          var d = new Date(t.date + 'T00:00:00');
          return d.getFullYear() === yr && d.getMonth() === mo;
        });
        const ms = computeStats(mTrades);

        var dayMap = {};
        var inactionMap = {};
        var emoIcons = { 'Confianza':'😌', 'Calma':'🧘', 'Claridad':'💡', 'Neutral':'🤔', 'Duda':'❓', 'Miedo':'😰', 'Impaciencia':'😤', 'Frustración':'😡', 'Avaricia':'🤑', 'Venganza':'⚔️', 'Arrepentimiento':'🤦' };

        var profitableDays = 0;
        var tradedDays = 0;
        var totalDiscScores = [];

        mTrades.forEach(function (t) {
          var d = new Date(t.date + 'T00:00:00').getDate();
          if (t.asset === 'INACCIÓN') {
            inactionMap[d] = t.notes || '🛌 Descanso';
            return;
          }
          if (!dayMap[d]) {
            dayMap[d] = { pnl: 0, count: 0, wins: 0, losses: 0, bes: 0, discScores: [], emotions: {} };
          }
          dayMap[d].pnl += t.pnl;
          dayMap[d].count++;
          if (t.pnl > 0) dayMap[d].wins++;
          else if (t.pnl < 0) dayMap[d].losses++;
          else dayMap[d].bes++;

          if (t.discipline_score != null) {
            dayMap[d].discScores.push(t.discipline_score);
            totalDiscScores.push(t.discipline_score);
          }
          if (t.emotion) {
            dayMap[d].emotions[t.emotion] = (dayMap[d].emotions[t.emotion] || 0) + 1;
          }
        });

        Object.values(dayMap).forEach(function(d) {
          tradedDays++;
          if (d.pnl > 0) profitableDays++;
        });

        // User Profile Data
        const u = sb.getUser();
        const pData = getUserProfileData(u);
        let userName = pData.name || 'Estudiante';
        const userAvEl = document.querySelector('.user-av');
        let avatarImgSrc = null;
        if (userAvEl) {
          const imgInside = userAvEl.querySelector('img');
          if (imgInside && imgInside.src) avatarImgSrc = imgInside.src;
        }

        // Days grid computation (7 columns)
        var firstDay = new Date(yr, mo, 1).getDay();
        var daysInMonth = new Date(yr, mo + 1, 0).getDate();
        var daysInPrev = new Date(yr, mo, 0).getDate();

        var cells = [];
        for (var i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, other: true });
        for (var d = 1; d <= daysInMonth; d++) {
          cells.push({ day: d, data: dayMap[d] });
        }
        var next = 1;
        while (cells.length % 7 !== 0) cells.push({ day: next++, other: true });

        const pnlColor = ms.netPnl >= 0 ? '#16a34a' : '#f87171';
        const pnlSign = ms.netPnl >= 0 ? '+' : '';
        const pnlFormatted = pnlSign + '$' + ms.netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const wrColor = ms.winRate >= 50 ? '#16a34a' : '#f87171';
        const pfText = isFinite(ms.profitFactor) ? ms.profitFactor.toFixed(2) : (ms.profitFactor > 0 ? '∞' : '0.00');

        let html = '';

        // ── TOP BRANDING & HEADER ──
        html += '<div style="text-align:center;margin-bottom:14px;">';
        html += '  <div style="margin-bottom:4px;">';
        html += '    <span style="font-size:19px;font-weight:900;letter-spacing:2px;color:#ffcd1b;text-transform:uppercase;font-family:var(--sans);">SYNTRACKER FX</span>';
        html += '  </div>';
        html += '  <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">';
        html += '    <div style="height:1px;width:35px;background:linear-gradient(90deg, transparent, #ffcd1b);"></div>';
        html += '    <span style="font-size:9.5px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;">ESTEBAN GOLDFX OFFICIAL</span>';
        html += '    <div style="height:1px;width:35px;background:linear-gradient(90deg, #ffcd1b, transparent);"></div>';
        html += '  </div>';
        html += '  <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">' + monthName + ' <span style="color:#ffcd1b;">' + yr + '</span></div>';
        html += '</div>';

        // ── HERO STATS CARD (Instagram Story Style) ──
        html += '<div style="background:linear-gradient(135deg, rgba(255,205,27,0.08) 0%, rgba(18,18,18,0.85) 100%);border:1px solid rgba(255,205,27,0.3);border-radius:18px;padding:16px 18px;margin-bottom:14px;box-shadow:0 10px 25px rgba(0,0,0,0.5);text-align:center;">';
        html += '  <div style="font-size:10px;font-weight:800;color:var(--text-muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">NET P&L DEL MES</div>';
        html += '  <div style="font-size:30px;font-weight:900;color:' + pnlColor + ';font-family:var(--mono);line-height:1.1;letter-spacing:-0.5px;text-shadow:0 0 20px ' + (ms.netPnl >= 0 ? 'rgba(22,163,74,0.35)' : 'rgba(248,113,113,0.3)') + ';">' + pnlFormatted + '</div>';
        html += '  <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);font-size:11.5px;">';
        html += '    <span style="color:' + wrColor + ';font-weight:700;">🎯 ' + ms.winRate.toFixed(1) + '% WR</span>';
        html += '    <span style="color:var(--text-muted);">&bull;</span>';
        html += '    <span style="color:#fff;font-weight:600;"><span style="color:#16a34a;">' + ms.wins + 'W</span> / <span style="color:#f87171;">' + ms.losses + 'L</span> / <span style="color:#ffcd1b;">' + ms.bes + 'BE</span></span>';
        html += '  </div>';
        html += '</div>';

        // ── SECONDARY 2-COLUMN STATS ──
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">';
        html += '  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">';
        html += '    <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Profit Factor</span>';
        html += '    <span style="font-size:14px;font-weight:800;color:#ffcd1b;font-family:var(--mono);">' + pfText + '</span>';
        html += '  </div>';
        html += '  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">';
        html += '    <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Días Ganadores</span>';
        html += '    <span style="font-size:13px;font-weight:800;color:#16a34a;font-family:var(--mono);">' + profitableDays + ' / ' + tradedDays + ' d</span>';
        html += '  </div>';
        html += '</div>';

        // ── CALENDAR 7-COLUMN GRID ──
        html += '<div style="background:rgba(18,18,18,0.75);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:12px 10px;margin-bottom:14px;flex:1;display:flex;flex-direction:column;justify-content:center;">';
        // Header
        html += '  <div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:4px;margin-bottom:6px;text-align:center;">';
        const dayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
        dayNames.forEach(function(dn) {
          html += '    <div style="font-size:9.5px;font-weight:800;letter-spacing:0.5px;color:var(--text-muted);text-transform:uppercase;padding:2px 0;">' + dn + '</div>';
        });
        html += '  </div>';

        // Body
        html += '  <div style="display:flex;flex-direction:column;gap:5px;">';
        for (var i = 0; i < cells.length; i += 7) {
          var week = cells.slice(i, i + 7);
          html += '    <div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:4px;">';
          week.forEach(function(c) {
            var isInaction = !c.other && inactionMap[c.day] && !c.data;
            var hasData = !c.other && c.data && !isInaction;

            var cellBg = 'rgba(255,255,255,0.02)';
            var cellBorder = '1px solid rgba(255,255,255,0.04)';
            var numColor = c.other ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)';

            if (hasData) {
              var isWin = c.data.pnl >= 0;
              cellBg = isWin ? 'rgba(22, 163, 74, 0.12)' : 'rgba(248, 113, 113, 0.1)';
              cellBorder = isWin ? '1px solid rgba(22, 163, 74, 0.4)' : '1px solid rgba(248, 113, 113, 0.35)';
            } else if (isInaction) {
              cellBg = 'rgba(255, 205, 27, 0.04)';
              cellBorder = '1px solid rgba(255, 205, 27, 0.2)';
            }

            html += '      <div style="background:' + cellBg + ';border:' + cellBorder + ';border-radius:8px;padding:5px 4px;min-height:54px;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">';
            
            // Top Row
            html += '        <div style="display:flex;justify-content:space-between;align-items:center;line-height:1;">';
            if (hasData) {
              html += '          <span style="font-size:8px;font-weight:700;color:var(--text-muted);">' + c.data.count + 'T</span>';
            } else if (isInaction) {
              html += '          <span style="font-size:8px;">💤</span>';
            } else {
              html += '          <span></span>';
            }
            html += '          <span style="font-size:10px;font-weight:700;color:' + numColor + ';font-family:var(--mono);">' + c.day + '</span>';
            html += '        </div>';

            // Center P&L
            if (hasData) {
              var isWin = c.data.pnl >= 0;
              var pnlAbs = Math.abs(c.data.pnl);
              var pnlStr = (isWin ? '+' : '-') + (pnlAbs >= 1000 ? '$' + (pnlAbs/1000).toFixed(1) + 'K' : '$' + pnlAbs.toFixed(0));
              var pnlDayColor = isWin ? '#16a34a' : '#f87171';

              html += '        <div style="font-size:11px;font-weight:900;color:' + pnlDayColor + ';font-family:var(--mono);line-height:1;margin:2px 0;text-align:center;">' + pnlStr + '</div>';

              // Bottom Mood / Disc
              var domEmo = null, domCount = 0;
              Object.keys(c.data.emotions).forEach(function(ek){
                if(c.data.emotions[ek] > domCount) { domCount = c.data.emotions[ek]; domEmo = ek; }
              });

              html += '        <div style="font-size:9.5px;line-height:1;text-align:center;">' + (domEmo ? (emoIcons[domEmo] || '🎯') : '🎯') + '</div>';
            } else if (isInaction) {
              html += '        <div style="font-size:8px;color:rgba(255,205,27,0.7);font-weight:500;text-align:center;line-height:1;">Descanso</div>';
              html += '        <div></div>';
            } else {
              html += '        <div></div><div></div>';
            }

            html += '      </div>';
          });
          html += '    </div>';
        }
        html += '  </div>';
        html += '</div>';

        // ── TRADER SIGNATURE FOOTER (Centered) ──
        html += '<div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,205,27,0.22);border-radius:18px;padding:12px 18px;display:flex;align-items:center;justify-content:center;text-align:center;">';
        html += '  <div style="display:flex;align-items:center;justify-content:center;gap:12px;">';
        if (avatarImgSrc) {
          html += '    <img src="' + avatarImgSrc + '" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:1.5px solid #ffcd1b;">';
        } else {
          html += '    <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg, #ffcd1b, #a67726);color:#000;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:15px;">' + (userName.charAt(0).toUpperCase() || 'S') + '</div>';
        }
        html += '    <div style="text-align:left;">';
        html += '      <div style="font-size:14px;font-weight:800;color:#fff;line-height:1.2;">' + userName + '</div>';
        html += '      <div style="font-size:9.5px;font-weight:700;color:#ffcd1b;letter-spacing:0.8px;text-transform:uppercase;margin-top:2px;">👑 GoldFX Certified Trader</div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';

        container.innerHTML = html;
      }

      async function downloadCalendarExportImage() {
        const card = document.getElementById('cal-export-card');
        if (!card) return;
        if (typeof html2canvas === 'undefined') {
          alert('El módulo de captura no se encuentra cargado. Por favor recarga la página.');
          return;
        }
        const btn = document.getElementById('btn-dl-cal-img');
        const txt = document.getElementById('txt-dl-cal-img');
        const originalTxt = txt ? txt.textContent : 'Descargar PNG';
        if (txt) txt.textContent = 'Generando... ⏳';
        if (btn) btn.disabled = true;

        try {
          const canvas = await html2canvas(card, {
            scale: 2.5,
            backgroundColor: '#070709',
            useCORS: true,
            logging: false
          });

          const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          const yr = calDate.getFullYear(), mo = calDate.getMonth();
          const fileName = 'GoldFX_Calendario_' + months[mo] + '_' + yr + '.png';

          const link = document.createElement('a');
          link.download = fileName;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          if (txt) txt.textContent = '¡Descargado! ✅';
          setTimeout(function () {
            if (txt) txt.textContent = originalTxt;
            if (btn) btn.disabled = false;
          }, 2000);
        } catch (err) {
          console.error('Error generating calendar image:', err);
          alert('No se pudo generar la imagen del calendario. Por favor intenta de nuevo.');
          if (txt) txt.textContent = originalTxt;
          if (btn) btn.disabled = false;
        }
      }

      async function copyCalendarExportImage() {
        const card = document.getElementById('cal-export-card');
        if (!card) return;
        if (typeof html2canvas === 'undefined') {
          alert('El módulo de captura no se encuentra cargado. Por favor recarga la página.');
          return;
        }
        const btn = document.getElementById('btn-copy-cal-img');
        const txt = document.getElementById('txt-copy-cal-img');
        const originalTxt = txt ? txt.textContent : 'Copiar Imagen';
        if (txt) txt.textContent = 'Copiando... ⏳';
        if (btn) btn.disabled = true;

        try {
          const canvas = await html2canvas(card, {
            scale: 2.5,
            backgroundColor: '#070709',
            useCORS: true,
            logging: false
          });

          canvas.toBlob(async function (blob) {
            if (!blob) {
              throw new Error('No se pudo convertir el canvas a blob');
            }
            try {
              if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
                await navigator.clipboard.write([
                  new ClipboardItem({ 'image/png': blob })
                ]);
                if (txt) txt.textContent = '¡Copiado! ✅';
              } else {
                downloadCalendarExportImage();
                if (txt) txt.textContent = 'Descargado 📥';
              }
            } catch (clipErr) {
              console.warn('Clipboard write failed, downloading instead:', clipErr);
              downloadCalendarExportImage();
              if (txt) txt.textContent = 'Descargado 📥';
            }
            setTimeout(function () {
              if (txt) txt.textContent = originalTxt;
              if (btn) btn.disabled = false;
            }, 2500);
          }, 'image/png');
        } catch (err) {
          console.error('Error copying calendar image:', err);
          alert('No se pudo copiar la imagen al portapapeles.');
          if (txt) txt.textContent = originalTxt;
          if (btn) btn.disabled = false;
        }
      }

      // ── Inaction Day (Día sin Operar) ──
      function openInactionModal(dateStr) {
        document.getElementById('inaction-date').value = dateStr;
        var parts = dateStr.split('-');
        var label = parts[2] + '/' + parts[1] + '/' + parts[0];
        document.getElementById('inaction-date-label').textContent = '📅 ' + label;
        // Reset reason buttons
        document.querySelectorAll('#inaction-reason-sel .setup-btn').forEach(function(b){ b.classList.remove('active'); });
        document.getElementById('inaction-reason').value = '';
        openModal('inaction-modal');
      }

      async function saveInactionDay() {
        var dateVal = document.getElementById('inaction-date').value;
        var reason = document.getElementById('inaction-reason').value;
        if (!reason) { alert('Selecciona una razón.'); return; }
        var user = sb.getUser(); if (!user) return;

        var acctEl = document.getElementById('tm-account');
        var account = acctEl ? acctEl.value : 'Global';

        var tradeData = {
          user_id: user.id,
          account: account,
          asset: 'INACCIÓN',
          side: 'Long',
          pnl: 0,
          rr: 0,
          session: 'Otra',
          setup: '',
          date: dateVal,
          photo: null,
          notes: reason
        };

        showLoading(true);
        try {
          var result = await sb.insert('trades', tradeData);
          var saved = Array.isArray(result) ? result[0] : result;
          if (saved && saved.id) trades.push(tradeFromRow(saved));
        } catch(e) { console.error('Error guardando inacción:', e); alert('Error al guardar.'); }
        finally { showLoading(false); }
        closeModal('inaction-modal'); renderAll();
      }
      // ── STATS ──
            function renderStats() {
        var trades;
        if (stMode === 'global') {
          updateStMonthTitle();
          trades = getFilteredTrades();
        } else {
          updateStMonthTitle();
          trades = getStFilteredTrades();
        }
        const s = computeStats(trades);
        
        // Update header summary pills
        var hPnl = document.getElementById('st-hdr-pnl');
        var hWr = document.getElementById('st-hdr-wr');
        var hCnt = document.getElementById('st-hdr-count');
        if (hPnl) { hPnl.textContent = (s.netPnl >= 0 ? '+' : '') + '$' + s.netPnl.toFixed(2); hPnl.style.color = s.netPnl >= 0 ? 'var(--green)' : 'var(--red)'; }
        if (hWr) { hWr.textContent = s.winRate.toFixed(1) + '%'; hWr.style.color = s.winRate >= 50 ? 'var(--green)' : 'var(--red)'; }
        if (hCnt) hCnt.textContent = s.total;
        
        function sv(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }
        sv('st-total', s.total);
        sv('st-wins', '<span class="badge-0 g">' + s.wins + '</span>');
        sv('st-losses', '<span class="badge-0 r">' + s.losses + '</span>');
        sv('st-bes', '<span class="badge-0" style="background:rgba(168,85,247,0.15);color:var(--purple)">' + s.bes + '</span>');
        sv('st-bedays', s.beDays);
        sv('st-wr', '<span style="color:' + (s.winRate >= 50 ? 'var(--green)' : 'var(--red)') + '">' + s.winRate.toFixed(1) + '%</span>');
        sv('st-pf', '<span style="color:' + (s.profitFactor >= 1 ? 'var(--green)' : 'var(--red)') + '">' + (isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞') + '</span>');
        sv('st-exp', '<span style="color:' + (s.expectancy >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (s.expectancy >= 0 ? '+' : '') + '$' + s.expectancy.toFixed(2) + '</span>');
        sv('st-avgw', '+$' + s.avgWin.toFixed(2));
        sv('st-avgl', '-$' + s.avgLoss.toFixed(2));
        sv('st-payoff', isFinite(s.payoffRatio) ? s.payoffRatio.toFixed(2) : '∞');
        sv('st-best', '+$' + s.bestTrade.toFixed(2));
        sv('st-worst', '$' + s.worstTrade.toFixed(2));
        sv('st-dd', s.maxDD.toFixed(2) + '%');
        sv('st-rr', s.avgWinRR.toFixed(2) + 'R');

        // By asset
        var assetMap = {};
        trades.forEach(function (t) { 
          if (t.asset === 'INACCIÓN') return;
          if (!assetMap[t.asset]) assetMap[t.asset] = { pnl: 0, count: 0, wins: 0, losses: 0, bes: 0 }; 
          assetMap[t.asset].pnl += t.pnl; 
          assetMap[t.asset].count++; 
          var isWin = t.result_type === 'TP' || (t.result_type !== 'SL' && t.result_type !== 'BE' && t.pnl >= 0.01);
          var isLoss = t.result_type === 'SL' || (t.result_type !== 'TP' && t.result_type !== 'BE' && t.pnl <= -0.01);
          var isBE = t.result_type === 'BE' || (t.result_type !== 'TP' && t.result_type !== 'SL' && t.pnl > -0.01 && t.pnl < 0.01);
          if (isWin) assetMap[t.asset].wins++; 
          else if (isLoss) assetMap[t.asset].losses++;
          else if (isBE) assetMap[t.asset].bes++;
        });
        
        var assetCard = document.getElementById('st-by-asset');
        if (assetCard) { 
          var sorted = Object.entries(assetMap).sort(function (a, b) { return b[1].pnl - a[1].pnl; }); 
          if (sorted.length > 0) {
            sv('st-top-asset', sorted[0][0]);
            sv('st-bot-asset', sorted[sorted.length-1][0]);
          }
          assetCard.innerHTML = '<div class="stats-card-title">Por Activo</div>' + (sorted.length ? sorted.map(function (e) { 
            var c = e[1].pnl >= 0 ? 'var(--green)' : 'var(--red)'; 
            var wr = (e[1].wins / (e[1].count - e[1].bes || 1) * 100).toFixed(0);
            if (e[1].count === e[1].bes) wr = 0;
            return '<div class="stat-row"><span class="stat-row-label">' + e[0] + ' <span style="color:var(--text-muted);font-size:11px">' + wr + '% WR (' + e[1].count + ')</span></span><span style="font-family:var(--mono);font-size:13px;font-weight:600;color:' + c + '">' + (e[1].pnl >= 0 ? '+' : '') + '$' + e[1].pnl.toFixed(2) + '</span></div>'; 
          }).join('') : '<div class="chart-placeholder">Sin datos</div>'); 
        }

        // By session
        var sesMap = {};
        trades.forEach(function (t) { 
          if (t.asset === 'INACCIÓN') return;
          if (!sesMap[t.session]) sesMap[t.session] = { pnl: 0, count: 0, wins: 0, bes: 0 }; 
          sesMap[t.session].pnl += t.pnl; 
          sesMap[t.session].count++; 
          var isWin = t.result_type === 'TP' || (t.result_type !== 'SL' && t.result_type !== 'BE' && t.pnl >= 0.01);
          var isBE = t.result_type === 'BE' || (t.result_type !== 'TP' && t.result_type !== 'SL' && t.pnl > -0.01 && t.pnl < 0.01);
          if (isWin) sesMap[t.session].wins++; 
          if (isBE) sesMap[t.session].bes++;
        });
        var sesCard = document.getElementById('st-by-session');
        if (sesCard) { 
          var sorted2 = Object.entries(sesMap).sort(function (a, b) { return b[1].pnl - a[1].pnl; }); 
          sesCard.innerHTML = '<div class="stats-card-title">Por Sesión</div>' + (sorted2.length ? sorted2.map(function (e) { 
            var c = e[1].pnl >= 0 ? 'var(--green)' : 'var(--red)'; 
            var wr = (e[1].wins / (e[1].count - (e[1].bes || 0) || 1) * 100).toFixed(0); 
            return '<div class="stat-row"><span class="stat-row-label">' + e[0] + ' <span style="color:var(--text-muted);font-size:11px">' + wr + '% WR</span></span><span style="font-family:var(--mono);font-size:13px;font-weight:600;color:' + c + '">' + (e[1].pnl >= 0 ? '+' : '') + '$' + e[1].pnl.toFixed(2) + '</span></div>'; 
          }).join('') : '<div class="chart-placeholder">Sin datos</div>'); 
        }

        // By setup
        var setupMap = {};
        trades.forEach(function (t) { 
          if (t.asset === 'INACCIÓN') return;
          var k = t.setup || '—'; 
          if (!setupMap[k]) setupMap[k] = { pnl: 0, count: 0, wins: 0, bes: 0 }; 
          setupMap[k].pnl += t.pnl; 
          setupMap[k].count++; 
          var isWin = t.result_type === 'TP' || (t.result_type !== 'SL' && t.result_type !== 'BE' && t.pnl >= 0.01);
          var isBE = t.result_type === 'BE' || (t.result_type !== 'TP' && t.result_type !== 'SL' && t.pnl > -0.01 && t.pnl < 0.01);
          if (isWin) setupMap[k].wins++; 
          if (isBE) setupMap[k].bes++;
        });
        var setupCard = document.getElementById('st-by-setup');
        if (setupCard) { 
          var sorted3 = Object.entries(setupMap).sort(function (a, b) { return b[1].pnl - a[1].pnl; }); 
          setupCard.innerHTML = '<div class="stats-card-title">P&L por Setup</div>' + (sorted3.length && trades.length ? sorted3.map(function (e) { 
            var c = e[1].pnl >= 0 ? 'var(--green)' : 'var(--red)'; 
            var wr = (e[1].wins / (e[1].count - (e[1].bes || 0) || 1) * 100).toFixed(0);
            return '<div class="stat-row"><span class="stat-row-label" style="font-family:var(--mono);font-size:12px">' + e[0] + ' <span style="color:var(--text-muted);font-size:10px">' + wr + '% WR</span></span><span style="font-family:var(--mono);font-size:13px;font-weight:600;color:' + c + '">' + (e[1].pnl >= 0 ? '+' : '') + '$' + e[1].pnl.toFixed(2) + ' <span style="color:var(--text-muted);font-weight:400">(' + e[1].count + ')</span></span></div>'; 
          }).join('') : '<div class="chart-placeholder">Sin datos</div>'); 
        }

        // By day
        var dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], dayMap = {};
        trades.forEach(function (t) { 
          if (t.asset === 'INACCIÓN') return;
          var dow = new Date(t.date + 'T00:00:00').getDay(), k = dayNames[dow]; 
          if (!dayMap[k]) dayMap[k] = { pnl: 0, count: 0, wins: 0, bes: 0 }; 
          dayMap[k].pnl += t.pnl; 
          dayMap[k].count++; 
          var isWin = t.result_type === 'TP' || (t.result_type !== 'SL' && t.result_type !== 'BE' && t.pnl >= 0.01);
          var isBE = t.result_type === 'BE' || (t.result_type !== 'TP' && t.result_type !== 'SL' && t.pnl > -0.01 && t.pnl < 0.01);
          if (isWin) dayMap[k].wins++;
          if (isBE) dayMap[k].bes++;
        });
        var dayCard = document.getElementById('st-by-day');
        if (dayCard) { 
          var sorted4 = Object.entries(dayMap).sort(function (a, b) { return b[1].pnl - a[1].pnl; }); 
          dayCard.innerHTML = '<div class="stats-card-title">P&L por Día</div>' + (sorted4.length && trades.length ? sorted4.map(function (e) { 
            var c = e[1].pnl >= 0 ? 'var(--green)' : 'var(--red)'; 
            var wr = (e[1].wins / (e[1].count - (e[1].bes || 0) || 1) * 100).toFixed(0);
            return '<div class="stat-row"><span class="stat-row-label">' + e[0] + ' <span style="color:var(--text-muted);font-size:11px">' + wr + '% WR (' + e[1].count + ')</span></span><span style="font-family:var(--mono);font-size:13px;font-weight:600;color:' + c + '">' + (e[1].pnl >= 0 ? '+' : '') + '$' + e[1].pnl.toFixed(2) + '</span></div>'; 
          }).join('') : '<div class="chart-placeholder">Sin datos</div>'); 
        }

        // By Entry Type
        var entryTypeCard = document.getElementById('st-by-entry-type');
        if (entryTypeCard) {
          var etData = s.byEntryType || {};
          var etSorted = Object.entries(etData).sort(function(a,b){ return b[1].pnl - a[1].pnl; });
          var etIcons = { 'Tradicional':'📌', 'Secuencial':'🔄', 'Transicional':'🔀', 'Reacción':'⚡' };
          entryTypeCard.innerHTML = '<div class="stats-card-title">🎯 Por Tipo de Entrada</div>' + (etSorted.length ? etSorted.map(function(e){
            var c = e[1].pnl >= 0 ? 'var(--green)' : 'var(--red)';
            var wr = e[1].count ? (e[1].wins / (e[1].count - (e[1].bes || 0) || 1) * 100).toFixed(0) : '0';
            var icon = etIcons[e[0]] || '📌';
            return '<div class="stat-row"><span class="stat-row-label">' + icon + ' ' + e[0] + ' <span style="color:var(--text-muted);font-size:10px">' + wr + '% WR</span></span><span style="font-family:var(--mono);font-size:13px;font-weight:600;color:' + c + '">' + (e[1].pnl >= 0 ? '+' : '') + '$' + e[1].pnl.toFixed(2) + ' <span style="color:var(--text-muted);font-weight:400">(' + e[1].count + ')</span></span></div>';
          }).join('') : '<div class="chart-placeholder">Sin datos</div>');
        }

        // Monthly Performance table in st-by-plan card
        var planCard = document.getElementById('st-by-plan');
        if (planCard) {
          var totalInitBal = accounts.reduce(function(sum,a){ return sum + a.initialBalance; }, 0) || 1;
          var monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
          var yearMap = {};
          var yearDiscMap = {};
          
          var allTradesForSt = getFilteredTrades();
          allTradesForSt.forEach(function(t){
            if (t.asset === 'INACCIÓN') return;
            var yr = t.date.slice(0,4), mo = parseInt(t.date.slice(5,7),10)-1;
            if (!yearMap[yr]) yearMap[yr] = {};
            if (!yearMap[yr][mo]) yearMap[yr][mo] = 0;
            yearMap[yr][mo] += t.pnl;

            if (!yearDiscMap[yr]) yearDiscMap[yr] = {};
            if (!yearDiscMap[yr][mo]) yearDiscMap[yr][mo] = [];
            if (t.discipline_score != null && t.discipline_score !== "") {
              yearDiscMap[yr][mo].push(parseFloat(t.discipline_score));
            }
          });
          
          var years = Object.keys(yearMap).sort();
          var monthPerfRows = years.map(function(yr){
            var ytd = 0;
            var cells = monthNames.map(function(mn, mi){
              var pnl = yearMap[yr][mi];
              if (pnl === undefined) return '<td style="color:var(--text-muted);text-align:center;">—</td>';
              ytd += pnl;
              var pct = (pnl / totalInitBal * 100);
              var col = pct >= 0 ? 'var(--green)' : 'var(--red)';
              
              var scores = (yearDiscMap[yr] && yearDiscMap[yr][mi]) ? yearDiscMap[yr][mi] : [];
              var avgDisc = scores.length ? Math.round(scores.reduce(function(a,b){return a+b;},0)/scores.length) : null;
              var discHtml = avgDisc !== null ? '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;font-weight:500;">🎯 ' + avgDisc + '%</div>' : '';

              return '<td style="text-align:center;padding:10px 6px;vertical-align:middle;">' +
                       '<div style="font-family:var(--mono);font-size:13px;font-weight:700;color:'+col+'">' + (pct>=0?'+':'') + pct.toFixed(2) + '%</div>' +
                       discHtml +
                     '</td>';
            }).join('');
            var ytdPct = (ytd / totalInitBal * 100);
            var ytdCol = ytdPct >= 0 ? 'var(--green)' : 'var(--red)';
            var ytdCell = '<td style="text-align:center;font-family:var(--mono);font-size:13px;font-weight:800;color:'+ytdCol+';padding:10px 8px;border-left:1px solid var(--border);">' + (ytdPct>=0?'+':'') + ytdPct.toFixed(2) + '%</td>';
            return '<tr><td style="font-weight:800;font-size:14px;color:var(--text-primary);padding:10px 12px;white-space:nowrap;">'+yr+'</td>' + cells + ytdCell + '</tr>';
          }).join('');

          var html = '<div class="stats-card-title" style="margin-bottom:14px;">Evolución Mensual (Rendimiento)</div>' +
            '<div style="overflow-x:auto;">' +
            '<table style="width:100%;border-collapse:collapse;min-width:700px;">' +
            '<thead><tr>' +
            '<th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">Año</th>' +
            monthNames.map(function(m){ return '<th style="text-align:center;padding:8px 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">'+m+'</th>'; }).join('') +
            '<th style="text-align:center;padding:8px 8px;font-size:11px;font-weight:700;letter-spacing:1px;color:var(--green);text-transform:uppercase;border-bottom:1px solid var(--border);border-left:1px solid var(--border);">YTD</th>' +
            '</tr></thead>' +
            '<tbody>' + (monthPerfRows || '<tr><td colspan="14" style="text-align:center;padding:20px;color:var(--text-muted);">Sin datos</td></tr>') + '</tbody>' +
            '</table></div>';
          
          planCard.innerHTML = html;
        }
      }

function renderAccounts() {
        const grid = document.getElementById('accounts-grid'); if (!grid) return;
        try {
          grid.innerHTML = accounts.map(function (acct) {
            try {
              var at = trades.filter(function (t) { return t.account === acct.name; }), as = computeStats(at);
              var bal = (parseFloat(acct.initialBalance) || 0) + (as.netPnl || 0);
              var pc2 = (as.netPnl || 0) >= 0 ? 'var(--green)' : 'var(--red)';
              
              var nameForId = (acct.name || '').replace(/\s/g, '_');
              var sbEl = document.getElementById('sb-bal-' + nameForId);
              if (sbEl) {
                sbEl.textContent = '$' + bal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
              
              var safeId = acct.id || '';
              var initBalVal = parseFloat(acct.initialBalance) || 0;
              var winRateVal = parseFloat(as.winRate) || 0;
              var netPnlVal = parseFloat(as.netPnl) || 0;
              
              return '<div class="ac-card">' +
                '<div class="ac-hdr">' +
                '<div class="ac-ico ' + (acct.iconClass || '') + '">' + (acct.icon || '💼') + '</div>' +
                '<div class="ac-ttl"><div class="ac-name">' + (acct.name || 'Sin nombre') + '</div><div class="ac-sub">' + (acct.type || '') + ' · ' + (acct.broker || '') + '</div></div>' +
                '<div class="ac-actions">' +
                '<button class="ta" title="Añadir Depósito o Retiro" data-id="' + safeId + '" onclick="openDepositModal(this.dataset.id)" style="font-size:11px;font-weight:700;color:#ffcd1b;background:rgba(255,205,27,0.12);border:1px solid rgba(255,205,27,0.3);border-radius:6px;padding:4px 8px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">💵 + Depósito</button>' +
                '<button class="ta e" title="Editar" data-id="' + safeId + '" onclick="openEditAccount(this.dataset.id)">✏️</button>' +
                '<button class="ta d" title="Eliminar" data-id="' + safeId + '" onclick="openDeleteAccount(this.dataset.id)">🗑️</button>' +
                '</div>' +
                '</div>' +
                '<div class="ac-stats">' +
                '<div class="ac-stat"><div class="ac-stat-l">Capital Base</div><div class="ac-stat-v">$' + initBalVal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</div></div>' +
                '<div class="ac-stat"><div class="ac-stat-l">Balance Actual</div><div class="ac-stat-v" style="color:' + pc2 + '">$' + bal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</div></div>' +
                '<div class="ac-stat"><div class="ac-stat-l">Net P&L (Trading)</div><div class="ac-stat-v ' + (netPnlVal >= 0 ? 'green' : 'red') + '">' + (netPnlVal >= 0 ? '+' : '') + '$' + netPnlVal.toFixed(2) + '</div></div>' +
                '<div class="ac-stat"><div class="ac-stat-l">Win Rate</div><div class="ac-stat-v ' + (winRateVal >= 50 ? 'green' : 'red') + '">' + winRateVal.toFixed(1) + '%</div></div>' +
                '<div class="ac-stat full"><div class="ac-stat-l">Operaciones Registradas</div><div class="ac-stat-v">' + (as.total || 0) + ' trades</div></div>' +
                '</div></div>';
            } catch (innerErr) {
              console.error("Error rendering card for account:", acct, innerErr);
              return '<div class="ac-card"><div style="padding:15px;color:var(--red);font-size:12px;">Error al renderizar: ' + innerErr.message + '</div></div>';
            }
          }).join('');
        } catch (err) {
          console.error("Error in renderAccounts:", err);
          grid.innerHTML = '<div style="color:var(--red);padding:20px;font-weight:600;">Error al cargar las cuentas: ' + err.message + '</div>';
        }
      }

      // ── ANÁLISIS (Heatmap + Streak) ──
                  function drawFreqBars(canvasId, labels, data) {
        var canvas = document.getElementById(canvasId); if (!canvas) return;
        var dpr = window.devicePixelRatio || 1;
        var W = canvas.offsetWidth, H = 130;
        canvas.width = W * dpr; canvas.height = H * dpr;
        var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
        var maxVal = Math.max.apply(null, data) || 1;
        var n = labels.length;
        var padL = 24, padR = 8, padT = 10, padB = 24;
        var cw = W - padL - padR, ch = H - padT - padB;
        var barW = Math.max(4, Math.floor(cw / n * 0.55));
        var gap  = cw / n;

        // Y axis grid lines
        for (var yi = 0; yi <= 4; yi++) {
          var yv = Math.round(maxVal / 4 * yi);
          var yp = padT + ch - (yv / maxVal) * ch;
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(padL, yp); ctx.lineTo(W - padR, yp); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.font = '9px var(--mono)';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(yv, padL - 4, yp);
        }

        // Bars
        data.forEach(function(v, i){
          var x = padL + gap * i + (gap - barW) / 2;
          var bh = (v / maxVal) * ch;
          var y = padT + ch - bh;
          // Gradient
          var grad = ctx.createLinearGradient(0, y, 0, padT + ch);
          grad.addColorStop(0, 'rgba(52,211,153,0.9)');
          grad.addColorStop(1, 'rgba(16,185,129,0.3)');
          ctx.fillStyle = v > 0 ? grad : 'rgba(255,255,255,0.06)';
          var radius = Math.min(4, barW / 2);
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + barW - radius, y);
          ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
          ctx.lineTo(x + barW, padT + ch);
          ctx.lineTo(x, padT + ch);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();

          // Label
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.font = '9px var(--sans)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(labels[i], x + barW / 2, padT + ch + 4);
        });
      }

function renderAnalisis() {
        updateAnMonthTitle();
        const el = document.getElementById('analisis-content'); if (!el) return;
        var trades;
        if (anMode === 'global') {
          trades = getFilteredTrades();
        } else {
          trades = getAnFilteredTrades();
        }
        
        // Update header summary
        var aHPnl = document.getElementById('an-hdr-pnl');
        var aHCnt = document.getElementById('an-hdr-count');
        var tmpS = computeStats(trades);
        if (aHPnl) { aHPnl.textContent = (tmpS.netPnl >= 0 ? '+' : '') + '$' + tmpS.netPnl.toFixed(2); aHPnl.style.color = tmpS.netPnl >= 0 ? 'var(--green)' : 'var(--red)'; }
        if (aHCnt) aHCnt.textContent = tmpS.total;
        
        var operativeTrades = trades.filter(function (t) { return t.asset !== 'INACCIÓN'; });
        if (!operativeTrades.length) { 
          el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔥</div><div class="empty-title">Sin trades en este mes</div></div>'; 
          return; 
        }
        
        const s = computeStats(trades);
        const liveColor = s.liveType === 'w' ? 'g' : 'r';
        const liveLabel = s.liveType === 'w' ? 'Racha ganadora activa' : 'Racha perdedora activa';

        // Heatmap data: hour × day
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const hmap = {}; // hmap[dow][hour] = {pnl, count}
        trades.forEach(function (t) {
          if (t.asset === 'INACCIÓN') return;
          if (!t.entryTime || t.entryTime === '—') return;
          var dow = new Date(t.date + 'T00:00:00').getDay();
          var hr = parseInt(t.entryTime.split(':')[0], 10); if (isNaN(hr)) return;
          if (!hmap[dow]) hmap[dow] = {};
          if (!hmap[dow][hr]) hmap[dow][hr] = { pnl: 0, count: 0 };
          hmap[dow][hr].pnl += t.pnl; hmap[dow][hr].count++;
        });
        
        var maxAbs = 0;
        Object.values(hmap).forEach(function (dayData) { Object.values(dayData).forEach(function (cell) { if (Math.abs(cell.pnl) > maxAbs) maxAbs = Math.abs(cell.pnl); }); });
        if (maxAbs === 0) maxAbs = 1;

        // Build heatmap HTML
        var headerRow = '<div></div>';
        for (var h = 0; h < 24; h++) headerRow += '<div class="hm-hour">' + h + 'h</div>';
        var rows = days.map(function (dayName, dow) {
          var row = '<div class="hm-label">' + dayName + '</div>';
          for (var h = 0; h < 24; h++) {
            var cell = hmap[dow] && hmap[dow][h];
            if (cell && cell.count > 0) {
              var intensity = Math.min(0.9, 0.2 + Math.abs(cell.pnl) / maxAbs * 0.7);
              var bg = cell.pnl >= 0 ? 'rgba(255,205,27,' + intensity + ')' : 'rgba(239,68,68,' + intensity + ')';
              var tip = (cell.pnl >= 0 ? '+' : '') + '$' + cell.pnl.toFixed(0) + ' (' + cell.count + ')';
              row += '<div class="hm-cell" style="background:' + bg + '" title="' + dayName + ' ' + h + 'h: ' + tip + '"></div>';
            } else {
              row += '<div class="hm-cell" style="background:var(--bg-card-inner)"></div>';
            }
          }
          return row;
        }).join('');

        // Trade frequency metrics
        var allTradesForAn = getFilteredTrades();
        var dowCount = [0,0,0,0,0,0,0]; // Sun–Sat
        var weekCount = {}; // ISO week → count
        var monCount = [0,0,0,0,0,0,0,0,0,0,0,0]; // Jan–Dec
        var yearMap = {};
        var yearsSet = {};
        allTradesForAn.forEach(function(t){
          if (t.asset === 'INACCIÓN') return;
          var d = new Date(t.date+'T00:00:00');
          dowCount[d.getDay()]++;
          monCount[d.getMonth()]++;
          
          var yr = t.date.slice(0,4);
          yearsSet[yr] = true;
          if (!yearMap[yr]) yearMap[yr] = {};
          yearMap[yr][d.getMonth()] = true;
          
          // ISO week
          var tmp = new Date(d); tmp.setHours(0,0,0,0);
          tmp.setDate(tmp.getDate()+4-(tmp.getDay()||7));
          var yw = tmp.getFullYear()*100 + Math.ceil(((tmp-new Date(tmp.getFullYear(),0,1))/86400000+1)/7);
          weekCount[yw] = (weekCount[yw]||0)+1;
        });
        
        var weekVals = Object.values(weekCount);
        var totalTrades = allTradesForAn.filter(t => t.asset !== 'INACCIÓN').length;
        var numYears = Math.max(Object.keys(yearsSet).length, 1);
        var avgDay  = totalTrades > 0 ? (totalTrades / (numYears * 365) * 7).toFixed(1) : '0';
        var avgWeek = weekVals.length > 0 ? (weekVals.reduce(function(a,b){return a+b;},0)/weekVals.length).toFixed(1) : '0';
        var avgMon  = totalTrades > 0 ? (totalTrades / (numYears * 12)).toFixed(1) : '0';

        el.innerHTML =
          // Bloque 1: Cerebro GoldFX (Hallazgos)
          generateInsights(trades) +
          
          // Bloque 2: Desglose de Disciplina
          getDisciplineBreakdown(trades) +
          
          // Streaks (Rachas)
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:18px;">' +
            '<div class="stats-card" style="text-align:center;padding:18px;">' +
              '<div class="streak-num ' + liveColor + '">' + s.liveStreak + '</div>' +
              '<div class="streak-lbl" style="margin-top:6px">' + liveLabel + '</div>' +
            '</div>' +
            '<div class="stats-card" style="text-align:center;padding:18px;">' +
              '<div class="streak-num g">' + s.bestWinStreak + '</div>' +
              '<div class="streak-lbl" style="margin-top:6px">Mejor racha ganadora</div>' +
            '</div>' +
            '<div class="stats-card" style="text-align:center;padding:18px;">' +
              '<div class="streak-num r">' + s.worstLossStreak + '</div>' +
              '<div class="streak-lbl" style="margin-top:6px">Peor racha perdedora</div>' +
            '</div>' +
            '<div class="stats-card" style="text-align:center;padding:18px;">' +
              '<div class="streak-num y">' + s.total + '</div>' +
              '<div class="streak-lbl" style="margin-top:6px">Total trades</div>' +
            '</div>' +
          '</div>' +
          
          // Heatmap
          '<div class="stats-card" style="margin-bottom:18px;">' +
            '<div class="stats-card-title">Heatmap: P&L por Hora y Día</div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">Basado en hora de entrada · Verde = ganancia · Rojo = pérdida · Más intenso = mayor monto</div>' +
            '<div class="heatmap-wrap"><div class="heatmap-grid">' + headerRow + rows + '</div></div>' +
          '</div>' +
          
          // Trade Frequency
          '<div style="margin-bottom:8px;">' +
            '<div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:14px;">Frecuencia de trades</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">' +
              // By day of week
              '<div class="stats-card">' +
                '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:3px;">Por día de semana</div>' +
                '<div style="font-size:12px;color:var(--green);margin-bottom:14px;">Avg ' + avgDay + ' trades/día</div>' +
                '<canvas id="freq-dow-canvas" height="130" style="width:100%;display:block;"></canvas>' +
              '</div>' +
              // By week
              '<div class="stats-card">' +
                '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:3px;">Por semana</div>' +
                '<div style="font-size:12px;color:var(--green);margin-bottom:14px;">Avg ' + avgWeek + ' trades/semana</div>' +
                '<canvas id="freq-week-canvas" height="130" style="width:100%;display:block;"></canvas>' +
              '</div>' +
              // By month
              '<div class="stats-card">' +
                '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:3px;">Por mes</div>' +
                '<div style="font-size:12px;color:var(--green);margin-bottom:14px;">Avg ' + avgMon + ' trades/mes</div>' +
                '<canvas id="freq-mon-canvas" height="130" style="width:100%;display:block;"></canvas>' +
              '</div>' +
            '</div>' +
          '</div>';

        // Draw frequency bar charts
        requestAnimationFrame(function(){
          var dowLabels = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
          var dowData   = [dowCount[1],dowCount[2],dowCount[3],dowCount[4],dowCount[5],dowCount[6],dowCount[0]];
          drawFreqBars('freq-dow-canvas', dowLabels, dowData);

          var wkSorted = Object.keys(weekCount).sort();
          var wkLabels = wkSorted.map(function(k){ return String(parseInt(String(k).slice(-2),10)); });
          var wkData   = wkSorted.map(function(k){ return weekCount[k]; });
          drawFreqBars('freq-week-canvas', wkLabels, wkData);

          drawFreqBars('freq-mon-canvas', ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'], monCount);
        });
      }

function _renderAnalisis_orig() {
      }

      // ── COMPARAR MESES ──
      function renderComparar() {
        // Build month list from trades
        var monthSet = {};
        trades.forEach(function (t) { var m = t.date.slice(0, 7); monthSet[m] = true; });
        var months = Object.keys(monthSet).sort();
        var selA = document.getElementById('cmp-a'), selB = document.getElementById('cmp-b');
        if (!selA || !selB) return;
        var prevA = selA.value, prevB = selB.value;
        var opts = months.map(function (m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');
        selA.innerHTML = opts; selB.innerHTML = opts;
        if (months.length >= 2) { selA.value = prevA && monthSet[prevA] ? prevA : months[months.length - 2]; selB.value = prevB && monthSet[prevB] ? prevB : months[months.length - 1]; }
        else if (months.length === 1) { selA.value = months[0]; selB.value = months[0]; }
        var content = document.getElementById('comparar-content'); if (!content) return;
        if (!months.length) { content.innerHTML = '<div class="empty-state"><div class="empty-icon">↔️</div><div class="empty-title">Sin trades todavía</div></div>'; return; }
        var mA = selA.value, mB = selB.value;
        var tA = trades.filter(function (t) { return t.date.slice(0, 7) === mA; }), tB = trades.filter(function (t) { return t.date.slice(0, 7) === mB; });
        var sA = computeStats(tA), sB = computeStats(tB);
        function metricRow(label, va, vb, higher) {
          var aWin = higher === 'higher' ? (va >= vb) : (va <= vb);
          var ca = aWin ? 'var(--green)' : 'var(--text-secondary)', cb = aWin ? 'var(--text-secondary)' : 'var(--green)';
          return '<div class="stat-row"><span class="stat-row-label">' + label + '</span>' +
            '<div style="display:flex;gap:24px;align-items:center;">' +
            '<span style="font-family:var(--mono);font-size:13px;font-weight:600;color:' + ca + '">' + va + '</span>' +
            '<span style="font-family:var(--mono);font-size:13px;font-weight:600;color:' + cb + '">' + vb + '</span>' +
            '</div></div>';
        }
        content.innerHTML =
          '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0;margin-bottom:16px;align-items:center;">' +
          '<div style="font-size:16px;font-weight:700;color:var(--text-primary)">' + mA + '</div>' +
          '<div style="padding:0 24px;font-size:20px;color:var(--text-muted)">↔</div>' +
          '<div style="font-size:16px;font-weight:700;color:var(--text-primary);text-align:right">' + mB + '</div>' +
          '</div>' +
          '<div class="cmp-grid">' +
          '<div class="cmp-card"><div class="cmp-title" style="color:' + (sA.netPnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + mA + ' — ' + (sA.netPnl >= 0 ? '+' : '') + '$' + sA.netPnl.toFixed(2) + '</div>' +
          metricRow('Trades', sA.total, sB.total, 'higher') +
          metricRow('Win Rate', sA.winRate.toFixed(1) + '%', sB.winRate.toFixed(1) + '%', 'higher') +
          metricRow('Net P&L', '$' + sA.netPnl.toFixed(2), '$' + sB.netPnl.toFixed(2), 'higher') +
          metricRow('Profit Factor', isFinite(sA.profitFactor) ? sA.profitFactor.toFixed(2) : '∞', isFinite(sB.profitFactor) ? sB.profitFactor.toFixed(2) : '∞', 'higher') +
          metricRow('Avg Win', '$' + sA.avgWin.toFixed(2), '$' + sB.avgWin.toFixed(2), 'higher') +
          metricRow('Avg Loss', '$' + sA.avgLoss.toFixed(2), '$' + sB.avgLoss.toFixed(2), 'lower') +
          metricRow('Max DD', sA.maxDD.toFixed(2) + '%', sB.maxDD.toFixed(2) + '%', 'lower') +
          metricRow('Best Win Streak', sA.bestWinStreak, sB.bestWinStreak, 'higher') +
          '</div>' +
          '<div class="cmp-card"><div class="cmp-title" style="color:' + (sB.netPnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + mB + ' — ' + (sB.netPnl >= 0 ? '+' : '') + '$' + sB.netPnl.toFixed(2) + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:0;">' +
          '<div class="stat-row"><span class="stat-row-label" style="font-size:11px;text-transform:uppercase;letter-spacing:.5px">Mejor activo ' + mA + '</span><span style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--green)">' + getBestAsset(tA) + '</span></div>' +
          '<div class="stat-row"><span class="stat-row-label" style="font-size:11px;text-transform:uppercase;letter-spacing:.5px">Mejor activo ' + mB + '</span><span style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--green)">' + getBestAsset(tB) + '</span></div>' +
          '<div class="stat-row"><span class="stat-row-label" style="font-size:11px;text-transform:uppercase;letter-spacing:.5px">Mejor sesión ' + mA + '</span><span style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--green)">' + getBestSession(tA) + '</span></div>' +
          '<div class="stat-row" style="border:none"><span class="stat-row-label" style="font-size:11px;text-transform:uppercase;letter-spacing:.5px">Mejor sesión ' + mB + '</span><span style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--green)">' + getBestSession(tB) + '</span></div>' +
          '</div></div>' +
          '</div>';
      }
      function getBestAsset(tlist) { if (!tlist.length) return '—'; var m = {}; tlist.forEach(function (t) { if (t.asset === 'INACCIÓN') return; if (!m[t.asset]) m[t.asset] = 0; m[t.asset] += t.pnl; }); var best = Object.entries(m).sort(function (a, b) { return b[1] - a[1]; })[0]; return best ? best[0] + ' ($' + best[1].toFixed(0) + ')' : '—'; }

      function getBestSession(tlist) {
        if (!tlist || !tlist.length) return '—';
        var m = {};
        tlist.forEach(function (t) {
          if (t.asset === 'INACCIÓN' || !t.session || t.session === '—') return;
          if (!m[t.session]) m[t.session] = 0;
          m[t.session] += t.pnl;
        });
        var entries = Object.entries(m).sort(function (a, b) { return b[1] - a[1]; });
        return entries.length ? entries[0][0] + ' ($' + entries[0][1].toFixed(0) + ')' : '—';
      }

      // ── Global window exposures for 01_journal ──
      window.openTradeModal = openTradeModal;
      window.addTrade = addTrade;
      window.openEditModal = openEditModal;
      window.saveEditTrade = saveEditTrade;
      window.openDeleteModal = openDeleteModal;
      window.confirmDelete = confirmDelete;
      window.openNotesModal = openNotesModal;
      window.openAcctModal = openAcctModal;
      window.createAccount = createAccount;
      window.openEditAccount = openEditAccount;
      window.saveEditAccount = saveEditAccount;
      window.openDeleteAccount = openDeleteAccount;
      window.confirmDeleteAccount = confirmDeleteAccount;
      window.openDepositModal = openDepositModal;
      window.submitDeposit = submitDeposit;
      window.updateDepositModalLabels = updateDepositModalLabels;
      window.toggleAcctDropdown = toggleAcctDropdown;
      window.setAccountFilter = setAccountFilter;
      window.setAccountFilterDropdown = setAccountFilterDropdown;
      window.toggleDetailPanel = toggleDetailPanel;
      window.showTradePanel = showTradePanel;
      window.openTradeDetail = openTradeDetail;
      window.openDayDetail = openDayDetail;
      window.changeMonth = changeMonth;
      window.goToday = goToday;
      window.changeTlMonth = changeTlMonth;
      window.goTlToday = goTlToday;
      window.changeStMonth = changeStMonth;
      window.goStToday = goStToday;
      window.changeAnMonth = changeAnMonth;
      window.goAnToday = goAnToday;
      window.setTlMode = setTlMode;
      window.setStMode = setStMode;
      window.setAnMode = setAnMode;
      window.renderComparar = renderComparar;
      window.openJumpPicker = openJumpPicker;
      window.applyJumpPicker = applyJumpPicker;
      window.openCalendarExportModal = openCalendarExportModal;
      window.copyCalendarExportImage = copyCalendarExportImage;
      window.downloadCalendarExportImage = downloadCalendarExportImage;
      window.openInactionModal = openInactionModal;
      window.saveInactionDay = saveInactionDay;
      window.selectSetupBtn = selectSetupBtn;
      window.selectSetupBtnByVal = selectSetupBtnByVal;
      window.resetSetupSelectors = resetSetupSelectors;
      window.selectNews = selectNews;
      window.setBE = setBE;
      window.applyBe = applyBe;
      window.togglePlanWhy = togglePlanWhy;
      window.switchEqTab = switchEqTab;
      window.handlePhoto = handlePhoto;
      window.removePhoto = removePhoto;
      window.removePhotoIndex = removePhotoIndex;
      window.dragOver = dragOver;
      window.dropPhoto = dropPhoto;
      window.handleEditPhoto = handleEditPhoto;
      window.removeEditPhoto = removeEditPhoto;
      window.removeEditPhotoIndex = removeEditPhotoIndex;
      window.editDragOver = editDragOver;
      window.editDropPhoto = editDropPhoto;
      window.openLightbox = openLightbox;
      window.openLightboxFromImg = openLightboxFromImg;
      window.openLightboxFromSrc = openLightboxFromSrc;
      window.openLightboxGallery = openLightboxGallery;
      window.closeLightbox = closeLightbox;
      window.closeLightboxOnBg = closeLightboxOnBg;
      window.prevLightboxImage = prevLightboxImage;
      window.nextLightboxImage = nextLightboxImage;
      window.renderAll = renderAll;
      window.initApp = initApp;
      window.loadTrades = loadTrades;
      window.loadAccounts = loadAccounts;
      window.refreshAccountSelects = refreshAccountSelects;
      window.getBestAsset = getBestAsset;
      window.getBestSession = getBestSession;