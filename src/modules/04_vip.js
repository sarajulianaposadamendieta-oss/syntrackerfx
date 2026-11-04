    // ══════════════════════════════════════════════
    // 💎 MÓDULO: BITÁCORA VIP (MODO DESARROLLO PRIVADO - SARA)
    // ══════════════════════════════════════════════
    let activeVipSubtab = 'perfil';
    let currentVipStudentId = 'me';
    let vipStudentProfiles = {};
    let currentVipData = {};
    let currentVipTrades = [];

    window.switchVipSubtab = function(tabName) {
      activeVipSubtab = tabName;
      ['perfil', 'operativa', 'psico', 'calendario', 'tareas', 'evaluaciones', 'evolucion'].forEach(t => {
        const btn = document.getElementById('viptab-btn-' + t);
        const sec = document.getElementById('vip-sec-' + t);
        if (btn) {
          if (t === tabName) btn.classList.add('active');
          else btn.classList.remove('active');
        }
        if (sec) {
          sec.style.display = (t === tabName) ? 'block' : 'none';
        }
      });
      if (tabName === 'operativa') renderVipOperativa(currentVipData, currentVipTrades);
    };

    window.onVipStudentChange = function(studentId) {
      currentVipStudentId = studentId;
      loadVipStudentData(studentId);
    };

    window.refreshVipData = async function() {
      showLoading(true);
      try {
        await renderVipModule();
        if (typeof toast === 'function') toast('Datos de la BITÁCORA VIP actualizados.', 'success');
      } catch (e) {
        console.error('Error refrescando VIP:', e);
      } finally {
        showLoading(false);
      }
    };

    // ── AUDITORÍA 360°: ENTRAR AL JOURNAL COMPLETO DEL ALUMNO ──
    window.launchAuditStudentJournal = async function() {
      if (!isSaraUser()) return;
      let targetStudent = null;
      const u = sb.getUser();
      if (currentVipStudentId === 'me' || (u && currentVipStudentId === u.id)) {
        if (typeof toast === 'function') toast('Selecciona a un estudiante de la lista para auditar su Journal.', 'info');
        return;
      }
      targetStudent = (adminStudentsData || []).find(s => s.id === currentVipStudentId);
      if (!targetStudent) {
        if (typeof toast === 'function') toast('No se encontró al estudiante seleccionado.', 'warning');
        return;
      }

      auditedStudent = targetStudent;
      const banner = document.getElementById('vip-audit-mode-banner');
      const nameEl = document.getElementById('vip-audit-banner-student-name');
      const emailEl = document.getElementById('vip-audit-banner-student-email');
      if (banner) {
        banner.style.display = 'flex';
        if (nameEl) nameEl.textContent = targetStudent.name;
        if (emailEl) emailEl.textContent = targetStudent.email;
      }

      showLoading(true);
      try {
        await Promise.all([loadAccounts(), loadTrades()]);
        buildAccountFilter();
        renderAll();
        goTo('dashboard');
        if (typeof toast === 'function') toast(`Modo Auditor Activado: Viendo journal de ${targetStudent.name}`, 'success');
      } catch (e) {
        console.error('Error entrando en modo auditor:', e);
      } finally {
        showLoading(false);
      }
    };

    window.exitAuditStudentJournal = async function() {
      auditedStudent = null;
      const banner = document.getElementById('vip-audit-mode-banner');
      if (banner) banner.style.display = 'none';

      showLoading(true);
      try {
        await Promise.all([loadAccounts(), loadTrades()]);
        buildAccountFilter();
        renderAll();
        goTo('vip');
        if (typeof toast === 'function') toast('Has salido del modo auditor. Regresaste a tu cuenta.', 'info');
      } catch (e) {
        console.error('Error saliendo de modo auditor:', e);
      } finally {
        showLoading(false);
      }
    };

    // ── PERSISTENCIA Y SINCRONIZACIÓN CLOUD EN SUPABASE ──
    async function getStudentVipData(userId) {
      if (!userId || userId === 'me') {
        const u = sb.getUser();
        if (u && u.id) userId = u.id;
        else return vipStudentProfiles['me'] || {};
      }
      if (vipStudentProfiles[userId]) return vipStudentProfiles[userId];
      try {
        const res = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userId, {
          headers: { 'apikey': ADMIN_SERVICE_KEY, 'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY }
        });
        if (res.ok) {
          const data = await res.json();
          const vipData = (data.user_metadata && data.user_metadata.vip_data) || {};
          vipStudentProfiles[userId] = vipData;
          return vipData;
        }
      } catch (e) {
        console.warn('Error leyendo metadata VIP de Supabase:', e);
      }
      return vipStudentProfiles[userId] || {};
    }

    async function saveStudentVipData(userId, vipData) {
      if (!userId || userId === 'me') {
        const u = sb.getUser();
        if (u && u.id) userId = u.id;
      }
      vipStudentProfiles[userId] = vipData;
      try {
        localStorage.setItem('syntracker_vip_profiles', JSON.stringify(vipStudentProfiles));
      } catch (e) {}

      // Persistir en Supabase Auth metadata usando ADMIN_SERVICE_KEY
      try {
        await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userId, {
          method: 'PUT',
          headers: {
            'apikey': ADMIN_SERVICE_KEY,
            'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_metadata: {
              vip_data: vipData
            }
          })
        });
      } catch (err) {
        console.error('Error sincronizando vip_data en Supabase:', err);
      }
    }

    function getTargetUserId() {
      const u = sb.getUser();
      if (!isAdminUser()) {
        return u ? u.id : 'me';
      }
      if (currentVipStudentId === 'me' || (u && currentVipStudentId === u.id)) {
        return u ? u.id : 'me';
      }
      return currentVipStudentId;
    }

    async function loadVipStudentData(studentId) {
      const u = sb.getUser();
      const isAdmin = isAdminUser();
      const isMe = (!isAdmin || studentId === 'me' || (u && studentId === u.id));
      const targetId = isMe ? (u ? u.id : 'me') : studentId;
      const emailTag = document.getElementById('vip-selected-email-tag');

      const vipData = await getStudentVipData(targetId);
      currentVipData = vipData;

      if (isMe) {
        if (emailTag && u) emailTag.textContent = u.email || '';
      } else {
        const student = (adminStudentsData || []).find(s => s.id === studentId);
        if (student && emailTag) emailTag.textContent = student.email || 'Sin correo';
      }

      // Cargar trades para la pestaña de operativa del perfil
      let studentTrades = Array.isArray(trades) ? [...trades] : [];
      if (!isMe && studentId && studentId !== 'me') {
        try {
          const res = await fetch(SUPABASE_URL + '/rest/v1/trades?select=*&user_id=eq.' + studentId + '&order=date.asc,created_at.asc', {
            headers: { 'apikey': ADMIN_SERVICE_KEY, 'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY }
          });
          if (res.ok) {
            const data = await res.json();
            studentTrades = (Array.isArray(data) ? data : []).map(tradeFromRow);
          }
        } catch (err) {
          console.warn('Error cargando trades de estudiante para VIP:', err);
        }
      }
      currentVipTrades = studentTrades;

      // 1. Cargar campos actuales
      const nivelEl = document.getElementById('vip-field-nivel');
      if (nivelEl) nivelEl.value = vipData.nivel || (isMe ? 'Trader Profesional / Superadmin' : 'Estudiante VIP');
      const capEl = document.getElementById('vip-field-objetivo-capital');
      if (capEl) capEl.value = vipData.objetivoCapital || (isMe ? 'Consolidación de Capital Institucional' : 'Cuenta de Fondeo $50,000 FTMO');
      const expEl = document.getElementById('vip-field-experiencia');
      if (expEl) expEl.value = vipData.experiencia || (isMe ? '3+ años en Mercados Sintéticos' : '1 año en la Academia Gold FX');
      const difTecEl = document.getElementById('vip-field-dif-tecnica');
      if (difTecEl) difTecEl.value = vipData.difTecnica || '';
      const difEmocEl = document.getElementById('vip-field-dif-emocional');
      if (difEmocEl) difEmocEl.value = vipData.difEmocional || '';
      const diagEl = document.getElementById('vip-field-diagnostico-mentor');
      if (diagEl) diagEl.value = '';

      // 2. Renderizar Historiales
      renderVipProfileHistory(vipData);
      renderVipPsicoHistory(vipData);
      renderVipSessions(vipData);
      renderVipHomeworks(vipData);
      renderVipEvaluations(vipData);
      renderVipEvolution(vipData);
      renderVipOperativa(currentVipData, currentVipTrades);
    }

    // ── SUBPESTAÑA 1: PERFIL & DIAGNÓSTICO (HISTORIAL CRONOLÓGICO) ──
    function renderVipProfileHistory(vipData) {
      const container = document.getElementById('vip-profile-history-container');
      if (!container) return;
      const history = Array.isArray(vipData.diagnosis_history) ? vipData.diagnosis_history : [];
      if (history.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:24px; color:#94a3b8; font-size:12.5px; background:rgba(255,255,255,0.02); border-radius:12px; border:1px dashed rgba(255,255,255,0.1);">
            Aún no hay diagnósticos previos registrados. Escribe uno arriba y haz clic en <strong style="color:#facc15;">"Guardar en Historial"</strong>.
          </div>
        `;
        return;
      }

      container.innerHTML = history.slice().reverse().map((item, idx) => {
        const dateStr = item.date ? new Date(item.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente';
        return `
          <div class="vip-glass-card gold-accent" style="padding:18px 20px; position:relative; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="vip-badge-pill gold" style="font-size:10.5px; font-family:var(--mono); padding:3px 10px;">
                  <span class="vip-pulse-dot vip-pulse-gold"></span> 📅 ${dateStr}
                </span>
                <span style="font-size:12.5px; font-weight:800; color:#fff;">✍️ Por: ${escapeHtml(item.author || 'Mentor Gold FX')}</span>
              </div>
              ${isAdminUser() ? `
                <button type="button" class="btn-grey" onclick="deleteVipDiagnosisEntry('${item.id}')" style="font-size:11px; padding:3px 9px; border-radius:6px; color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.08); cursor:pointer;" title="Eliminar este diagnóstico">
                  🗑️ Borrar
                </button>
              ` : ''}
            </div>
            ${item.nivel ? `<div style="font-size:12px; color:#cbd5e1; margin-bottom:4px;"><strong>Nivel Registrado:</strong> <span style="color:#facc15;">${escapeHtml(item.nivel)}</span></div>` : ''}
            ${item.objetivoCapital ? `<div style="font-size:12px; color:#94a3b8; margin-bottom:4px;"><strong>Meta de Capital:</strong> <span style="color:#60a5fa;">${escapeHtml(item.objetivoCapital)}</span></div>` : ''}
            ${item.difTecnica ? `<div style="font-size:12px; color:#fca5a5; margin-bottom:4px;"><strong>Dificultad Técnica:</strong> ${escapeHtml(item.difTecnica)}</div>` : ''}
            ${item.difEmocional ? `<div style="font-size:12px; color:#fde047; margin-bottom:8px;"><strong>Bloqueo Emocional:</strong> ${escapeHtml(item.difEmocional)}</div>` : ''}
            <div style="font-size:13px; color:#f8fafc; line-height:1.6; background:rgba(0,0,0,0.4); border-left:3px solid #facc15; padding:12px 16px; border-radius:8px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.3);">
              ${escapeHtml(item.diagnosis || 'Sin notas adicionales')}
            </div>
          </div>
        `;
      }).join('');
    }

    window.saveVipDiagnosis = async function() {
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);

      const nivel = document.getElementById('vip-field-nivel')?.value || '';
      const objetivoCapital = document.getElementById('vip-field-objetivo-capital')?.value || '';
      const experiencia = document.getElementById('vip-field-experiencia')?.value || '';
      const difTecnica = document.getElementById('vip-field-dif-tecnica')?.value || '';
      const difEmocional = document.getElementById('vip-field-dif-emocional')?.value || '';
      const diagnosisText = document.getElementById('vip-field-diagnostico-mentor')?.value || '';

      if (!diagnosisText.trim() && !difTecnica.trim() && !difEmocional.trim()) {
        if (typeof toast === 'function') toast('Escribe algún detalle o diagnóstico para guardar en el historial.', 'warning');
        return;
      }

      vipData.nivel = nivel;
      vipData.objetivoCapital = objetivoCapital;
      vipData.experiencia = experiencia;
      vipData.difTecnica = difTecnica;
      vipData.difEmocional = difEmocional;

      if (!Array.isArray(vipData.diagnosis_history)) vipData.diagnosis_history = [];

      const u = sb.getUser();
      const authorName = (u && u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || 'Esteban Ochoa (Mentor)';

      vipData.diagnosis_history.push({
        id: 'diag_' + Date.now(),
        date: new Date().toISOString(),
        author: authorName,
        nivel: nivel,
        objetivoCapital: objetivoCapital,
        difTecnica: difTecnica,
        difEmocional: difEmocional,
        diagnosis: diagnosisText
      });

      await saveStudentVipData(targetId, vipData);
      const diagEl = document.getElementById('vip-field-diagnostico-mentor');
      if (diagEl) diagEl.value = '';
      renderVipProfileHistory(vipData);
      if (typeof toast === 'function') toast('Diagnóstico guardado y registrado en el historial.', 'success');
    };

    window.deleteVipDiagnosisEntry = async function(entryId) {
      if (!confirm('¿Eliminar esta entrada de diagnóstico del historial?')) return;
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (Array.isArray(vipData.diagnosis_history)) {
        vipData.diagnosis_history = vipData.diagnosis_history.filter(d => d.id !== entryId);
        await saveStudentVipData(targetId, vipData);
        renderVipProfileHistory(vipData);
        if (typeof toast === 'function') toast('Entrada eliminada del historial.', 'info');
      }
    };

    // ── SUBPESTAÑA 2: OPERATIVA & FEEDBACK AUDITADO ──
    function renderVipOperativa(vipData, tradesList) {
      if (!vipData) vipData = currentVipData || {};
      if (!tradesList) tradesList = currentVipTrades || trades || [];
      const list = Array.isArray(tradesList) ? tradesList : [];
      let totalTrades = list.length;
      let wins = list.filter(t => (t.pnl || 0) > 0).length;
      let winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '70.0';
      let totalPnl = list.reduce((acc, t) => acc + (t.pnl || 0), 0);

      const wrEl = document.getElementById('vip-metric-winrate');
      if (wrEl) wrEl.textContent = winRate + '%';
      const pnlEl = document.getElementById('vip-metric-pnl');
      if (pnlEl) pnlEl.textContent = (totalPnl >= 0 ? '+' : '') + '$' + totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 });

      const tbody = document.getElementById('vip-audit-trades-tbody');
      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:28px; text-align:center; color:#94a3b8;">No hay operaciones registradas aún para este perfil.</td></tr>';
        return;
      }

      const isAdmin = isAdminUser();
      const feedbacks = (vipData && vipData.trade_feedbacks) ? vipData.trade_feedbacks : {};

      const statusMap = {
        'valida': { label: '✓ Válida', bg: 'rgba(74,222,128,0.12)', color: '#4ade80', border: 'rgba(74,222,128,0.3)' },
        'excelente': { label: '⭐ Excelente', bg: 'rgba(234,179,8,0.15)', color: '#facc15', border: 'rgba(234,179,8,0.4)' },
        'reglas': { label: '⚠️ Reglas', bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
        'riesgo': { label: '🔴 Alto Riesgo', bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'rgba(239,68,68,0.4)' },
        'emocional': { label: '🧠 Emocional', bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.4)' }
      };

      tbody.innerHTML = list.slice(-15).reverse().map(t => {
        const pnlVal = t.pnl || 0;
        const pnlColor = pnlVal >= 0 ? '#4ade80' : '#ef4444';
        const pnlText = (pnlVal >= 0 ? '+' : '') + '$' + pnlVal.toFixed(2);
        const dateStr = t.date || (t.created_at ? new Date(t.created_at).toLocaleDateString('es-CO') : 'Hoy');
        const asset = t.symbol || t.asset || 'Vol 75';
        const dir = (t.direction || t.type || 'BUY').toUpperCase();
        const dirColor = dir.includes('BUY') ? '#4ade80' : '#ef4444';
        const tradeId = t.id || (t.ticket ? 'ticket_' + t.ticket : ('t_' + dateStr.replace(/[^a-zA-Z0-9]/g, '_') + '_' + asset));

        const fb = feedbacks[tradeId] || null;
        const stKey = (fb && fb.status) ? fb.status : 'valida';
        const stBadge = statusMap[stKey] || statusMap['valida'];

        let fbContentHtml = '';
        if (fb && fb.comments) {
          fbContentHtml = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <div style="font-size:11.5px; line-height:1.4;">
                <strong style="color:#facc15;">${escapeHtml(fb.mentor || 'Mentor')}:</strong>
                <span style="color:#e2e8f0; margin-left:4px;">${escapeHtml(fb.comments)}</span>
              </div>
              ${isAdmin ? `
                <button type="button" class="btn-grey" onclick="openTradeFeedbackModal('${tradeId}')" title="Editar retroalimentación" style="padding:2px 7px; font-size:10px; border-radius:5px; flex-shrink:0; color:#facc15; border-color:rgba(250,204,21,0.3); background:rgba(250,204,21,0.06); cursor:pointer;">
                  ✏️
                </button>
              ` : ''}
            </div>
          `;
        } else {
          fbContentHtml = isAdmin ? `
            <button type="button" class="btn-grey" onclick="openTradeFeedbackModal('${tradeId}')" style="font-size:11px; font-weight:700; padding:3px 9px; border-radius:6px; color:#facc15; border-color:rgba(250,204,21,0.3); background:rgba(250,204,21,0.06); cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <span>✍️</span> Dar feedback
            </button>
          ` : `
            <span style="color:#64748b; font-style:italic; font-size:11px;">Pendiente por revisión</span>
          `;
        }

        return `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
            <td style="padding:10px 14px; color:#94a3b8; font-family:var(--mono);">${escapeHtml(dateStr)}</td>
            <td style="padding:10px 14px; font-weight:700; color:#fff;">${escapeHtml(asset)}</td>
            <td style="padding:10px 14px; font-weight:800; color:${dirColor};">${escapeHtml(dir)}</td>
            <td style="padding:10px 14px; font-weight:700; color:${pnlColor}; font-family:var(--mono);">${pnlText}</td>
            <td style="padding:10px 14px; color:#cbd5e1; font-family:var(--mono);">${t.rr ? '1 : ' + t.rr : '1 : 2.5'}</td>
            <td style="padding:10px 14px;">
              <span style="background:${stBadge.bg}; color:${stBadge.color}; border:1px solid ${stBadge.border}; font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px;">
                ${stBadge.label}
              </span>
            </td>
            <td style="padding:10px 14px; max-width:280px;">
              ${fbContentHtml}
            </td>
          </tr>
        `;
      }).join('');
    }

    window.openTradeFeedbackModal = function(tradeId) {
      const tradesList = currentVipTrades || trades || [];
      const t = tradesList.find(x => {
        const id = x.id || (x.ticket ? 'ticket_' + x.ticket : ('t_' + (x.date || '').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (x.symbol || x.asset || '')));
        return id === tradeId || x.id === tradeId || (x.ticket && ('ticket_' + x.ticket) === tradeId);
      });

      const idInp = document.getElementById('vip-trade-fb-id');
      const sumEl = document.getElementById('vip-trade-fb-summary');
      const stEl = document.getElementById('vip-trade-fb-status');
      const mentorEl = document.getElementById('vip-trade-fb-mentor');
      const commEl = document.getElementById('vip-trade-fb-comments');
      const delBtn = document.getElementById('vip-trade-fb-btn-delete');

      if (idInp) idInp.value = tradeId;

      if (sumEl) {
        if (t) {
          const pnlVal = t.pnl || 0;
          const pnlColor = pnlVal >= 0 ? '#4ade80' : '#ef4444';
          const pnlText = (pnlVal >= 0 ? '+' : '') + '$' + pnlVal.toFixed(2);
          const dateStr = t.date || (t.created_at ? new Date(t.created_at).toLocaleDateString('es-CO') : 'Hoy');
          const asset = t.symbol || t.asset || 'Vol 75';
          const dir = (t.direction || t.type || 'BUY').toUpperCase();
          sumEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:800; color:#fff;">${escapeHtml(asset)} • ${escapeHtml(dir)}</span>
              <span style="font-weight:800; color:${pnlColor}; font-family:var(--mono);">${pnlText}</span>
            </div>
            <div style="color:#94a3b8; font-size:11px;">Fecha: ${escapeHtml(dateStr)} • R:R: ${t.rr ? '1:' + t.rr : '1:2.5'}</div>
          `;
        } else {
          sumEl.innerHTML = `<span style="color:#94a3b8;">Operación #${escapeHtml(tradeId)}</span>`;
        }
      }

      const u = sb.getUser();
      const staff = getStaffInfo(u);
      const defaultMentor = (u && u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (staff ? staff.adminTitle.replace(/^[^\s]+\s*/, '') : 'Esteban Ochoa (Mentor)');

      const feedbacks = (currentVipData && currentVipData.trade_feedbacks) ? currentVipData.trade_feedbacks : {};
      const fb = feedbacks[tradeId];

      if (fb) {
        if (stEl) stEl.value = fb.status || 'valida';
        if (mentorEl) mentorEl.value = fb.mentor || defaultMentor;
        if (commEl) commEl.value = fb.comments || '';
        if (delBtn) delBtn.style.display = 'inline-block';
      } else {
        if (stEl) stEl.value = 'valida';
        if (mentorEl) mentorEl.value = defaultMentor;
        if (commEl) commEl.value = '';
        if (delBtn) delBtn.style.display = 'none';
      }

      openModal('vip-modal-trade-feedback');
    };

    window.confirmSaveTradeFeedback = async function() {
      const tradeId = document.getElementById('vip-trade-fb-id')?.value;
      if (!tradeId) return;
      const status = document.getElementById('vip-trade-fb-status')?.value || 'valida';
      const mentor = document.getElementById('vip-trade-fb-mentor')?.value.trim() || 'Mentor Gold FX';
      const comments = document.getElementById('vip-trade-fb-comments')?.value.trim() || '';

      if (!comments) {
        if (typeof toast === 'function') toast('Escribe un comentario de retroalimentación antes de guardar.', 'warning');
        return;
      }

      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (!vipData.trade_feedbacks) vipData.trade_feedbacks = {};

      vipData.trade_feedbacks[tradeId] = {
        status: status,
        mentor: mentor,
        comments: comments,
        updated_at: new Date().toISOString()
      };

      currentVipData = vipData;
      await saveStudentVipData(targetId, vipData);
      closeModal('vip-modal-trade-feedback');
      renderVipOperativa(currentVipData, currentVipTrades);
      if (typeof toast === 'function') toast('Retroalimentación de la operación guardada con éxito.', 'success');
    };

    window.deleteTradeFeedback = async function() {
      const tradeId = document.getElementById('vip-trade-fb-id')?.value;
      if (!tradeId) return;
      if (!confirm('¿Deseas eliminar la retroalimentación de esta operación?')) return;

      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (vipData.trade_feedbacks && vipData.trade_feedbacks[tradeId]) {
        delete vipData.trade_feedbacks[tradeId];
        currentVipData = vipData;
        await saveStudentVipData(targetId, vipData);
      }
      closeModal('vip-modal-trade-feedback');
      renderVipOperativa(currentVipData, currentVipTrades);
      if (typeof toast === 'function') toast('Retroalimentación eliminada.', 'info');
    };

    // ── SUBPESTAÑA 3: PSICOTRADING ──
    async function uploadVipDocument(file) {
      if (!file) return null;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}_${safeName}`;
      const res = await fetch(SUPABASE_URL + '/storage/v1/object/vip-documents/' + fileName, {
        method: 'POST',
        headers: {
          'apikey': ADMIN_SERVICE_KEY,
          'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY,
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });
      if (!res.ok) {
        let errMsg = 'Error al subir documento';
        try {
          const eJson = await res.json();
          errMsg = eJson.message || eJson.error || errMsg;
        } catch (e) {}
        throw new Error(errMsg);
      }
      return {
        url: SUPABASE_URL + '/storage/v1/object/public/vip-documents/' + fileName,
        name: file.name,
        size: file.size,
        type: file.type
      };
    }

    let vipSelectedPsicoFile = null;
    window.handleVipPsicoFileSelected = function(input) {
      if (input.files && input.files[0]) {
        vipSelectedPsicoFile = input.files[0];
        const nameEl = document.getElementById('vip-psico-file-name');
        const clearBtn = document.getElementById('vip-psico-file-clear');
        if (nameEl) nameEl.textContent = '📄 ' + vipSelectedPsicoFile.name;
        if (clearBtn) clearBtn.style.display = 'inline-block';
      }
    };
    window.clearVipPsicoFile = function() {
      vipSelectedPsicoFile = null;
      const input = document.getElementById('vip-psico-file');
      if (input) input.value = '';
      const nameEl = document.getElementById('vip-psico-file-name');
      const clearBtn = document.getElementById('vip-psico-file-clear');
      if (nameEl) nameEl.textContent = '';
      if (clearBtn) clearBtn.style.display = 'none';
    };

    let vipSelectedHwFile = null;
    window.handleVipHwFileSelected = function(input) {
      if (input.files && input.files[0]) {
        vipSelectedHwFile = input.files[0];
        const nameEl = document.getElementById('vip-form-hw-file-name');
        const clearBtn = document.getElementById('vip-form-hw-file-clear');
        if (nameEl) nameEl.textContent = '📄 ' + vipSelectedHwFile.name;
        if (clearBtn) clearBtn.style.display = 'inline-block';
      }
    };
    window.clearVipHwFile = function() {
      vipSelectedHwFile = null;
      const input = document.getElementById('vip-form-hw-file');
      if (input) input.value = '';
      const nameEl = document.getElementById('vip-form-hw-file-name');
      const clearBtn = document.getElementById('vip-form-hw-file-clear');
      if (nameEl) nameEl.textContent = '';
      if (clearBtn) clearBtn.style.display = 'none';
    };

    let vipSelectedSubHwFile = null;
    window.handleVipSubHwFileSelected = function(input) {
      if (input.files && input.files[0]) {
        vipSelectedSubHwFile = input.files[0];
        const nameEl = document.getElementById('vip-sub-hw-file-name');
        const clearBtn = document.getElementById('vip-sub-hw-file-clear');
        if (nameEl) nameEl.textContent = '📄 ' + vipSelectedSubHwFile.name;
        if (clearBtn) clearBtn.style.display = 'inline-block';
      }
    };
    window.clearVipSubHwFile = function() {
      vipSelectedSubHwFile = null;
      const input = document.getElementById('vip-sub-hw-file');
      if (input) input.value = '';
      const nameEl = document.getElementById('vip-sub-hw-file-name');
      const clearBtn = document.getElementById('vip-sub-hw-file-clear');
      if (nameEl) nameEl.textContent = '';
      if (clearBtn) clearBtn.style.display = 'none';
    };

    function renderVipPsicoHistory(vipData) {
      const container = document.getElementById('vip-psico-history-container');
      if (!container) return;
      const history = Array.isArray(vipData.psychology_history) ? vipData.psychology_history : [];
      if (history.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:24px; color:#94a3b8; font-size:12.5px; background:rgba(255,255,255,0.02); border-radius:12px; border:1px dashed rgba(255,255,255,0.1);">
            No hay registros emocionales ni notas de psicología guardadas aún.
          </div>
        `;
        return;
      }

      const isAdmin = isAdminUser();
      container.innerHTML = history.slice().reverse().map((item, idx) => {
        const itemId = item.id || ('psico_' + (item.date ? new Date(item.date).getTime() : idx));
        const dateStr = item.date ? new Date(item.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente';
        return `
          <div class="vip-glass-card purple-accent" style="padding:18px 20px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
              <span class="vip-badge-pill purple" style="font-size:10.5px; font-family:var(--mono); padding:3px 10px;">
                <span class="vip-pulse-dot vip-pulse-purple"></span> 📅 ${dateStr}
              </span>
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:12px; font-weight:800; color:#e2e8f0;">Por: ${escapeHtml(item.author || 'Psicología Gold FX')}</span>
                ${isAdmin ? `
                  <button type="button" class="btn-grey" onclick="deleteVipPsicoEntry('${itemId}')" style="font-size:11px; padding:3px 8px; border-radius:6px; color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.06); cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="Eliminar este registro del historial">
                    <span>🗑️</span> Borrar
                  </button>
                ` : ''}
              </div>
            </div>
            ${item.before ? `
              <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
                <span style="font-size:11.5px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:5px 12px; border-radius:8px; color:#cbd5e1;">Antes: <strong style="color:#4ade80;">${escapeHtml(item.before)}</strong></span>
                <span style="font-size:11.5px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:5px 12px; border-radius:8px; color:#cbd5e1;">Durante: <strong style="color:#60a5fa;">${escapeHtml(item.during)}</strong></span>
                <span style="font-size:11.5px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:5px 12px; border-radius:8px; color:#cbd5e1;">Después: <strong style="color:#facc15;">${escapeHtml(item.after)}</strong></span>
              </div>
            ` : ''}
            ${item.notes ? `
              <div style="background:rgba(168,85,247,0.08); border-left:3px solid #c084fc; padding:12px 16px; border-radius:8px; font-size:13px; color:#f3e8ff; line-height:1.6; margin-bottom:8px;">
                <div style="font-size:11px; font-weight:800; color:#c084fc; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:4px;">Nota Profesional Confidencial</div>
                ${escapeHtml(item.notes)}
              </div>
            ` : ''}
            ${item.file?.url ? `
              <div style="margin-top:12px;">
                <a href="${escapeHtml(item.file.url)}" target="_blank" download style="display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(126,34,206,0.2) 100%); color:#e9d5ff; border:1px solid rgba(168,85,247,0.45); padding:8px 16px; border-radius:8px; font-size:12px; font-weight:800; text-decoration:none; box-shadow:0 4px 12px rgba(168,85,247,0.15); transition:all 0.15s ease;">
                  <span style="font-size:14px;">📄</span> Documento Adjunto: <u style="text-underline-offset:2px;">${escapeHtml(item.file.name || 'Archivo')}</u>
                </a>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    window.deleteVipPsicoEntry = async function(entryId) {
      if (!confirm('¿Deseas eliminar este registro de psicotrading del historial?')) return;
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (Array.isArray(vipData.psychology_history)) {
        vipData.psychology_history = vipData.psychology_history.filter((item, idx) => {
          const id = item.id || ('psico_' + (item.date ? new Date(item.date).getTime() : idx));
          return id !== entryId && item.id !== entryId;
        });
        currentVipData = vipData;
        await saveStudentVipData(targetId, vipData);
        renderVipPsicoHistory(vipData);
        if (typeof toast === 'function') toast('Registro de psicotrading eliminado.', 'info');
      }
    };

    window.saveVipEmotionalSession = async function() {
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);

      const before = document.getElementById('vip-psico-antes')?.value || '';
      const during = document.getElementById('vip-psico-durante')?.value || '';
      const after = document.getElementById('vip-psico-despues')?.value || '';

      if (!Array.isArray(vipData.psychology_history)) vipData.psychology_history = [];

      vipData.psychology_history.push({
        id: 'psico_' + Date.now(),
        date: new Date().toISOString(),
        author: 'Trader (Autoevaluación)',
        before: before,
        during: during,
        after: after
      });

      await saveStudentVipData(targetId, vipData);
      renderVipPsicoHistory(vipData);
      if (typeof toast === 'function') toast('Sesión emocional registrada en el historial.', 'success');
    };

    window.saveVipPsychologyNotes = async function() {
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      const notes = document.getElementById('vip-field-notas-psicologa')?.value || '';

      if (!notes.trim() && !vipSelectedPsicoFile) {
        if (typeof toast === 'function') toast('Escribe la nota psicológica o adjunta un documento antes de guardar.', 'warning');
        return;
      }

      showLoading(true);
      try {
        let fileDoc = null;
        if (vipSelectedPsicoFile) {
          fileDoc = await uploadVipDocument(vipSelectedPsicoFile);
        }

        if (!Array.isArray(vipData.psychology_history)) vipData.psychology_history = [];

        vipData.psychology_history.push({
          id: 'psiconote_' + Date.now(),
          date: new Date().toISOString(),
          author: 'Psicóloga Gold FX (Confidencial)',
          notes: notes,
          file: fileDoc
        });

        await saveStudentVipData(targetId, vipData);
        const inputEl = document.getElementById('vip-field-notas-psicologa');
        if (inputEl) inputEl.value = '';
        clearVipPsicoFile();
        renderVipPsicoHistory(vipData);
        if (typeof toast === 'function') toast('Observación y documento guardados en el expediente protegido.', 'success');
      } catch (err) {
        console.error('Error guardando nota psicológica:', err);
        if (typeof toast === 'function') toast('Error al subir documento: ' + (err.message || 'Error en almacenamiento'), 'error');
      } finally {
        showLoading(false);
      }
    };

    // ── SUBPESTAÑA 4: CALENDARIO & SESIONES ──
    function renderVipSessions(vipData) {
      const tbody = document.getElementById('vip-sessions-tbody');
      const sessions = Array.isArray(vipData.sessions) ? vipData.sessions : [];

      // Mini Grid Calendario
      const miniGrid = document.getElementById('vip-calendar-mini-grid');
      if (miniGrid) {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        let gridHtml = days.map(d => `<div style="color:#64748b; font-weight:800; padding:6px 4px; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">${d}</div>`).join('');
        for (let i = 1; i <= 30; i++) {
          const hasSession = sessions.some(s => s.datetime && new Date(s.datetime).getDate() === i);
          const bg = hasSession ? 'background:rgba(234,179,8,0.2); border:1px solid rgba(234,179,8,0.5); color:#facc15; font-weight:800; box-shadow:0 0 10px rgba(234,179,8,0.25);' : 'background:rgba(255,255,255,0.02); color:#94a3b8; border:1px solid rgba(255,255,255,0.04);';
          gridHtml += `<div style="${bg} border-radius:8px; padding:8px 2px; position:relative; font-family:var(--mono);">${i} ${hasSession ? '<span style="color:#facc15;">●</span>' : ''}</div>`;
        }
        miniGrid.innerHTML = gridHtml;
      }

      if (!tbody) return;
      if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:28px; text-align:center; color:#94a3b8;">No hay sesiones agendadas para este estudiante. Haz clic en "Agendar Nueva Sesión".</td></tr>';
        return;
      }

      tbody.innerHTML = sessions.slice().reverse().map(s => {
        let dateFormatted = s.datetime ? new Date(s.datetime).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Por definir';
        const statusMap = {
          agendada: { text: 'Agendada', color: '#facc15', bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', dot: 'vip-pulse-gold' },
          completada: { text: 'Completada', color: '#4ade80', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', dot: 'vip-pulse-green' },
          reprogramada: { text: 'Reprogramada', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', dot: 'vip-pulse-blue' },
          cancelada: { text: 'Cancelada', color: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', dot: 'vip-pulse-red' }
        };
        const st = statusMap[s.status || 'agendada'] || statusMap.agendada;

        return `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s;">
            <td style="padding:12px 16px; font-weight:800; color:#fff; font-family:var(--mono);">${dateFormatted}</td>
            <td style="padding:12px 16px; color:#facc15; font-weight:700;">${escapeHtml(s.type || '1 a 1')}</td>
            <td style="padding:12px 16px; color:#e2e8f0; font-weight:600;">${escapeHtml(s.mentor || 'Esteban Ochoa')}</td>
            <td style="padding:12px 16px;">
              ${s.link ? `<a href="${escapeHtml(s.link)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; color:#60a5fa; text-decoration:none; font-weight:700; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.3); padding:4px 10px; border-radius:6px; font-size:11.5px;"><span style="font-size:12px;">🔗</span> Unirse a Sesión</a>` : '<span style="color:#64748b; font-size:11.5px;">Sin enlace</span>'}
            </td>
            <td style="padding:12px 16px;">
              <span class="vip-badge-pill" style="color:${st.color}; background:${st.bg}; border:1px solid ${st.border}; ${isAdminUser() ? 'cursor:pointer;' : ''} font-size:10.5px; padding:3px 9px;" ${isAdminUser() ? `onclick="toggleVipSessionStatus('${s.id}')" title="Clic para alternar estado"` : ''}>
                <span class="vip-pulse-dot ${st.dot}"></span> ${st.text}
              </span>
            </td>
            <td style="padding:12px 16px; text-align:right;">
              ${isAdminUser() ? `
                <button class="btn-grey" style="font-size:11px; padding:4px 9px; border-radius:6px; color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.08); cursor:pointer;" onclick="deleteVipSession('${s.id}')" title="Eliminar sesión">🗑️</button>
              ` : '<span style="color:#64748b; font-size:11px;">—</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }

    window.openNewSessionModal = function() {
      const dtInput = document.getElementById('vip-form-session-datetime');
      if (dtInput) {
        // Establecer fecha por defecto a mañana a las 18:00
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(18, 0, 0, 0);
        dtInput.value = d.toISOString().slice(0, 16);
      }
      openModal('vip-modal-session');
    };

    window.confirmSaveVipSession = async function() {
      const dt = document.getElementById('vip-form-session-datetime')?.value;
      const mentor = document.getElementById('vip-form-session-mentor')?.value;
      const type = document.getElementById('vip-form-session-type')?.value;
      const link = document.getElementById('vip-form-session-link')?.value;
      const notes = document.getElementById('vip-form-session-notes')?.value;

      if (!dt) {
        if (typeof toast === 'function') toast('Por favor selecciona la fecha y hora de la sesión.', 'warning');
        return;
      }

      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (!Array.isArray(vipData.sessions)) vipData.sessions = [];

      vipData.sessions.push({
        id: 'sess_' + Date.now(),
        datetime: dt,
        mentor: mentor,
        type: type,
        link: link,
        notes: notes,
        status: 'agendada'
      });

      await saveStudentVipData(targetId, vipData);
      closeModal('vip-modal-session');
      renderVipSessions(vipData);
      renderVipEvolution(vipData);
      if (typeof toast === 'function') toast('Sesión VIP agendada exitosamente.', 'success');
    };

    window.toggleVipSessionStatus = async function(sessionId) {
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (!Array.isArray(vipData.sessions)) return;
      const sess = vipData.sessions.find(s => s.id === sessionId);
      if (!sess) return;

      const order = ['agendada', 'completada', 'reprogramada', 'cancelada'];
      const nextIdx = (order.indexOf(sess.status || 'agendada') + 1) % order.length;
      sess.status = order[nextIdx];

      await saveStudentVipData(targetId, vipData);
      renderVipSessions(vipData);
      renderVipEvolution(vipData);
    };

    window.deleteVipSession = async function(sessionId) {
      if (!confirm('¿Eliminar esta sesión agendada?')) return;
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (Array.isArray(vipData.sessions)) {
        vipData.sessions = vipData.sessions.filter(s => s.id !== sessionId);
        await saveStudentVipData(targetId, vipData);
        renderVipSessions(vipData);
        renderVipEvolution(vipData);
        if (typeof toast === 'function') toast('Sesión eliminada.', 'info');
      }
    };

    // ── SUBPESTAÑA 5: HOMEWORKS & TAREAS ──
    function renderVipHomeworks(vipData) {
      const tbody = document.getElementById('vip-homeworks-tbody');
      if (!tbody) return;
      const homeworks = Array.isArray(vipData.homeworks) ? vipData.homeworks : [];
      if (homeworks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:28px; text-align:center; color:#94a3b8;">No hay tareas asignadas actualmente. Haz clic en "Asignar Homework".</td></tr>';
      } else {
        const statusMap = {
          pendiente: { text: 'Pendiente', color: '#facc15', bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', dot: 'vip-pulse-gold' },
          en_proceso: { text: 'En Proceso', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', dot: 'vip-pulse-blue' },
          entregada: { text: 'Entregada', color: '#c084fc', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)', dot: 'vip-pulse-purple' },
          aprobada: { text: 'Aprobada', color: '#4ade80', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', dot: 'vip-pulse-green' },
          corregir: { text: 'Corregir', color: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', dot: 'vip-pulse-red' }
        };

        tbody.innerHTML = homeworks.slice().reverse().map(hw => {
          const st = statusMap[hw.status || 'pendiente'] || statusMap.pendiente;
          const hasSubmission = hw.submission && (hw.submission.notes || hw.submission.link || hw.submission.file);
          const hasFeedback = hw.feedback && (hw.feedback.comments || hw.feedback.mentor || hw.feedback.status);

          let subDateStr = '';
          if (hw.submission?.date) {
            try { subDateStr = new Date(hw.submission.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch(e){}
          }
          let fbDateStr = '';
          if (hw.feedback?.date) {
            try { fbDateStr = new Date(hw.feedback.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch(e){}
          }

          return `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s;">
              <td style="padding:12px 16px; vertical-align:top;">
                <div style="font-weight:800; color:#fff; font-size:13px;">${escapeHtml(hw.title)}</div>
                ${hw.instructions ? `<div style="font-size:11.5px; color:#94a3b8; margin-top:3px; line-height:1.4;">${escapeHtml(hw.instructions)}</div>` : ''}
                ${hw.file?.url ? `
                  <div style="margin-top:6px;">
                    <a href="${escapeHtml(hw.file.url)}" target="_blank" download style="display:inline-flex; align-items:center; gap:5px; background:rgba(234,179,8,0.12); color:#facc15; border:1px solid rgba(234,179,8,0.35); padding:3px 9px; border-radius:6px; font-size:11px; font-weight:700; text-decoration:none;">
                      <span>📄</span> Guía: <u style="text-underline-offset:2px;">${escapeHtml(hw.file.name || 'Descargar')}</u>
                    </a>
                  </div>
                ` : ''}

                ${hasSubmission ? `
                  <div style="font-size:11.5px; color:#4ade80; margin-top:8px; background:rgba(74,222,128,0.07); padding:8px 12px; border-radius:8px; border:1px solid rgba(74,222,128,0.22);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
                      <span style="font-weight:800; color:#86efac; display:inline-flex; align-items:center; gap:4px;"><span>📤</span> Entrega del Alumno</span>
                      ${subDateStr ? `<span style="font-size:10.5px; color:#94a3b8; font-family:var(--mono);">${escapeHtml(subDateStr)}</span>` : ''}
                    </div>
                    ${hw.submission.notes ? `<div style="color:#f0fdf4; line-height:1.45; margin-bottom:5px;">${escapeHtml(hw.submission.notes)}</div>` : ''}
                    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                      ${hw.submission.link ? `<a href="${escapeHtml(hw.submission.link)}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; color:#60a5fa; background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.25); padding:2px 8px; border-radius:5px; font-size:11px; font-weight:700; text-decoration:none;"><span>🔗</span> Ver TradingView</a>` : ''}
                      ${hw.submission.file?.url ? `
                        <a href="${escapeHtml(hw.submission.file.url)}" target="_blank" download style="display:inline-flex; align-items:center; gap:4px; color:#4ade80; background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.25); padding:2px 8px; border-radius:5px; font-size:11px; font-weight:700; text-decoration:none;">
                          <span>📎</span> Archivo: <u>${escapeHtml(hw.submission.file.name || 'Descargar')}</u>
                        </a>
                      ` : ''}
                    </div>
                  </div>
                ` : ''}

                ${hasFeedback ? `
                  <div style="font-size:11.5px; color:#93c5fd; margin-top:8px; background:rgba(59,130,246,0.07); padding:8px 12px; border-radius:8px; border:1px solid rgba(59,130,246,0.22);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
                      <span style="font-weight:800; color:#bfdbfe; display:inline-flex; align-items:center; gap:4px;"><span>✍️</span> Feedback de ${escapeHtml(hw.feedback.mentor || 'Mentor')}</span>
                      ${fbDateStr ? `<span style="font-size:10.5px; color:#94a3b8; font-family:var(--mono);">${escapeHtml(fbDateStr)}</span>` : ''}
                    </div>
                    ${hw.feedback.comments ? `<div style="color:#eff6ff; line-height:1.45;">${escapeHtml(hw.feedback.comments)}</div>` : ''}
                  </div>
                ` : ''}
              </td>
              <td style="padding:12px 16px; color:#cbd5e1; font-weight:500; vertical-align:top;">${escapeHtml(hw.objective || 'Mejora continua')}</td>
              <td style="padding:12px 16px; color:#facc15; font-weight:700; vertical-align:top;">${escapeHtml(hw.assigned_by || 'Esteban Ochoa')}</td>
              <td style="padding:12px 16px; color:#94a3b8; font-family:var(--mono); font-size:11.5px; vertical-align:top;">${escapeHtml(hw.deadline || 'Sin fecha')}</td>
              <td style="padding:12px 16px; vertical-align:top;">
                <span class="vip-badge-pill" style="color:${st.color}; background:${st.bg}; border:1px solid ${st.border}; font-size:10.5px; padding:3px 9px;">
                  <span class="vip-pulse-dot ${st.dot}"></span> ${st.text}
                </span>
              </td>
              <td style="padding:12px 16px; text-align:right; vertical-align:top;">
                <div style="display:inline-flex; gap:6px;">
                  <button class="btn-grey" style="font-size:11px; padding:5px 10px; border-radius:6px; color:#4ade80; border-color:rgba(74,222,128,0.3); background:rgba(74,222,128,0.08); cursor:pointer;" onclick="openHomeworkSubmissionModal('${hw.id}')" title="Resolver o subir evidencias">
                    ${hasSubmission ? '📤 Re-entregar' : '📤 Entregar'}
                  </button>
                  ${isAdminUser() ? `
                    <button class="btn-grey" style="font-size:11px; padding:5px 10px; border-radius:6px; color:#60a5fa; border-color:rgba(96,165,250,0.3); background:rgba(96,165,250,0.08); cursor:pointer;" onclick="openHomeworkFeedbackModal('${hw.id}')" title="Calificar y dar feedback como mentor">
                      ${hasFeedback ? '✍️ Editar Feedback' : '✍️ Feedback'}
                    </button>
                    <button class="btn-grey" style="font-size:11px; padding:5px 8px; border-radius:6px; color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.08); cursor:pointer;" onclick="deleteVipHomework('${hw.id}')" title="Eliminar tarea">🗑️</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }

      // Renderizar el historial de tareas
      renderVipHomeworksHistory(vipData);
    }

    function renderVipHomeworksHistory(vipData) {
      const container = document.getElementById('vip-homeworks-history-container');
      if (!container) return;

      const isAdmin = isAdminUser();
      const homeworks = Array.isArray(vipData.homeworks) ? vipData.homeworks : [];
      let historyItems = [];

      if (Array.isArray(vipData.homeworks_history)) {
        historyItems.push(...vipData.homeworks_history);
      }

      homeworks.forEach(hw => {
        if (Array.isArray(hw.history)) {
          hw.history.forEach(item => {
            if (!historyItems.some(h => h.id === item.id)) {
              historyItems.push({ ...item, hwId: hw.id, hwTitle: hw.title });
            }
          });
        } else {
          if (hw.submission && (hw.submission.notes || hw.submission.link || hw.submission.file)) {
            const subId = 'sub_' + hw.id;
            if (!historyItems.some(h => h.id === subId)) {
              historyItems.push({
                id: subId,
                hwId: hw.id,
                hwTitle: hw.title,
                type: 'submission',
                date: hw.submission.date || '',
                notes: hw.submission.notes || '',
                link: hw.submission.link || '',
                file: hw.submission.file || null
              });
            }
          }
          if (hw.feedback && (hw.feedback.comments || hw.feedback.mentor || hw.feedback.status)) {
            const fbId = 'fb_' + hw.id;
            if (!historyItems.some(h => h.id === fbId)) {
              historyItems.push({
                id: fbId,
                hwId: hw.id,
                hwTitle: hw.title,
                type: 'feedback',
                date: hw.feedback.date || '',
                mentor: hw.feedback.mentor || 'Mentor',
                comments: hw.feedback.comments || '',
                status: hw.feedback.status || 'aprobada'
              });
            }
          }
        }
      });

      historyItems.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      if (historyItems.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:28px; color:#94a3b8; font-size:12.5px; background:rgba(255,255,255,0.02); border-radius:12px; border:1px dashed rgba(255,255,255,0.1);">
            Aún no hay entregas ni feedbacks registrados en el historial de tareas.
          </div>
        `;
        return;
      }

      const statusMap = {
        pendiente: { text: 'Pendiente', color: '#facc15', bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', dot: 'vip-pulse-gold' },
        en_proceso: { text: 'En Proceso', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', dot: 'vip-pulse-blue' },
        entregada: { text: 'Entregada', color: '#c084fc', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)', dot: 'vip-pulse-purple' },
        aprobada: { text: 'Aprobada', color: '#4ade80', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', dot: 'vip-pulse-green' },
        corregir: { text: 'Corregir', color: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', dot: 'vip-pulse-red' }
      };

      container.innerHTML = historyItems.map(item => {
        let dateStr = 'Reciente';
        if (item.date) {
          try {
            dateStr = new Date(item.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          } catch(e){}
        }

        if (item.type === 'submission') {
          return `
            <div class="vip-glass-card green-accent" style="padding:14px 18px; border-left:3px solid #4ade80; background:rgba(74,222,128,0.03); margin-bottom:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span class="vip-badge-pill green" style="font-size:10.5px; padding:3px 9px;">
                    <span class="vip-pulse-dot vip-pulse-green"></span> 📤 Entrega de Alumno
                  </span>
                  <span style="font-size:13px; font-weight:800; color:#fff;">${escapeHtml(item.hwTitle || 'Tarea')}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:11px; color:#94a3b8; font-family:var(--mono);">📅 ${escapeHtml(dateStr)}</span>
                  ${isAdmin ? `
                    <button type="button" class="vip-btn-cancel" onclick="deleteVipHomeworkHistoryEntry('${escapeHtml(item.id)}')" style="font-size:10.5px; padding:2px 7px; color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.06); cursor:pointer;" title="Borrar registro del historial">🗑️</button>
                  ` : ''}
                </div>
              </div>
              ${item.notes ? `<div style="font-size:12.5px; color:#dcfce7; line-height:1.5; margin-bottom:8px; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:6px;"><strong>Notas del Alumno:</strong> ${escapeHtml(item.notes)}</div>` : ''}
              <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" style="display:inline-flex; align-items:center; gap:5px; color:#60a5fa; background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.25); padding:3px 10px; border-radius:6px; font-size:11.5px; font-weight:700; text-decoration:none;"><span>🔗</span> Ver Gráfico en TradingView</a>` : ''}
                ${item.file?.url ? `<a href="${escapeHtml(item.file.url)}" target="_blank" download style="display:inline-flex; align-items:center; gap:5px; color:#4ade80; background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.25); padding:3px 10px; border-radius:6px; font-size:11.5px; font-weight:700; text-decoration:none;"><span>📎</span> Descargar Archivo: <u>${escapeHtml(item.file.name || 'Resolución')}</u></a>` : ''}
              </div>
            </div>
          `;
        }

        // Feedback item
        const st = statusMap[item.status || 'aprobada'] || statusMap.aprobada;
        return `
          <div class="vip-glass-card blue-accent" style="padding:14px 18px; border-left:3px solid #60a5fa; background:rgba(59,130,246,0.03); margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="vip-badge-pill blue" style="font-size:10.5px; padding:3px 9px;">
                  <span class="vip-pulse-dot vip-pulse-blue"></span> ✍️ Feedback de Mentor
                </span>
                <span style="font-size:13px; font-weight:800; color:#fff;">${escapeHtml(item.hwTitle || 'Tarea')}</span>
                <span style="font-size:11px; color:#facc15; font-weight:700;">(Evaluado por: ${escapeHtml(item.mentor || 'Mentor')})</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="vip-badge-pill" style="color:${st.color}; background:${st.bg}; border:1px solid ${st.border}; font-size:10.5px; padding:2px 8px;">${st.text}</span>
                <span style="font-size:11px; color:#94a3b8; font-family:var(--mono);">📅 ${escapeHtml(dateStr)}</span>
                ${isAdmin ? `
                  <button type="button" class="vip-btn-cancel" onclick="deleteVipHomeworkHistoryEntry('${escapeHtml(item.id)}')" style="font-size:10.5px; padding:2px 7px; color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.06); cursor:pointer;" title="Borrar registro del historial">🗑️</button>
                ` : ''}
              </div>
            </div>
            ${item.comments ? `<div style="font-size:12.5px; color:#eff6ff; line-height:1.5; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:6px;"><strong>Comentarios & Recomendaciones:</strong> ${escapeHtml(item.comments)}</div>` : ''}
          </div>
        `;
      }).join('');
    }

    window.deleteVipHomeworkHistoryEntry = async function(entryId) {
      if (!confirm('¿Deseas eliminar este registro del historial de tareas?')) return;
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (Array.isArray(vipData.homeworks_history)) {
        vipData.homeworks_history = vipData.homeworks_history.filter(item => item.id !== entryId);
      }
      if (Array.isArray(vipData.homeworks)) {
        vipData.homeworks.forEach(hw => {
          if (Array.isArray(hw.history)) {
            hw.history = hw.history.filter(item => item.id !== entryId);
          }
        });
      }
      currentVipData = vipData;
      await saveStudentVipData(targetId, vipData);
      renderVipHomeworks(vipData);
      if (typeof toast === 'function') toast('Registro del historial eliminado.', 'info');
    };

    window.openNewHomeworkModal = function() {
      clearVipHwFile();
      openModal('vip-modal-homework');
    };

    window.confirmSaveVipHomework = async function() {
      const title = document.getElementById('vip-form-hw-title')?.value;
      const objective = document.getElementById('vip-form-hw-objective')?.value;
      const assigned_by = document.getElementById('vip-form-hw-assigned-by')?.value;
      const deadline = document.getElementById('vip-form-hw-deadline')?.value;
      const instructions = document.getElementById('vip-form-hw-instructions')?.value;

      if (!title) {
        if (typeof toast === 'function') toast('Por favor escribe el título de la tarea.', 'warning');
        return;
      }

      showLoading(true);
      try {
        let fileDoc = null;
        if (vipSelectedHwFile) {
          fileDoc = await uploadVipDocument(vipSelectedHwFile);
        }

        const targetId = getTargetUserId();
        const vipData = await getStudentVipData(targetId);
        if (!Array.isArray(vipData.homeworks)) vipData.homeworks = [];

        vipData.homeworks.push({
          id: 'hw_' + Date.now(),
          title: title,
          objective: objective,
          assigned_by: assigned_by,
          deadline: deadline,
          instructions: instructions,
          file: fileDoc,
          status: 'pendiente'
        });

        currentVipData = vipData;
        await saveStudentVipData(targetId, vipData);
        closeModal('vip-modal-homework');
        clearVipHwFile();
        renderVipHomeworks(vipData);
        renderVipEvolution(vipData);
        if (typeof toast === 'function') toast('Tarea asignada con éxito al estudiante VIP.', 'success');
      } catch (err) {
        console.error('Error asignando tarea:', err);
        if (typeof toast === 'function') toast('Error al subir documento: ' + (err.message || 'Error en almacenamiento'), 'error');
      } finally {
        showLoading(false);
      }
    };

    window.openHomeworkSubmissionModal = async function(hwId) {
      clearVipSubHwFile();
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      const hw = (vipData.homeworks || []).find(h => h.id === hwId);
      if (!hw) return;

      document.getElementById('vip-sub-hw-id').value = hw.id;
      document.getElementById('vip-sub-hw-title').textContent = hw.title;
      document.getElementById('vip-sub-hw-link').value = hw.submission?.link || '';
      document.getElementById('vip-sub-hw-notes').value = hw.submission?.notes || '';
      const nameEl = document.getElementById('vip-sub-hw-file-name');
      if (nameEl) {
        nameEl.textContent = hw.submission?.file?.name ? ('Archivo previo: ' + hw.submission.file.name) : '';
      }
      openModal('vip-modal-hw-submission');
    };

    window.confirmSubmitVipHomework = async function() {
      const hwId = document.getElementById('vip-sub-hw-id')?.value;
      const link = (document.getElementById('vip-sub-hw-link')?.value || '').trim();
      const notes = (document.getElementById('vip-sub-hw-notes')?.value || '').trim();

      if (!notes && !link && !vipSelectedSubHwFile) {
        if (typeof toast === 'function') toast('Por favor escribe notas, enlace o adjunta un archivo para entregar.', 'warning');
        return;
      }

      showLoading(true);
      try {
        let fileDoc = null;
        if (vipSelectedSubHwFile) {
          fileDoc = await uploadVipDocument(vipSelectedSubHwFile);
        }

        const targetId = getTargetUserId();
        const vipData = await getStudentVipData(targetId);
        const hw = (vipData.homeworks || []).find(h => h.id === hwId);
        if (!hw) return;

        const subObj = {
          date: new Date().toISOString(),
          link: link,
          notes: notes,
          file: fileDoc || (hw.submission ? hw.submission.file : null)
        };
        hw.submission = subObj;
        hw.status = 'entregada';

        if (!Array.isArray(hw.history)) hw.history = [];
        const histEntry = {
          id: 'sub_' + Date.now(),
          hwId: hw.id,
          hwTitle: hw.title,
          type: 'submission',
          date: subObj.date,
          notes: subObj.notes,
          link: subObj.link,
          file: subObj.file
        };
        hw.history.push(histEntry);

        if (!Array.isArray(vipData.homeworks_history)) vipData.homeworks_history = [];
        vipData.homeworks_history.push(histEntry);

        currentVipData = vipData;
        await saveStudentVipData(targetId, vipData);
        closeModal('vip-modal-hw-submission');
        clearVipSubHwFile();
        renderVipHomeworks(vipData);
        renderVipEvolution(vipData);
        if (typeof toast === 'function') toast('¡Resolución guardada y registrada en el historial!', 'success');
      } catch (err) {
        console.error('Error enviando resolución:', err);
        if (typeof toast === 'function') toast('Error al subir documento: ' + (err.message || 'Error en almacenamiento'), 'error');
      } finally {
        showLoading(false);
      }
    };

    window.openHomeworkFeedbackModal = async function(hwId) {
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      const hw = (vipData.homeworks || []).find(h => h.id === hwId);
      if (!hw) return;

      document.getElementById('vip-fb-hw-id').value = hw.id;
      document.getElementById('vip-fb-hw-title').textContent = hw.title;
      const statusEl = document.getElementById('vip-fb-status');
      if (statusEl) statusEl.value = hw.feedback?.status || (hw.status === 'entregada' ? 'aprobada' : (hw.status || 'aprobada'));
      const mentorEl = document.getElementById('vip-fb-mentor');
      if (mentorEl) mentorEl.value = hw.feedback?.mentor || 'Esteban Ochoa';
      const commentsEl = document.getElementById('vip-fb-comments');
      if (commentsEl) commentsEl.value = hw.feedback?.comments || '';
      openModal('vip-modal-hw-feedback');
    };

    window.confirmSaveVipFeedback = async function() {
      const hwId = document.getElementById('vip-fb-hw-id')?.value;
      const status = document.getElementById('vip-fb-status')?.value || 'aprobada';
      const mentor = document.getElementById('vip-fb-mentor')?.value || 'Esteban Ochoa';
      const comments = (document.getElementById('vip-fb-comments')?.value || '').trim();

      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      const hw = (vipData.homeworks || []).find(h => h.id === hwId);
      if (!hw) return;

      hw.status = status;
      const fbObj = {
        date: new Date().toISOString(),
        mentor: mentor,
        comments: comments,
        status: status
      };
      hw.feedback = fbObj;

      if (!Array.isArray(hw.history)) hw.history = [];
      const histEntry = {
        id: 'fb_' + Date.now(),
        hwId: hw.id,
        hwTitle: hw.title,
        type: 'feedback',
        date: fbObj.date,
        mentor: fbObj.mentor,
        comments: fbObj.comments,
        status: fbObj.status
      };
      hw.history.push(histEntry);

      if (!Array.isArray(vipData.homeworks_history)) vipData.homeworks_history = [];
      vipData.homeworks_history.push(histEntry);

      currentVipData = vipData;
      await saveStudentVipData(targetId, vipData);
      closeModal('vip-modal-hw-feedback');
      renderVipHomeworks(vipData);
      renderVipEvolution(vipData);
      if (typeof toast === 'function') toast('¡Feedback del mentor guardado y registrado en el historial!', 'success');
    };

    window.deleteVipHomework = async function(hwId) {
      if (!confirm('¿Eliminar esta tarea?')) return;
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (Array.isArray(vipData.homeworks)) {
        vipData.homeworks = vipData.homeworks.filter(h => h.id !== hwId);
        currentVipData = vipData;
        await saveStudentVipData(targetId, vipData);
        renderVipHomeworks(vipData);
        renderVipEvolution(vipData);
        if (typeof toast === 'function') toast('Tarea eliminada.', 'info');
      }
    };

    // ── SUBPESTAÑA 6: EVALUACIÓN BIMESTRAL (FORMULARIO, ESTADO Y RETROALIMENTACIÓN) ──
    let vipEvaluationFormUrl = '';

    async function loadVipEvaluationFormUrl() {
      const cached = localStorage.getItem('syntracker_vip_eval_form_url');
      if (cached) {
        vipEvaluationFormUrl = cached;
        const input = document.getElementById('vip-admin-eval-url-input');
        if (input && !input.value) input.value = cached;
      }
      try {
        const tourney = await getActiveTournamentWithRules();
        if (tourney && tourney.rules && tourney.rules.vip_eval_form_url !== undefined) {
          const remoteUrl = (tourney.rules.vip_eval_form_url || '').trim();
          vipEvaluationFormUrl = remoteUrl;
          localStorage.setItem('syntracker_vip_eval_form_url', remoteUrl);
          const input = document.getElementById('vip-admin-eval-url-input');
          if (input) input.value = remoteUrl;
        }
      } catch (err) {
        console.warn('Error cargando enlace de evaluación en segundo plano:', err);
      }
    }
    window.loadVipEvaluationFormUrl = loadVipEvaluationFormUrl;

    window.saveVipEvaluationFormUrl = async function(newUrl) {
      const cleanUrl = (newUrl || '').trim();
      vipEvaluationFormUrl = cleanUrl;
      localStorage.setItem('syntracker_vip_eval_form_url', cleanUrl);
      const input = document.getElementById('vip-admin-eval-url-input');
      if (input) input.value = cleanUrl;

      try {
        const tourney = await getActiveTournamentWithRules();
        const tourneyId = tourney ? tourney.id : '7639677c-4054-4a88-a75e-7f5f253cc5b6';
        const currentRules = (tourney && tourney.rules) ? Object.assign({}, tourney.rules) : {};
        currentRules.vip_eval_form_url = cleanUrl;

        const res = await fetch(SUPABASE_URL + '/rest/v1/tournaments?id=eq.' + tourneyId, {
          method: 'PATCH',
          headers: {
            'apikey': ADMIN_SERVICE_KEY,
            'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ rules: currentRules })
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error('Error al actualizar enlace en Supabase: ' + err);
        }

        if (typeof toast === 'function') {
          toast('¡Enlace oficial del formulario de evaluación actualizado para toda la academia!', 'success');
        } else {
          alert('Enlace oficial guardado con éxito.');
        }
      } catch (err) {
        console.error('Error guardando enlace de evaluación en Supabase:', err);
        if (typeof toast === 'function') {
          toast('Error al sincronizar con la nube: ' + (err.message || 'Error de conexión'), 'error');
        } else {
          alert('Error al guardar en la nube.');
        }
      }
    };

    window.openVipEvaluationForm = function(e) {
      if (e) e.preventDefault();
      if (vipEvaluationFormUrl && vipEvaluationFormUrl.startsWith('http')) {
        window.open(vipEvaluationFormUrl, '_blank');
      } else {
        if (typeof toast === 'function') {
          toast('El enlace oficial del formulario de evaluación bimestral será asignado próximamente.', 'info');
        } else {
          alert('El enlace oficial del formulario de evaluación bimestral será asignado próximamente.');
        }
      }
    };

    function renderVipEvaluations(vipData) {
      const isAdmin = isAdminUser();
      const currentEval = vipData.current_eval || {};

      // Mostrar panel de configuración de enlace si es admin/staff
      const evalConfigPanel = document.getElementById('vip-admin-eval-form-config');
      if (evalConfigPanel) {
        evalConfigPanel.style.display = isAdmin ? 'block' : 'none';
      }
      const evalUrlInput = document.getElementById('vip-admin-eval-url-input');
      if (evalUrlInput && !evalUrlInput.value && vipEvaluationFormUrl) {
        evalUrlInput.value = vipEvaluationFormUrl;
      }

      // 1. Casilla y estado de presentación
      const checkEl = document.getElementById('vip-eval-submitted-checkbox');
      const badgeEl = document.getElementById('vip-eval-status-badge');
      const labelEl = document.getElementById('vip-eval-submitted-label');
      const subtextEl = document.getElementById('vip-eval-submitted-subtext');

      const isSubmitted = !!currentEval.submitted;
      if (checkEl) checkEl.checked = isSubmitted;

      if (badgeEl) {
        if (isSubmitted) {
          badgeEl.style.background = 'rgba(74,222,128,0.15)';
          badgeEl.style.color = '#4ade80';
          badgeEl.style.borderColor = 'rgba(74,222,128,0.35)';
          badgeEl.textContent = '✅ Presentada';
        } else {
          badgeEl.style.background = 'rgba(234,179,8,0.15)';
          badgeEl.style.color = '#facc15';
          badgeEl.style.borderColor = 'rgba(234,179,8,0.35)';
          badgeEl.textContent = '⏳ Pendiente por presentar';
        }
      }

      if (labelEl) {
        labelEl.textContent = isSubmitted ? '¡Evaluación Bimestral Presentada!' : '¿Ya presentaste tu evaluación bimestral?';
      }
      if (subtextEl) {
        if (isSubmitted && currentEval.submitted_at) {
          let dStr = 'Reciente';
          try {
            dStr = new Date(currentEval.submitted_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          } catch (eD) {}
          subtextEl.textContent = 'Marcada como presentada el ' + dStr;
        } else {
          subtextEl.textContent = 'Marca esta casilla una vez hayas llenado y enviado el formulario.';
        }
      }

      // 2. Retroalimentación del Mentor
      const editContainer = document.getElementById('vip-eval-feedback-edit-container');
      const viewContainer = document.getElementById('vip-eval-feedback-view-container');
      const inputEl = document.getElementById('vip-eval-feedback-input');
      const dateEl = document.getElementById('vip-eval-feedback-date');
      const viewTextEl = document.getElementById('vip-eval-feedback-view-text');
      const viewMetaEl = document.getElementById('vip-eval-feedback-view-meta');

      const feedbackText = currentEval.feedback || '';
      if (inputEl) inputEl.value = feedbackText;

      let metaStr = '';
      if (currentEval.feedback_updated_at) {
        try {
          const fDate = new Date(currentEval.feedback_updated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          metaStr = `✍️ Por: ${currentEval.feedback_author || 'Mentor Gold FX'} • ${fDate}`;
        } catch (eM) {}
      }
      if (dateEl) dateEl.textContent = metaStr;

      if (isAdmin) {
        if (editContainer) editContainer.style.display = 'block';
        if (viewContainer) viewContainer.style.display = 'none';
      } else {
        if (editContainer) editContainer.style.display = 'none';
        if (viewContainer) {
          viewContainer.style.display = 'block';
          if (viewTextEl) {
            viewTextEl.textContent = feedbackText || 'Aún no hay retroalimentación registrada para este período. Tu mentora la publicará aquí tras revisar tus respuestas.';
          }
          if (viewMetaEl) viewMetaEl.textContent = metaStr;
        }
      }

      // 3. Historial Comparativo
      const container = document.getElementById('vip-eval-history-container');
      if (!container) return;
      const evaluations = Array.isArray(vipData.evaluations_history) ? vipData.evaluations_history : [];

      if (evaluations.length === 0) {
        container.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:28px; color:#94a3b8; font-size:12.5px; background:rgba(255,255,255,0.02); border-radius:12px; border:1px dashed rgba(255,255,255,0.1);">
            Aún no hay evaluaciones previas registradas en el historial. Haz clic en <strong style="color:#facc15;">"Registrar Período"</strong> para archivar un ciclo bimestral.
          </div>
        `;
        return;
      }

      container.innerHTML = evaluations.slice().reverse().map((ev, idx) => {
        const evId = ev.id || ('eval_' + idx);
        return `
          <div class="vip-glass-card gold-accent" style="padding:20px; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <span style="font-size:14px; font-weight:900; color:#facc15; letter-spacing:0.3px;">${escapeHtml(ev.period)}</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="vip-badge-pill green" style="font-size:11px; font-family:var(--mono); padding:3px 9px;">${escapeHtml(ev.score || 'Aprobado')}</span>
                ${isAdmin ? `
                  <button type="button" class="btn-grey" onclick="deleteVipEvaluationEntry('${evId}')" style="font-size:11px; padding:3px 8px; border-radius:6px; color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.06); cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="Eliminar este período de evaluación">
                    <span>🗑️</span> Borrar
                  </button>
                ` : ''}
              </div>
            </div>
            <div style="font-size:11.5px; color:#94a3b8; margin-bottom:10px; font-family:var(--mono);">📅 Fecha: <strong style="color:#fff;">${escapeHtml(ev.date || 'Reciente')}</strong></div>
            <div style="font-size:12.5px; color:#cbd5e1; line-height:1.5; margin-bottom:10px;">
              <strong style="color:#fff;">Diagnóstico:</strong> ${escapeHtml(ev.diagnosis || 'Sin diagnóstico')}
            </div>
            ${ev.strengths ? `<div style="font-size:12px; color:#86efac; margin-bottom:6px; background:rgba(34,197,94,0.06); padding:4px 8px; border-radius:6px; border:1px solid rgba(34,197,94,0.15);"><strong>✓ Fortalezas:</strong> ${escapeHtml(ev.strengths)}</div>` : ''}
            ${ev.weaknesses ? `<div style="font-size:12px; color:#fca5a5; margin-bottom:8px; background:rgba(239,68,68,0.06); padding:4px 8px; border-radius:6px; border:1px solid rgba(239,68,68,0.15);"><strong>⚠️ Por Mejorar:</strong> ${escapeHtml(ev.weaknesses)}</div>` : ''}
            ${ev.action ? `
              <div style="background:rgba(0,0,0,0.4); border-left:3px solid #60a5fa; padding:8px 12px; font-size:12px; color:#bfdbfe; border-radius:6px; margin-top:10px; line-height:1.45;">
                <strong style="color:#60a5fa;">Plan de Acción:</strong> ${escapeHtml(ev.action)}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    window.deleteVipEvaluationEntry = async function(entryId) {
      if (!confirm('¿Deseas eliminar este período de evaluación del historial?')) return;
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (Array.isArray(vipData.evaluations_history)) {
        vipData.evaluations_history = vipData.evaluations_history.filter((ev, idx) => {
          const id = ev.id || ('eval_' + idx);
          return id !== entryId && ev.id !== entryId;
        });
        currentVipData = vipData;
        await saveStudentVipData(targetId, vipData);
        renderVipEvaluations(vipData);
        if (typeof toast === 'function') toast('Período de evaluación eliminado.', 'info');
      }
    };

    window.toggleVipEvaluationSubmitted = async function(isChecked) {
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (!vipData.current_eval) vipData.current_eval = {};

      vipData.current_eval.submitted = isChecked;
      vipData.current_eval.submitted_at = isChecked ? new Date().toISOString() : null;

      await saveStudentVipData(targetId, vipData);
      renderVipEvaluations(vipData);

      if (typeof toast === 'function') {
        toast(isChecked ? '✅ Estado actualizado: Evaluación Presentada' : 'Estado actualizado: Pendiente por presentar', isChecked ? 'success' : 'info');
      }
    };

    window.saveVipEvalFeedback = async function() {
      const targetId = getTargetUserId();
      const inputEl = document.getElementById('vip-eval-feedback-input');
      const feedbackText = inputEl ? inputEl.value.trim() : '';

      const vipData = await getStudentVipData(targetId);
      if (!vipData.current_eval) vipData.current_eval = {};

      const u = sb.getUser();
      vipData.current_eval.feedback = feedbackText;
      vipData.current_eval.feedback_updated_at = new Date().toISOString();
      vipData.current_eval.feedback_author = (u && u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || 'Sara Posada';

      await saveStudentVipData(targetId, vipData);
      renderVipEvaluations(vipData);

      if (typeof toast === 'function') {
        toast('Retroalimentación de evaluación guardada con éxito.', 'success');
      }
    };

    window.openNewEvaluationModal = function() {
      const dtInput = document.getElementById('vip-form-eval-date');
      if (dtInput) dtInput.value = new Date().toISOString().slice(0, 10);
      openModal('vip-modal-evaluation');
    };

    window.confirmSaveVipEvaluation = async function() {
      const period = document.getElementById('vip-form-eval-period')?.value;
      const date = document.getElementById('vip-form-eval-date')?.value;
      const score = document.getElementById('vip-form-eval-score')?.value;
      const diagnosis = document.getElementById('vip-form-eval-diagnosis')?.value;
      const strengths = document.getElementById('vip-form-eval-strengths')?.value;
      const weaknesses = document.getElementById('vip-form-eval-weaknesses')?.value;
      const action = document.getElementById('vip-form-eval-action')?.value;

      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (!Array.isArray(vipData.evaluations_history)) vipData.evaluations_history = [];

      vipData.evaluations_history.push({
        id: 'eval_' + Date.now(),
        period: period,
        date: date,
        score: score,
        diagnosis: diagnosis,
        strengths: strengths,
        weaknesses: weaknesses,
        action: action
      });

      await saveStudentVipData(targetId, vipData);
      closeModal('vip-modal-evaluation');
      renderVipEvaluations(vipData);
      if (typeof toast === 'function') toast('Evaluación bimestral guardada en el historial comparativo.', 'success');
    };

    // ── SUBPESTAÑA 7: EVOLUCIÓN 360° (MÉTRICAS & MEDALLERO DE HONOR VIP) ──
    const VIP_BADGES = [
      {
        id: 'consistencia',
        emoji: '🏆',
        name: 'Consistencia',
        desc: 'Reconoce al trader que mantiene regularidad y compromiso en su proceso operativo.',
        accent: '#facc15',
        isDefaultVip: false
      },
      {
        id: 'disciplina',
        emoji: '🛡️',
        name: 'Disciplina',
        desc: 'Premia el cumplimiento de las reglas, el plan de trading y la gestión del riesgo.',
        accent: '#60a5fa',
        isDefaultVip: false
      },
      {
        id: 'mente_fria',
        emoji: '❄️',
        name: 'Mente Fría',
        desc: 'Reconoce el control emocional y la capacidad de tomar decisiones sin dejarse dominar por el miedo o la avaricia.',
        accent: '#38bdf8',
        isDefaultVip: false
      },
      {
        id: 'analista_elite',
        emoji: '👑',
        name: 'Analista Élite',
        desc: 'Distingue al trader que demuestra excelencia en el análisis técnico, lectura del mercado y validación de escenarios.',
        accent: '#c084fc',
        isDefaultVip: false
      },
      {
        id: 'mision_trader',
        emoji: '🎯',
        name: 'Misión Trader',
        desc: 'Reconoce al trader comprometido con sus objetivos, su evolución y el inicio de su proceso de formación VIP.',
        accent: '#f43f5e',
        isDefaultVip: true
      }
    ];

    function renderVipEvolution(vipData) {
      if (!vipData) vipData = currentVipData || {};
      const homeworks = Array.isArray(vipData.homeworks) ? vipData.homeworks : [];
      const sessions = Array.isArray(vipData.sessions) ? vipData.sessions : [];

      let hwPct = 100;
      if (homeworks.length > 0) {
        const completed = homeworks.filter(h => h.status === 'aprobada' || h.status === 'entregada').length;
        hwPct = Math.round((completed / homeworks.length) * 100);
      }

      let sessPct = 100;
      if (sessions.length > 0) {
        const attended = sessions.filter(s => s.status === 'completada').length;
        sessPct = Math.round((attended / sessions.length) * 100);
      }

      const tasksBar = document.getElementById('vip-evolucion-tasks-bar');
      const tasksVal = document.getElementById('vip-evolucion-tasks-val');
      if (tasksBar) tasksBar.style.width = hwPct + '%';
      if (tasksVal) tasksVal.textContent = hwPct + '%';

      const sessBar = document.getElementById('vip-evolucion-sessions-bar');
      const sessVal = document.getElementById('vip-evolucion-sessions-val');
      if (sessBar) sessBar.style.width = sessPct + '%';
      if (sessVal) sessVal.textContent = sessPct + '%';

      // ── RENDERIZAR MEDALLERO DE HONOR VIP ──
      const grid = document.getElementById('vip-badges-grid');
      if (grid) {
        const isAdmin = isAdminUser();
        const userBadges = Array.isArray(vipData.badges) ? [...vipData.badges] : [];
        if (!userBadges.includes('mision_trader')) {
          userBadges.push('mision_trader');
        }

        const countText = document.getElementById('vip-badges-count-text');
        if (countText) {
          const unlockedCount = VIP_BADGES.filter(b => b.isDefaultVip || userBadges.includes(b.id)).length;
          countText.textContent = `${unlockedCount} de ${VIP_BADGES.length} Insignias Desbloqueadas`;
        }

        grid.innerHTML = VIP_BADGES.map(badge => {
          const isUnlocked = badge.isDefaultVip || userBadges.includes(badge.id);

          if (isUnlocked) {
            return `
              <div class="vip-glass-card" style="background:linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%); border:1px solid ${badge.accent}55; border-radius:16px; padding:20px; position:relative; overflow:hidden; box-shadow:0 8px 24px -6px ${badge.accent}25; display:flex; flex-direction:column; justify-content:space-between; transition:all 0.2s ease;">
                <div style="position:absolute; top:-30px; right:-30px; width:100px; height:100px; border-radius:50%; background:radial-gradient(circle, ${badge.accent}30 0%, transparent 70%); pointer-events:none;"></div>
                
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; gap:10px;">
                    <div style="width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg, ${badge.accent}25, ${badge.accent}08); border:1px solid ${badge.accent}50; display:flex; align-items:center; justify-content:center; font-size:26px; box-shadow:0 4px 16px ${badge.accent}20; flex-shrink:0;">
                      ${badge.emoji}
                    </div>
                    ${badge.isDefaultVip ? `
                      <span class="vip-badge-pill gold" style="font-size:10.5px; padding:3px 10px;">
                        <span>🌟</span> Membresía VIP Oficial
                      </span>
                    ` : `
                      <span class="vip-badge-pill green" style="font-size:10.5px; padding:3px 10px;">
                        <span class="vip-pulse-dot vip-pulse-green"></span> Desbloqueada
                      </span>
                    `}
                  </div>

                  <div style="font-size:16px; font-weight:900; color:#fff; display:flex; align-items:center; gap:8px;">
                    ${badge.emoji} ${escapeHtml(badge.name)}
                  </div>
                  <div style="font-size:12px; color:#cbd5e1; margin-top:6px; line-height:1.5;">
                    ${escapeHtml(badge.desc)}
                  </div>
                </div>

                <div style="margin-top:16px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:11px; color:#86efac; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                    <span>✓</span> Insignia Activa
                  </span>
                  ${isAdmin && !badge.isDefaultVip ? `
                    <button type="button" class="vip-btn-cancel" onclick="toggleVipBadge('${badge.id}')" style="font-size:10.5px; padding:3px 10px; color:#f87171; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.06); cursor:pointer;" title="Quitar esta insignia a este alumno">
                      ✖ Retirar
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          } else {
            return `
              <div class="vip-glass-card" style="background:rgba(255,255,255,0.015); border:1px dashed rgba(255,255,255,0.1); border-radius:16px; padding:20px; opacity:0.65; display:flex; flex-direction:column; justify-content:space-between; transition:all 0.2s ease;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; gap:10px;">
                    <div style="width:52px; height:52px; border-radius:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-size:24px; filter:grayscale(90%); flex-shrink:0; position:relative;">
                      ${badge.emoji}
                      <span style="position:absolute; bottom:-4px; right:-4px; font-size:12px; background:#18181b; border:1px solid rgba(255,255,255,0.15); border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center;">🔒</span>
                    </div>
                    <span class="vip-badge-pill" style="color:#94a3b8; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); font-size:10.5px; padding:3px 10px;">
                      🔒 Por Desbloquear
                    </span>
                  </div>

                  <div style="font-size:15px; font-weight:800; color:#94a3b8;">
                    ${badge.emoji} ${escapeHtml(badge.name)}
                  </div>
                  <div style="font-size:12px; color:#64748b; margin-top:6px; line-height:1.5;">
                    ${escapeHtml(badge.desc)}
                  </div>
                </div>

                <div style="margin-top:16px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.04); display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:11px; color:#64748b; font-weight:600;">
                    Pendiente por mérito
                  </span>
                  ${isAdmin ? `
                    <button type="button" class="vip-btn-gold" onclick="toggleVipBadge('${badge.id}')" style="font-size:11px; padding:4px 12px; font-weight:800; cursor:pointer;" title="Otorgar esta insignia al alumno">
                      ➕ Conceder
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }
        }).join('');
      }
    }

    window.toggleVipBadge = async function(badgeId) {
      if (badgeId === 'mision_trader') return;
      const targetId = getTargetUserId();
      const vipData = await getStudentVipData(targetId);
      if (!Array.isArray(vipData.badges)) vipData.badges = ['mision_trader'];
      if (!vipData.badges.includes('mision_trader')) vipData.badges.push('mision_trader');

      const idx = vipData.badges.indexOf(badgeId);
      let granted = false;
      if (idx >= 0) {
        vipData.badges.splice(idx, 1);
        granted = false;
      } else {
        vipData.badges.push(badgeId);
        granted = true;
      }

      currentVipData = vipData;
      await saveStudentVipData(targetId, vipData);
      renderVipEvolution(vipData);

      const bObj = VIP_BADGES.find(b => b.id === badgeId);
      const bTitle = bObj ? `${bObj.emoji} ${bObj.name}` : badgeId;
      if (typeof toast === 'function') {
        toast(granted ? `¡Insignia "${bTitle}" otorgada al alumno!` : `Insignia "${bTitle}" retirada.`, granted ? 'success' : 'info');
      }
    };

    window.renderVipModule = async function() {
      const isAdmin = isAdminUser();
      const isAllowed = hasVipAccess();
      const authView = document.getElementById('vip-authorized-view');
      const lockedView = document.getElementById('vip-locked-view');
      const previewBanner = document.getElementById('vip-admin-preview-banner');
      const previewBtn = document.getElementById('vip-btn-preview-toggle');

      if (!isAllowed) {
        if (authView) authView.style.display = 'none';
        if (lockedView) lockedView.style.display = 'block';
        if (previewBanner) {
          previewBanner.style.display = (isAdmin && vipSimulateLockedView) ? 'flex' : 'none';
        }
        return;
      }

      if (authView) authView.style.display = 'block';
      if (lockedView) lockedView.style.display = 'none';
      if (previewBtn) {
        previewBtn.style.display = isAdmin ? 'inline-flex' : 'none';
      }

      const headerBadge = document.getElementById('vip-header-badge-text');
      if (headerBadge) {
        headerBadge.textContent = isAdmin ? '🛡️ Modo Staff / Mentor' : '💎 Acceso VIP Oficial';
      }

      loadVipEvaluationFormUrl();

      const u = sb.getUser();

      const adminSelectorBar = document.getElementById('vip-admin-selector-bar');
      const studentWelcomeBar = document.getElementById('vip-student-welcome-bar');
      const studentWelcomeName = document.getElementById('vip-student-welcome-name');

      if (isAdmin) {
        if (adminSelectorBar) adminSelectorBar.style.display = 'flex';
        if (studentWelcomeBar) studentWelcomeBar.style.display = 'none';
        if (!adminStudentsData || adminStudentsData.length === 0) {
          await loadAdminData();
        }
      } else {
        if (adminSelectorBar) adminSelectorBar.style.display = 'none';
        if (studentWelcomeBar) {
          studentWelcomeBar.style.display = 'flex';
          const name = (u && u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u && u.email ? u.email.split('@')[0] : 'Trader VIP');
          if (studentWelcomeName) studentWelcomeName.textContent = 'Hola, ' + name;
        }
        currentVipStudentId = (u && u.id) ? u.id : 'me';
      }

      // Herramientas exclusivas del Mentor / Admin (ocultas para alumnos VIP)
      const auditBanner = document.getElementById('vip-admin-audit-banner');
      const diagInputCard = document.getElementById('vip-admin-diagnosis-input-card');
      const psicoNotesCard = document.getElementById('vip-admin-psico-notes-card');
      const btnAddSession = document.getElementById('vip-btn-add-session');
      const btnAddHw = document.getElementById('vip-btn-add-homework');
      const btnAddEval = document.getElementById('vip-btn-add-evaluation');

      if (auditBanner) auditBanner.style.display = isAdmin ? 'flex' : 'none';
      if (diagInputCard) diagInputCard.style.display = isAdmin ? 'block' : 'none';
      if (psicoNotesCard) psicoNotesCard.style.display = isAdmin ? 'flex' : 'none';
      if (btnAddSession) btnAddSession.style.display = isAdmin ? 'inline-flex' : 'none';
      if (btnAddHw) btnAddHw.style.display = isAdmin ? 'inline-flex' : 'none';
      if (btnAddEval) btnAddEval.style.display = isAdmin ? 'inline-flex' : 'none';

      try {
        const raw = localStorage.getItem('syntracker_vip_profiles');
        if (raw) vipStudentProfiles = JSON.parse(raw);
      } catch (e) {}

      // Poblar selector con alumnos VIP (solo en modo admin/mentor)
      const selector = document.getElementById('vip-student-selector');
      if (selector && isAdmin) {
        let opts = `<option value="me">👤 Mi Bitácora (${(u && u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || 'Mi Cuenta'})</option>`;
        const vipStudents = (adminStudentsData || []).filter(s => (s.membership === 'VIP' || s.membership === 'Lifetime'));
        vipStudents.forEach(s => {
          opts += `<option value="${s.id}">★ ${escapeHtml(s.name)} (${escapeHtml(s.email)})</option>`;
        });
        selector.innerHTML = opts;
        selector.value = currentVipStudentId || 'me';
      }

      await loadVipStudentData(currentVipStudentId);
    };
    window.loadVipStudentData = loadVipStudentData;
    window.renderVipOperativa = renderVipOperativa;

    window.doLogout = doLogout;

      // ── Init con Auto-Login & Persistencia de Sesión ──
      async function autoInit() {
        checkRecoveryFlow();
        const saved = sb.loadSession();
        if (saved && saved.user && saved.token) {
          const authScreen = document.getElementById('auth-screen');
          if (authScreen) authScreen.style.display = 'none';
          document.documentElement.classList.add('has-session');
          showLoading(true);
          try {
            await sb.verifySession();
            await initApp();
            checkAdminNavVisibility();
          } catch (e) {
            console.error('Error restaurando sesión:', e);
            if (!sb.getUser()) {
              document.documentElement.classList.remove('has-session');
              if (authScreen) authScreen.style.display = 'flex';
            }
          } finally {
            showLoading(false);
          }
        } else {
          document.documentElement.classList.remove('has-session');
          const authScreen = document.getElementById('auth-screen');
          if (authScreen) authScreen.style.display = 'flex';
        }
      }
      autoInit();



