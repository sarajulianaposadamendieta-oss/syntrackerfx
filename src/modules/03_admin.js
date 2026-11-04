    // =========================================================================
    //                      MÓDULO: PANEL DE ADMINISTRACIÓN
    // =========================================================================

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    let activeAdminSubtab = 'membresias';
    let adminParticipantsData = [];
    let adminStudentsData = [];
    let currentAuditSearch = '';
    let currentMembershipSearch = '';
    let currentMembershipFilter = 'all';
    let currentTournamentSearch = '';

    let vipSimulateLockedView = false;
    window.toggleVipPreviewLock = function() {
      vipSimulateLockedView = !vipSimulateLockedView;
      renderVipModule();
    };

    function hasVipAccess() {
      if (vipSimulateLockedView) return false;
      const u = sb.getUser();
      if (!u) return false;
      if (isSaraUser() || isAdminUser()) return true;
      const meta = u.user_metadata || {};
      const membership = ((meta.membership || '') + '').toUpperCase().trim();
      return membership === 'VIP' || membership === 'LIFETIME';
    }
    window.hasVipAccess = hasVipAccess;

    function checkAdminNavVisibility() {
      const u = (typeof sb !== 'undefined') ? sb.getUser() : null;
      const role = getAdminRole(u);
      const adminNav = document.getElementById('nav-item-admin');
      if (adminNav) {
        if (role) {
          adminNav.style.setProperty('display', 'flex', 'important');
        } else {
          adminNav.style.setProperty('display', 'none', 'important');
        }
      }
      const mobAdminNav = document.getElementById('mob-nav-item-admin');
      if (mobAdminNav) {
        if (role) {
          mobAdminNav.style.setProperty('display', 'flex', 'important');
        } else {
          mobAdminNav.style.setProperty('display', 'none', 'important');
        }
      }

      // BITÁCORA VIP: Habilitada para toda la academia (los VIP acceden al módulo completo; los no-VIP ven la pantalla de bloqueo y beneficios)
      const vipNav = document.getElementById('nav-item-vip');
      if (vipNav) {
        vipNav.style.setProperty('display', 'flex', 'important');
      }
      const mobVipNav = document.getElementById('mob-nav-item-vip');
      if (mobVipNav) {
        mobVipNav.style.setProperty('display', 'flex', 'important');
      }

      const botTabBtn = document.getElementById('atab-btn-bot');
      if (botTabBtn) {
        botTabBtn.style.display = (role === 'superadmin') ? 'inline-flex' : 'none';
      }
      const roleBadge = document.getElementById('admin-role-badge');
      if (roleBadge) {
        const staff = getStaffInfo(u);
        roleBadge.textContent = staff ? staff.adminTitle : 'Staff Gold FX';
      }
      loadGlobalAnnouncement();
    }
    window.checkAdminNavVisibility = checkAdminNavVisibility;
    window.getAdminRole = getAdminRole;

    window.switchAdminSubtab = function(tabName) {
      activeAdminSubtab = tabName;
      ['auditoria', 'membresias', 'torneo', 'anuncios', 'bot'].forEach(t => {
        const btn = document.getElementById('atab-btn-' + t);
        const sec = document.getElementById('admin-sec-' + t);
        if (btn) {
          if (t === tabName) btn.classList.add('active');
          else btn.classList.remove('active');
        }
        if (sec) {
          sec.style.display = (t === tabName) ? 'block' : 'none';
        }
      });

      if (tabName === 'auditoria') renderAdminAuditFeed();
      if (tabName === 'membresias') renderAdminMembershipsTable();
      if (tabName === 'torneo') renderAdminTournamentTable();
      if (tabName === 'anuncios') loadAdminAnnouncementInput();
      if (tabName === 'bot') loadAdminBotTab();
    };

    async function loadAdminData() {
      try {
        // 1 y 2. Cargar participantes de torneo y alumnos de Auth concurrentemente en paralelo
        const [tpData, authJson] = await Promise.all([
          sb.query('tournament_participants', { select: '*', order: 'return_pct.desc' }).catch(err => {
            console.warn('Error cargando tournament_participants:', err);
            return [];
          }),
          fetch(SUPABASE_URL + '/auth/v1/admin/users?per_page=1000', {
            headers: { 'apikey': ADMIN_SERVICE_KEY, 'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY }
          }).then(r => r.ok ? r.json() : { users: [] }).catch(err => {
            console.warn('Fallback cargando auth/users:', err);
            return { users: [] };
          })
        ]);

        adminParticipantsData = Array.isArray(tpData) ? tpData : [];

        // Calcular Puesto Bruto por PnL y Puesto Oficial del Torneo
        const rawSorted = [...adminParticipantsData].sort((a, b) => parseFloat(b.return_pct || 0) - parseFloat(a.return_pct || 0));
        rawSorted.forEach((p, idx) => { p.rawPnlRank = idx + 1; });

        const activeList = adminParticipantsData.filter(p => !((p.status && p.status.startsWith('Descalificado')) || parseFloat(p.dd_max_pct || 0) >= 5.0))
          .sort((a, b) => parseFloat(b.return_pct || 0) - parseFloat(a.return_pct || 0));
        const disqList = adminParticipantsData.filter(p => ((p.status && p.status.startsWith('Descalificado')) || parseFloat(p.dd_max_pct || 0) >= 5.0))
          .sort((a, b) => parseFloat(b.return_pct || 0) - parseFloat(a.return_pct || 0));

        activeList.forEach((p, idx) => { p.officialRank = idx + 1; });
        disqList.forEach((p, idx) => { p.officialRank = activeList.length + idx + 1; });

        // Mapa de participantes por user_id y user_email
        const tpMap = new Map();
        adminParticipantsData.forEach(p => {
          if (p.user_id) tpMap.set(p.user_id, p);
          if (p.user_email) tpMap.set(p.user_email.toLowerCase(), p);
        });

        let authUsers = (authJson && Array.isArray(authJson.users)) ? authJson.users : [];

        if (authUsers.length === 0) {
          const profilesData = await sb.query('profiles', { select: '*', order: 'created_at.desc' });
          if (Array.isArray(profilesData) && profilesData.length > 0) {
            authUsers = profilesData.map(pr => ({
              id: pr.id,
              email: pr.email,
              created_at: pr.created_at,
              user_metadata: { full_name: pr.full_name, country: pr.country }
            }));
          }
        }

        // 3. Cruzar datos de alumnos y torneo
        adminStudentsData = authUsers.map(u => {
          const meta = u.user_metadata || {};
          const name = meta.full_name || meta.name || (u.email ? u.email.split('@')[0] : 'Estudiante');
          const tp = tpMap.get(u.id) || tpMap.get((u.email || '').toLowerCase()) || null;
          let membership = meta.membership || null;
          if (!membership && tp && Array.isArray(tp.badges)) {
            const mBadge = tp.badges.find(b => b && b.membership);
            if (mBadge) membership = mBadge.membership;
          }
          if (!membership) membership = 'Ninguna';

          return {
            id: u.id,
            email: u.email || 'Sin correo',
            name: name,
            membership: membership,
            created_at: u.created_at || new Date().toISOString(),
            tp: tp,
            user_metadata: meta
          };
        });

      } catch (err) {
        console.error('Error cargando datos de administración:', err);
      }
    }

    async function renderAdminDashboard() {
      if (!isAdminUser()) {
        toast('Acceso denegado: Se requieren permisos de administrador.', 'error');
        goTo('dashboard');
        return;
      }

      showLoading(true);
      await loadAdminData();
      showLoading(false);

      // Actualizar métricas de cabecera
      const totalStudents = adminStudentsData.length;
      const totalInTournament = adminParticipantsData.length;
      const activeTournament = adminParticipantsData.filter(p => !((p.status && p.status.startsWith('Descalificado')) || parseFloat(p.dd_max_pct || 0) >= 5.0)).length;
      const disqTournament = totalInTournament - activeTournament;
      const withViolations = adminParticipantsData.filter(p => (parseInt(p.violations_count || 0, 10) > 0) || (p.status && p.status.startsWith('Descalificado')) || (parseFloat(p.dd_max_pct || 0) >= 5.0)).length;

      const elStudents = document.getElementById('admin-metric-students');
      const elTotal = document.getElementById('admin-metric-total');
      const elActive = document.getElementById('admin-metric-active');
      const elDisq = document.getElementById('admin-metric-disq');
      const elViol = document.getElementById('admin-metric-violations');
      const elBotMon = document.getElementById('bot-monitored-count');

      if (elStudents) elStudents.textContent = totalStudents;
      if (elTotal) elTotal.textContent = totalInTournament;
      if (elActive) elActive.textContent = activeTournament;
      if (elDisq) elDisq.textContent = disqTournament;
      if (elViol) elViol.textContent = withViolations;
      if (elBotMon) elBotMon.textContent = totalInTournament + ' Cuentas';

      switchAdminSubtab(activeAdminSubtab);
    }
    window.renderAdminDashboard = renderAdminDashboard;

    // ── Pestaña 1: Radar de Faltas & Auditoría en Vivo ──
    let currentAuditFilter = 'all';

    window.filterAuditByTab = function(filter) {
      currentAuditFilter = filter || 'all';
      document.querySelectorAll('#audit-filter-btns .mfilter-btn').forEach(btn => {
        if (btn.getAttribute('data-afilter') === currentAuditFilter) btn.classList.add('active');
        else btn.classList.remove('active');
      });
      renderAdminAuditFeed();
    };

    function renderAdminAuditFeed() {
      const container = document.getElementById('admin-audit-feed-container');
      if (!container) return;

      const totalCount = adminParticipantsData.length;
      const violationsCount = adminParticipantsData.filter(p => (parseInt(p.violations_count || 0, 10) > 0) || (p.status && p.status.startsWith('Descalificado')) || (parseFloat(p.dd_max_pct || 0) >= 5.0)).length;
      const cleanCount = totalCount - violationsCount;

      const elAll = document.getElementById('audit-count-all');
      const elViol = document.getElementById('audit-count-violations');
      const elClean = document.getElementById('audit-count-clean');
      if (elAll) elAll.textContent = totalCount;
      if (elViol) elViol.textContent = violationsCount;
      if (elClean) elClean.textContent = cleanCount;

      let items = [...adminParticipantsData];

      if (currentAuditFilter === 'violations') {
        items = items.filter(p => (parseInt(p.violations_count || 0, 10) > 0) || (p.status && p.status.startsWith('Descalificado')) || (parseFloat(p.dd_max_pct || 0) >= 5.0));
      } else if (currentAuditFilter === 'clean') {
        items = items.filter(p => (parseInt(p.violations_count || 0, 10) === 0) && !(p.status && p.status.startsWith('Descalificado')) && (parseFloat(p.dd_max_pct || 0) < 5.0));
      }

      const term = (currentAuditSearch || '').toLowerCase().trim();
      if (term) {
        items = items.filter(p => {
          const name = (p.user_name || '').toLowerCase();
          const login = String(p.mt5_login || '');
          const email = (p.user_email || '').toLowerCase();
          return name.includes(term) || login.includes(term) || email.includes(term);
        });
      }

      // Ordenar por puesto oficial
      items.sort((a, b) => (a.officialRank || 999) - (b.officialRank || 999));

      if (items.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:36px; background:#0d0f14; border:1px solid rgba(255,255,255,0.06); border-radius:14px; color:#94a3b8; font-size:13px;">
            <div style="font-size:32px; margin-bottom:8px;">🔍</div>
            <strong>No se encontraron participantes</strong><br>
            Ajusta los filtros o el buscador para ver resultados.
          </div>
        `;
        return;
      }

      container.innerHTML = items.map(p => {
        const isDisq = (p.status && p.status.startsWith('Descalificado')) || parseFloat(p.dd_max_pct || 0) >= 5.0;
        const violations = parseInt(p.violations_count || 0, 10);
        const isClean = violations === 0 && !isDisq;
        const maxDd = parseFloat(p.dd_max_pct || 0).toFixed(2);
        const dailyDd = parseFloat(p.dd_daily_pct || 0).toFixed(2);
        const trades = parseInt(p.trades_count || 0, 10);
        const pnl = parseFloat(p.return_pct || 0).toFixed(2);
        const pnlCol = pnl >= 0 ? '#4ade80' : '#f87171';
        const rank = p.officialRank || '—';
        const rawRank = p.rawPnlRank || '—';

        // Badge de posición en el torneo
        let rankBadge = '';
        if (!isDisq) {
          if (rank === 1) {
            rankBadge = `<span style="background:linear-gradient(135deg, rgba(234,179,8,0.25), rgba(234,179,8,0.08)); border:1px solid #eab308; color:#facc15; font-size:11px; font-weight:900; padding:3px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:5px; box-shadow:0 0 10px rgba(234,179,8,0.2);">🥇 Top #1 del Torneo</span>`;
          } else if (rank === 2) {
            rankBadge = `<span style="background:rgba(226,232,240,0.18); border:1px solid #cbd5e1; color:#ffffff; font-size:11px; font-weight:900; padding:3px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;">🥈 Top #2 del Torneo</span>`;
          } else if (rank === 3) {
            rankBadge = `<span style="background:rgba(217,119,6,0.2); border:1px solid #d97706; color:#f59e0b; font-size:11px; font-weight:900; padding:3px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;">🥉 Top #3 del Torneo</span>`;
          } else {
            rankBadge = `<span style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); color:#cbd5e1; font-size:11px; font-weight:800; padding:3px 8px; border-radius:10px;">🏆 Puesto #${rank} del Torneo</span>`;
          }
        } else {
          rankBadge = `<span style="background:rgba(239,68,68,0.18); border:1px solid rgba(239,68,68,0.45); color:#ef4444; font-size:11px; font-weight:800; padding:3px 8px; border-radius:10px;">🚫 Descalificado (Puesto #${rank})</span>`;
          if (rawRank <= 3) {
            rankBadge += ` <span style="background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.35); color:#facc15; font-size:10px; font-weight:700; padding:2px 7px; border-radius:8px;" title="Por rentabilidad bruta estaría en el podio, pero perdió el puesto por faltas">⚠️ Era Top #${rawRank} por Rentabilidad</span>`;
          }
        }

        // Status pill
        let statusPill = '';
        if (isClean) {
          statusPill = `<span style="background:rgba(34,197,94,0.18); border:1px solid rgba(34,197,94,0.4); color:#4ade80; font-size:10px; font-weight:800; padding:2.5px 8px; border-radius:10px;">🌟 100% Disciplina Impecable</span>`;
        } else if (isDisq) {
          statusPill = `<span style="background:rgba(239,68,68,0.18); border:1px solid rgba(239,68,68,0.45); color:#ef4444; font-size:10px; font-weight:800; padding:2.5px 8px; border-radius:10px;">🚫 Fuera del Podio</span>`;
        } else {
          statusPill = `<span style="background:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.4); color:#f97316; font-size:10px; font-weight:800; padding:2.5px 8px; border-radius:10px;">⚠️ Con Faltas (${violations})</span>`;
        }

        // Motive description
        let motiveDescription = [];
        if (isClean) {
          motiveDescription.push('🌟 <strong style="color:#4ade80;">Operativa Ejemplar:</strong> No registra ninguna falta. Cumple estrictamente el límite de 1 trade/día y mantiene su balance y drawdown bajo control.');
        } else {
          if (violations > 0) motiveDescription.push(`Acumula <strong>${violations} falta(s)</strong> de operativa (límite permitido: 1 trade al día).`);
          if (parseFloat(maxDd) >= 5.0) motiveDescription.push(`Tocó un Drawdown Máximo de <strong>${maxDd}%</strong> (excede el 5.0% máximo de la regla).`);
          if (parseFloat(dailyDd) > 1.1) motiveDescription.push(`Excedió el Drawdown Diario con <strong>${dailyDd}%</strong> (límite: 1.1%).`);
          if (p.disqualification_reason) motiveDescription.push(`Motivo manual: <em>"${escapeHtml(p.disqualification_reason)}"</em>`);
        }

        const borderColor = isClean ? '#22c55e' : (isDisq ? '#ef4444' : '#f97316');

        return `
          <div class="audit-card" style="border-left: 4px solid ${borderColor}; background:#11131a; border-radius:12px; padding:16px 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:10px; border-top:1px solid rgba(255,255,255,0.05); border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="flex:1; min-width:260px;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${rankBadge}
                <span style="font-size:14.5px; font-weight:800; color:#fff;">${escapeHtml(p.user_name || 'Estudiante')}</span>
                <span style="font-family:var(--mono); font-size:11px; color:#94a3b8; background:#18181b; padding:2px 6px; border-radius:4px;">#${p.mt5_login}</span>
                ${statusPill}
              </div>

              <div style="font-size:12px; color:#cbd5e1; margin-top:8px; line-height:1.45;">
                ${motiveDescription.join(' ')}
              </div>

              <div style="display:flex; gap:18px; margin-top:10px; font-size:11px; font-family:var(--mono); color:#94a3b8; flex-wrap:wrap;">
                <span>Retorno: <strong style="color:${pnlCol}; font-size:12px;">${pnl >= 0 ? '+' : ''}${pnl}%</strong></span>
                <span>Balance: <strong style="color:#fff;">$${parseFloat(p.current_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                <span>Trades: <strong style="color:#fff;">${trades}</strong></span>
                <span>Max DD: <strong style="color:${parseFloat(maxDd) >= 5.0 ? '#ef4444' : '#fff'};">${maxDd}%</strong></span>
                <span>Disciplina: <strong style="color:${parseFloat(p.discipline_score || 0) === 100 ? '#4ade80' : '#f97316'};">${p.discipline_score || 0}%</strong></span>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
              ${violations > 0 ? `
                <button type="button" class="btn-green" onclick="forgiveParticipantViolation('${p.id}')" style="font-size:11px; padding:6px 12px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;" title="Resetear contador de faltas y devolver al podio">
                  <span>🕊️</span> Perdonar Faltas
                </button>
              ` : ''}
              ${isDisq ? `
                <button type="button" class="btn-grey" onclick="adminReactivateParticipant('${p.id}')" style="font-size:11px; padding:6px 12px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; color:#4ade80;" title="Reincorporar al torneo">
                  <span>🔄</span> Reincorporar
                </button>
              ` : `
                <button type="button" class="btn-grey" onclick="openAdminDisqualifyModal('${p.id}')" style="font-size:11px; padding:6px 12px; border-radius:6px; color:#ef4444; border-color:rgba(239,68,68,0.3);" title="Descalificar con motivo">
                  <span>🛑</span> Descalificar
                </button>
              `}
              <button type="button" class="btn-grey" onclick="openAdminEditModal('${p.id}')" style="font-size:11px; padding:5px 12px; border-radius:6px;" title="Editar credenciales MT5">
                <span>✏️</span> Editar MT5
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    window.filterAuditFeed = function() {
      const input = document.getElementById('audit-search-input');
      currentAuditSearch = input ? input.value : '';
      renderAdminAuditFeed();
    };

    window.forgiveParticipantViolation = async function(pid) {
      if (!confirm('¿Deseas perdonar todas las faltas de este participante y restaurar su 100% de disciplina?')) return;
      showLoading(true);
      try {
        await sb.query('tournament_participants', {
          method: 'PATCH',
          filter: 'id=eq.' + pid,
          body: {
            violations_count: 0,
            discipline_score: 100.0,
            status: 'Activo'
          }
        });
        toast('Faltas perdonadas y disciplina restaurada al 100%.', 'success');
        await loadAdminData();
        renderAdminDashboard();
      } catch (e) {
        console.error('Error perdonando faltas:', e);
        toast('Error al actualizar participante.', 'error');
      } finally {
        showLoading(false);
      }
    };

    // ── Pestaña 2: Estudiantes & Membresías (Todos los 201 alumnos) ──
    function renderAdminMembershipsTable() {
      const tbody = document.getElementById('admin-memberships-tbody');
      if (!tbody) return;

      const term = (currentMembershipSearch || '').toLowerCase().trim();
      let items = [...adminStudentsData];

      // Contadores por membresía
      const counts = { all: items.length, VIP: 0, Mensual: 0, Anual: 0, Lifetime: 0, Ninguna: 0 };
      items.forEach(s => {
        const m = s.membership || 'Ninguna';
        if (counts[m] !== undefined) counts[m]++;
        else counts.Ninguna++;
      });

      ['all', 'vip', 'mensual', 'anual', 'lifetime', 'ninguna'].forEach(k => {
        const el = document.getElementById('mcount-' + k);
        const mapKey = k === 'all' ? 'all' : (k === 'vip' ? 'VIP' : (k.charAt(0).toUpperCase() + k.slice(1)));
        if (el) el.textContent = counts[mapKey] || 0;
      });

      // Filtrar por plan
      if (currentMembershipFilter !== 'all') {
        items = items.filter(s => (s.membership || 'Ninguna') === currentMembershipFilter);
      }

      // Filtrar por término de búsqueda
      if (term) {
        items = items.filter(s => {
          const name = (s.name || '').toLowerCase();
          const email = (s.email || '').toLowerCase();
          return name.includes(term) || email.includes(term);
        });
      }

      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:28px; text-align:center; color:#94a3b8;">No se encontraron estudiantes para los filtros seleccionados.</td></tr>';
        return;
      }

      const badgeStyles = {
        'VIP': 'background:rgba(234,179,8,0.18); color:#facc15; border:1px solid rgba(234,179,8,0.4);',
        'Mensual': 'background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.4);',
        'Anual': 'background:rgba(59,130,246,0.18); color:#60a5fa; border:1px solid rgba(59,130,246,0.4);',
        'Lifetime': 'background:rgba(168,85,247,0.18); color:#c084fc; border:1px solid rgba(168,85,247,0.4);',
        'Ninguna': 'background:rgba(148,163,184,0.12); color:#94a3b8; border:1px solid rgba(148,163,184,0.25);'
      };

      tbody.innerHTML = items.map((s, idx) => {
        const currentM = s.membership || 'Ninguna';
        const stClass = badgeStyles[currentM] || badgeStyles.Ninguna;
        const staff = getStaffInfo(s);
        const staffBadgeHtml = staff
          ? `<span style="${staff.badgeStyle} font-size:9.5px; font-weight:800; padding:1.5px 7px; border-radius:999px;">${staff.display}</span>`
          : '';

        let dateStr = 'Reciente';
        if (s.created_at) {
          try {
            dateStr = new Date(s.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
          } catch (eD) {}
        }

        const tpBadge = s.tp 
          ? `<span style="background:rgba(234,179,8,0.12); color:#eab308; border:1px solid rgba(234,179,8,0.3); font-size:10px; font-weight:700; padding:2px 7px; border-radius:6px; font-family:var(--mono);">🏆 Torneo #${s.tp.mt5_login}</span>`
          : `<span style="background:rgba(255,255,255,0.05); color:#94a3b8; border:1px solid rgba(255,255,255,0.08); font-size:10px; font-weight:600; padding:2px 7px; border-radius:6px;">📖 Trading Journal</span>`;

        return `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
            <td style="padding:12px 16px;">
              <div style="font-weight:700; color:#fff; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span>${escapeHtml(s.name)}</span>
                ${staffBadgeHtml}
              </div>
              <div style="font-size:11px; color:#64748b;">${escapeHtml(s.email)}</div>
            </td>
            <td style="padding:12px 14px; font-family:var(--mono); color:#94a3b8; font-size:11.5px;">
              ${dateStr}
            </td>
            <td style="padding:12px 14px;">
              ${tpBadge}
            </td>
            <td style="padding:12px 14px;">
              <select onchange="updateStudentMembership('${s.id}', this.value)" style="${stClass} font-size:11px; font-weight:800; padding:4px 8px; border-radius:8px; outline:none; cursor:pointer;">
                <option value="Ninguna" ${currentM === 'Ninguna' ? 'selected' : ''}>⚪ Sin Asignar</option>
                <option value="VIP" ${currentM === 'VIP' ? 'selected' : ''}>🟡 VIP</option>
                <option value="Mensual" ${currentM === 'Mensual' ? 'selected' : ''}>🟢 Mensual</option>
                <option value="Anual" ${currentM === 'Anual' ? 'selected' : ''}>🔵 Anual</option>
                <option value="Lifetime" ${currentM === 'Lifetime' ? 'selected' : ''}>🟣 Lifetime</option>
              </select>
            </td>
            <td style="padding:12px 14px; text-align:right;">
              <div style="display:inline-flex; align-items:center; justify-content:flex-end; gap:8px;">
                <span id="mstatus-${s.id}" style="font-size:10.5px; color:#4ade80; font-weight:700; white-space:nowrap;">✓ Guardado</span>
                <button type="button" class="btn-grey" onclick="adminDeleteStudent('${s.id}')" style="font-size:11px; padding:4px 9px; border-radius:6px; color:#ef4444; border-color:rgba(239,68,68,0.35); background:rgba(239,68,68,0.06); display:inline-flex; align-items:center; gap:4px; cursor:pointer;" title="Eliminar usuario permanentemente de Syntracker">
                  <span>🗑️</span> Borrar
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    window.filterMembershipTable = function(filter) {
      if (filter) {
        currentMembershipFilter = filter;
        document.querySelectorAll('.mfilter-btn').forEach(b => {
          if (b.getAttribute('data-mfilter') === filter) b.classList.add('active');
          else b.classList.remove('active');
        });
      }
      const searchInput = document.getElementById('membership-search-input');
      currentMembershipSearch = searchInput ? searchInput.value : '';
      renderAdminMembershipsTable();
    };

    window.updateStudentMembership = async function(userId, newMembership) {
      const student = adminStudentsData.find(s => s.id === userId);
      if (!student) return;

      const statusEl = document.getElementById('mstatus-' + userId);
      if (statusEl) {
        statusEl.textContent = 'Guardando...';
        statusEl.style.color = '#eab308';
      }

      try {
        // 1. Persistir membresía en user_metadata de Auth preservando metadatos existentes
        const currentMeta = student.user_metadata || {};
        const updatedMeta = Object.assign({}, currentMeta, {
          membership: newMembership,
          membership_updated_at: new Date().toISOString()
        });

        const res = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userId, {
          method: 'PUT',
          headers: {
            'apikey': ADMIN_SERVICE_KEY,
            'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_metadata: updatedMeta
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.error_description || ('HTTP ' + res.status));
        }

        // 2. Si participa en el torneo, sincronizar también su badge en tournament_participants
        if (student.tp && student.tp.id) {
          try {
            const tpObj = adminParticipantsData.find(p => p.id === student.tp.id);
            let badges = tpObj && Array.isArray(tpObj.badges) ? [...tpObj.badges] : [];
            badges = badges.filter(b => !(b && b.membership));
            if (newMembership !== 'Ninguna') {
              badges.push({ membership: newMembership, label: newMembership, updated_at: new Date().toISOString() });
            }
            await fetch(SUPABASE_URL + '/rest/v1/tournament_participants?id=eq.' + student.tp.id, {
              method: 'PATCH',
              headers: {
                'apikey': ADMIN_SERVICE_KEY,
                'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify({ badges: badges })
            });
            if (tpObj) tpObj.badges = badges;
            if (student.tp) student.tp.badges = badges;
          } catch (tpErr) {
            console.warn('Advertencia al sincronizar badges de torneo:', tpErr);
          }
        }

        student.membership = newMembership;
        student.user_metadata = updatedMeta;

        // Si es el usuario logueado actualmente, sincronizar sesión local
        const curU = sb.getUser();
        if (curU && curU.id === userId) {
          curU.user_metadata = Object.assign({}, curU.user_metadata || {}, updatedMeta);
          localStorage.setItem('syntracker_auth_session', JSON.stringify({
            token: sb.getToken(),
            user: curU,
            saved_at: Date.now()
          }));
          renderUserProfile(curU);
        }

        if (statusEl) {
          statusEl.textContent = '✓ Guardado';
          statusEl.style.color = '#4ade80';
        }
        if (typeof toast === 'function') {
          toast(`Membresía de ${student.name} actualizada a ${newMembership}.`, 'success');
        }
        renderAdminMembershipsTable();
      } catch (err) {
        console.error('Error guardando membresía:', err);
        if (statusEl) {
          statusEl.textContent = 'Error al guardar';
          statusEl.style.color = '#ef4444';
        }
        if (typeof toast === 'function') {
          toast('Error al actualizar membresía: ' + (err.message || 'Error en Supabase'), 'error');
        }
      }
    };

    window.adminDeleteStudent = async function(userId) {
      const student = adminStudentsData.find(s => s.id === userId);
      if (!student) {
        toast('No se encontró el estudiante.', 'error');
        return;
      }

      // Proteger a los administradores de ser eliminados accidentalmente
      const email = (student.email || '').toLowerCase().trim();
      const protectedAdmins = ['parkjiminfromsara@gmail.com', 'estebangoldfx@gmail.com', 'infogoldfx@gmail.com'];
      const protectedIds = ['8ffa85d8-cf48-4b2b-a720-98ff14e99553', '26b36306-b12c-481c-b43e-fe4f1452a210', '84061dcc-f1dd-4a1f-8e2a-bbbe63045787'];
      if (protectedAdmins.includes(email) || protectedIds.includes(userId)) {
        toast('⚠️ Acción denegada: No se puede eliminar a una cuenta de administrador.', 'error');
        return;
      }

      const confirmMsg = `¿Estás seguro de que deseas eliminar permanentemente a este usuario?\n\n` +
        `• Nombre: ${student.name}\n` +
        `• Correo: ${student.email}\n\n` +
        `Esta acción es irreversible y eliminará su cuenta y accesos en Syntracker.`;

      if (!confirm(confirmMsg)) return;

      showLoading(true);
      try {
        // 1. Limpiar datos asociados en base de datos si existen
        try {
          await fetch(SUPABASE_URL + '/rest/v1/trades?user_id=eq.' + userId, {
            method: 'DELETE',
            headers: { 'apikey': ADMIN_SERVICE_KEY, 'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY }
          });
        } catch (e1) {}

        try {
          await fetch(SUPABASE_URL + '/rest/v1/accounts?user_id=eq.' + userId, {
            method: 'DELETE',
            headers: { 'apikey': ADMIN_SERVICE_KEY, 'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY }
          });
        } catch (e2) {}

        if (student.tp && student.tp.id) {
          try {
            await fetch(SUPABASE_URL + '/rest/v1/tournament_participants?id=eq.' + student.tp.id, {
              method: 'DELETE',
              headers: { 'apikey': ADMIN_SERVICE_KEY, 'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY }
            });
          } catch (e3) {}
        } else if (email) {
          try {
            await fetch(SUPABASE_URL + '/rest/v1/tournament_participants?user_email=eq.' + encodeURIComponent(email), {
              method: 'DELETE',
              headers: { 'apikey': ADMIN_SERVICE_KEY, 'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY }
            });
          } catch (e3b) {}
        }

        try {
          await fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + userId, {
            method: 'DELETE',
            headers: { 'apikey': ADMIN_SERVICE_KEY, 'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY }
          });
        } catch (e4) {}

        // 2. Eliminar de Supabase Auth Admin
        const authRes = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userId, {
          method: 'DELETE',
          headers: {
            'apikey': ADMIN_SERVICE_KEY,
            'Authorization': 'Bearer ' + ADMIN_SERVICE_KEY
          }
        });

        if (!authRes.ok) {
          const errData = await authRes.json().catch(() => ({}));
          console.error('Error Auth DELETE:', errData);
          throw new Error(errData.message || 'Error al eliminar usuario en Auth');
        }

        toast(`Estudiante ${student.name} eliminado exitosamente.`, 'success');

        // Recargar datos del panel
        await loadAdminData();
        renderAdminDashboard();

      } catch (err) {
        console.error('Error eliminando estudiante:', err);
        toast('Error al eliminar estudiante: ' + (err.message || 'Error desconocido'), 'error');
      } finally {
        showLoading(false);
      }
    };

    // ── Pestaña 3: Gestión del Torneo (74 Participantes MT5) ──
    function renderAdminTournamentTable() {
      const tbody = document.getElementById('admin-tournament-tbody');
      if (!tbody) return;

      const term = (currentTournamentSearch || '').toLowerCase().trim();
      let items = [...adminParticipantsData];

      if (term) {
        items = items.filter(p => {
          const name = (p.user_name || '').toLowerCase();
          const login = String(p.mt5_login || '');
          return name.includes(term) || login.includes(term);
        });
      }

      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="padding:28px; text-align:center; color:#94a3b8;">No hay participantes que coincidan con la búsqueda.</td></tr>';
        return;
      }

      tbody.innerHTML = items.map((p, idx) => {
        const isDisq = (p.status && p.status.startsWith('Descalificado')) || parseFloat(p.dd_max_pct || 0) >= 5.0;
        const violations = parseInt(p.violations_count || 0, 10);
        const pnl = parseFloat(p.return_pct || 0).toFixed(2);
        const pnlCol = pnl >= 0 ? '#4ade80' : '#f87171';
        const maxDd = parseFloat(p.dd_max_pct || 0).toFixed(2);

        return `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px; transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
            <td style="padding:12px 16px; color:#64748b; font-family:var(--mono);">#${idx + 1}</td>
            <td style="padding:12px 14px;">
              <div style="font-weight:700; color:#fff;">${escapeHtml(p.user_name || 'Participante')}</div>
            </td>
            <td style="padding:12px 14px; font-family:var(--mono); color:#cbd5e1;">${p.mt5_login}</td>
            <td style="padding:12px 14px; font-family:var(--mono); color:#94a3b8; font-size:11px;">${p.mt5_server || 'WeTrade-MT5'}</td>
            <td style="padding:12px 14px; font-family:var(--mono); color:#cbd5e1;">$${parseFloat(p.initial_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td style="padding:12px 14px; font-family:var(--mono); color:#cbd5e1;">$${parseFloat(p.current_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td style="padding:12px 14px; font-family:var(--mono); font-weight:800; color:${pnlCol};">${pnl >= 0 ? '+' : ''}${pnl}%</td>
            <td style="padding:12px 14px; font-family:var(--mono); color:${parseFloat(maxDd) >= 5.0 ? '#ef4444' : '#cbd5e1'};">${maxDd}%</td>
            <td style="padding:12px 14px;">
              ${isDisq 
                ? '<span style="background:rgba(239,68,68,0.18); color:#ef4444; border:1px solid rgba(239,68,68,0.4); font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; text-transform:uppercase;">🚫 Descalificado</span>' 
                : '<span style="background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.4); font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; text-transform:uppercase;">Activo</span>'}
            </td>
            <td style="padding:12px 14px; text-align:right;">
              <div style="display:inline-flex; gap:6px;">
                <button type="button" class="btn-grey" onclick="openAdminEditModal('${p.id}')" style="font-size:11px; padding:4px 8px; border-radius:6px;" title="Editar credenciales MT5">✏️</button>
                ${isDisq ? `
                  <button type="button" class="btn-grey" onclick="adminReactivateParticipant('${p.id}')" style="font-size:11px; padding:4px 8px; border-radius:6px; color:#4ade80;" title="Reactivar">🔄</button>
                ` : `
                  <button type="button" class="btn-grey" onclick="openAdminDisqualifyModal('${p.id}')" style="font-size:11px; padding:4px 8px; border-radius:6px; color:#ef4444;" title="Descalificar">🛑</button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    window.filterAdminTournament = function() {
      const input = document.getElementById('tournament-manage-search') || document.getElementById('admin-tourney-search');
      currentTournamentSearch = input ? input.value : '';
      renderAdminTournamentTable();
    };
    window.filterTournamentManagementTable = window.filterAdminTournament;

    window.openAdminEditModal = function(pid) {
      const p = adminParticipantsData.find(item => item.id === pid);
      if (!p) {
        toast('No se encontró el participante.', 'error');
        return;
      }
      const elPid = document.getElementById('aedit-pid');
      const elName = document.getElementById('aedit-student-name');
      const elLogin = document.getElementById('aedit-login');
      const elPass = document.getElementById('aedit-password');
      const elServer = document.getElementById('aedit-server');
      const elBal = document.getElementById('aedit-initial-balance');

      if (elPid) elPid.value = p.id;
      if (elName) elName.textContent = (p.user_name || 'Estudiante') + ' (#' + (p.mt5_login || 'Sin login') + ')';
      if (elLogin) elLogin.value = p.mt5_login || '';
      if (elPass) {
        elPass.value = p.mt5_password || '';
        elPass.type = 'password';
      }
      if (elServer) elServer.value = p.mt5_server || 'WeTrade-MT5';
      if (elBal) elBal.value = p.initial_balance || 0;

      openModal('admin-edit-modal');
    };

    window.toggleEditPwdVisibility = function() {
      const el = document.getElementById('aedit-password');
      if (el) el.type = el.type === 'password' ? 'text' : 'password';
    };
    window.toggleAdminPassVisibility = window.toggleEditPwdVisibility;

    window.saveAdminEditParticipant = async function(e) {
      if (e && e.preventDefault) e.preventDefault();
      const pid = document.getElementById('aedit-pid').value;
      const login = document.getElementById('aedit-login').value.trim();
      const pass = document.getElementById('aedit-password').value.trim();
      const server = document.getElementById('aedit-server').value.trim() || 'WeTrade-MT5';
      const balance = parseFloat(document.getElementById('aedit-initial-balance').value) || 0;

      if (!login) {
        toast('El login de MT5 es obligatorio.', 'error');
        return;
      }

      showLoading(true);
      try {
        await sb.query('tournament_participants', {
          method: 'PATCH',
          filter: 'id=eq.' + pid,
          body: {
            mt5_login: parseInt(login, 10),
            mt5_password: pass,
            mt5_server: server,
            initial_balance: balance
          }
        });
        toast('Credenciales MT5 guardadas con éxito.', 'success');
        closeModal('admin-edit-modal');
        await loadAdminData();
        renderAdminTournamentTable();
        renderAdminAuditFeed();
        if (activeAdminSubtab === 'bot') loadAdminBotTab();
      } catch (err) {
        console.error('Error guardando credenciales MT5:', err);
        toast('Error al guardar credenciales en Supabase.', 'error');
      } finally {
        showLoading(false);
      }
    };
    window.submitAdminParticipantEdit = window.saveAdminEditParticipant;

    window.openAdminDisqualifyModal = function(pid) {
      const p = adminParticipantsData.find(item => item.id === pid);
      if (!p) return;
      const elPid = document.getElementById('adisq-pid');
      const elName = document.getElementById('adisq-student-name');
      const elSelect = document.getElementById('adisq-reason-select');
      const elCustom = document.getElementById('adisq-reason-custom');

      if (elPid) elPid.value = p.id;
      if (elName) elName.textContent = (p.user_name || 'Estudiante') + ' (#' + p.mt5_login + ')';
      if (elSelect) elSelect.value = 'Superó el 5% de Drawdown Máximo';
      if (elCustom) {
        elCustom.value = '';
        elCustom.style.display = 'none';
      }
      openModal('admin-disqualify-modal');
    };

    window.handleDisqReasonSelect = function(sel) {
      const customInput = document.getElementById('adisq-reason-custom');
      if (customInput) {
        customInput.style.display = sel.value === 'Otro motivo' ? 'block' : 'none';
        if (sel.value === 'Otro motivo') customInput.focus();
      }
    };

    window.confirmAdminDisqualify = async function(e) {
      if (e && e.preventDefault) e.preventDefault();
      const pid = document.getElementById('adisq-pid').value;
      const selVal = document.getElementById('adisq-reason-select').value;
      const customVal = document.getElementById('adisq-reason-custom').value.trim();
      const reason = (selVal === 'Otro motivo' && customVal) ? customVal : selVal;

      showLoading(true);
      try {
        await sb.query('tournament_participants', {
          method: 'PATCH',
          filter: 'id=eq.' + pid,
          body: {
            status: 'Descalificado: ' + reason,
            disqualification_reason: reason
          }
        });
        toast('Participante descalificado correctamente.', 'success');
        closeModal('admin-disqualify-modal');
        await loadAdminData();
        renderAdminDashboard();
      } catch (err) {
        console.error('Error descalificando:', err);
        toast('Error al descalificar en Supabase.', 'error');
      } finally {
        showLoading(false);
      }
    };
    window.submitAdminDisqualification = window.confirmAdminDisqualify;

    // ── Pestaña 4: Comunicados y Anuncios Globales (Sincronizado en Supabase) ──
    const DISMISSED_ANNOUNCEMENTS_KEY = 'syntracker_dismissed_announcements_v3';
    let currentAnnouncementType = 'info';
    let activeAnnouncementsList = [];
    let currentBannerIndex = 0;

    // Limpieza de claves viejas de dismissal compartidas
    try {
      localStorage.removeItem('syntracker_dismissed_announcements_v1');
      localStorage.removeItem('syntracker_dismissed_announcements_v2');
      localStorage.removeItem('syntracker_global_announcement');
    } catch (e) {}

    function getDismissedList() {
      try {
        const u = sb.getUser();
        const userSuffix = u ? ('_' + u.id) : '';
        const raw = sessionStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY + userSuffix);
        return JSON.parse(raw || '[]');
      } catch (e) {
        return [];
      }
    }

    function addDismissedId(annId) {
      if (!annId) return;
      try {
        const u = sb.getUser();
        const userSuffix = u ? ('_' + u.id) : '';
        const list = getDismissedList();
        if (!list.includes(annId)) {
          list.push(annId);
          sessionStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY + userSuffix, JSON.stringify(list));
        }
      } catch (e) {}
    }

    window.setAnnouncementType = function(type) {
      currentAnnouncementType = type;
      const btnInfo = document.getElementById('atype-btn-info');
      const btnUrgent = document.getElementById('atype-btn-urgent');
      if (btnInfo && btnUrgent) {
        if (type === 'urgent') {
          btnUrgent.style.background = 'rgba(239,68,68,0.2)';
          btnUrgent.style.borderColor = '#ef4444';
          btnUrgent.style.color = '#f87171';
          btnInfo.style.background = 'rgba(255,255,255,0.05)';
          btnInfo.style.borderColor = 'rgba(255,255,255,0.12)';
          btnInfo.style.color = '#94a3b8';
        } else {
          btnInfo.style.background = 'rgba(234,179,8,0.18)';
          btnInfo.style.borderColor = '#eab308';
          btnInfo.style.color = '#facc15';
          btnUrgent.style.background = 'rgba(255,255,255,0.05)';
          btnUrgent.style.borderColor = 'rgba(255,255,255,0.12)';
          btnUrgent.style.color = '#94a3b8';
        }
      }
    };

    function formatTimeAgo(isoString) {
      if (!isoString) return '';
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 60) return 'Hace un momento';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Hace ${diffMin} min`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `Hace ${diffHr} hora${diffHr > 1 ? 's' : ''}`;
      const diffDays = Math.floor(diffHr / 24);
      return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    }

    async function getActiveTournamentWithRules() {
      try {
        const res = await fetch(SUPABASE_URL + '/rest/v1/tournaments?select=id,rules,status&order=created_at.desc', {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) return data[0];
        }
      } catch (e) {
        console.warn('Error obteniendo torneo activo:', e);
      }
      return null;
    }

    async function fetchServerAnnouncements() {
      const tourney = await getActiveTournamentWithRules();
      if (!tourney || !tourney.rules || !Array.isArray(tourney.rules.announcements)) {
        return null;
      }
      return [...tourney.rules.announcements]
        .filter(a => a && a.active !== false)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    async function saveServerAnnouncements(announcementsList) {
      const tourney = await getActiveTournamentWithRules();
      const tourneyId = tourney ? tourney.id : '7639677c-4054-4a88-a75e-7f5f253cc5b6';
      const currentRules = (tourney && tourney.rules) ? Object.assign({}, tourney.rules) : {};
      currentRules.announcements = announcementsList;

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
        throw new Error('Error al actualizar comunicados en Supabase: ' + err);
      }
      return announcementsList;
    }

    function renderAdminAnnouncementsUI() {
      const listContainer = document.getElementById('admin-announcements-list');
      const badge = document.getElementById('announcements-count-badge');
      if (!listContainer) return;

      const items = activeAnnouncementsList || [];
      if (badge) badge.textContent = items.length + ' activo' + (items.length === 1 ? '' : 's');

      if (items.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align:center; padding:18px 12px; color:#94a3b8; font-size:12px; border:1px dashed rgba(255,255,255,0.08); border-radius:10px;">
            <div style="font-size:20px; margin-bottom:4px;">📭</div>
            No hay comunicados activos en este momento.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = items.map((ann, idx) => {
        const isUrgent = ann.type === 'urgent';
        const typeBadge = isUrgent
          ? `<span style="background:rgba(239,68,68,0.18); color:#ef4444; border:1px solid rgba(239,68,68,0.35); font-size:9.5px; font-weight:800; padding:1.5px 7px; border-radius:8px; text-transform:uppercase;">🚨 Urgente</span>`
          : `<span style="background:rgba(234,179,8,0.18); color:#facc15; border:1px solid rgba(234,179,8,0.35); font-size:9.5px; font-weight:800; padding:1.5px 7px; border-radius:8px; text-transform:uppercase;">📢 Oficial</span>`;

        const timeAgo = formatTimeAgo(ann.created_at);

        return `
          <div style="background:#13161f; border-left:3px solid ${isUrgent ? '#ef4444' : '#eab308'}; border-radius:8px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                ${typeBadge}
                <span style="font-size:10.5px; color:#94a3b8;">✍️ <strong>${escapeHtml(ann.author_name || 'Admin')}</strong> • ${timeAgo}</span>
              </div>
              <div style="font-size:12px; color:#f8fafc; font-weight:600; line-height:1.4; word-break:break-word;">${escapeHtml(ann.text)}</div>
            </div>
            <button type="button" class="btn-grey" onclick="adminDeleteAnnouncement('${ann.id}')" style="font-size:11px; padding:3px 7px; border-radius:6px; color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.06); cursor:pointer; flex-shrink:0;" title="Eliminar este aviso">
              <span>🗑️</span>
            </button>
          </div>
        `;
      }).join('');
    }

    function renderStudentBannerUI() {
      const banner = document.getElementById('global-announcement-banner');
      if (!banner) return;

      const dismissed = getDismissedList();
      const visible = (activeAnnouncementsList || []).filter(a => a && a.active !== false && !dismissed.includes(a.id));

      if (visible.length === 0) {
        banner.style.display = 'none';
        return;
      }

      if (currentBannerIndex >= visible.length) currentBannerIndex = 0;
      if (currentBannerIndex < 0) currentBannerIndex = visible.length - 1;

      const ann = visible[currentBannerIndex];
      const isUrgent = ann.type === 'urgent';

      banner.style.display = 'flex';
      banner.style.background = isUrgent
        ? 'linear-gradient(90deg, rgba(239,68,68,0.22), rgba(185,28,28,0.1))'
        : 'linear-gradient(90deg, rgba(234,179,8,0.18), rgba(245,158,11,0.08))';
      banner.style.borderColor = isUrgent ? 'rgba(239,68,68,0.45)' : 'rgba(234,179,8,0.35)';

      const iconBox = document.getElementById('announcement-banner-icon-box');
      const iconEl = document.getElementById('announcement-banner-icon');
      const badgeEl = document.getElementById('announcement-banner-badge');
      const metaEl = document.getElementById('announcement-banner-meta');
      const textEl = document.getElementById('announcement-banner-text');
      const navPills = document.getElementById('announcement-nav-pills');
      const navCounter = document.getElementById('announcement-nav-counter');

      if (iconBox) {
        iconBox.style.background = isUrgent ? 'rgba(239,68,68,0.18)' : 'rgba(234,179,8,0.15)';
        iconBox.style.borderColor = isUrgent ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.35)';
      }
      if (iconEl) iconEl.textContent = isUrgent ? '🚨' : '📢';
      if (badgeEl) {
        badgeEl.textContent = isUrgent ? 'ALERTA URGENTE' : 'COMUNICADO OFICIAL';
        badgeEl.style.color = isUrgent ? '#ef4444' : '#eab308';
      }
      if (metaEl) {
        metaEl.textContent = `• ✍️ ${ann.author_name || 'Admin'} (${ann.author_role || 'Admin'}) • ${formatTimeAgo(ann.created_at)}`;
      }
      if (textEl) {
        textEl.textContent = ann.text;
        textEl.style.color = isUrgent ? '#fee2e2' : '#fef08a';
      }

      if (navPills && navCounter) {
        if (visible.length > 1) {
          navPills.style.display = 'inline-flex';
          navCounter.textContent = `${currentBannerIndex + 1}/${visible.length}`;
        } else {
          navPills.style.display = 'none';
        }
      }
    }

    window.prevAnnouncement = function(e) {
      if (e) e.stopPropagation();
      currentBannerIndex--;
      renderStudentBannerUI();
    };

    window.nextAnnouncement = function(e) {
      if (e) e.stopPropagation();
      currentBannerIndex++;
      renderStudentBannerUI();
    };

    window.dismissCurrentAnnouncement = function() {
      const dismissed = getDismissedList();
      const visible = (activeAnnouncementsList || []).filter(a => a && !dismissed.includes(a.id));
      if (visible[currentBannerIndex]) {
        addDismissedId(visible[currentBannerIndex].id);
      }
      renderStudentBannerUI();
    };

    window.publishGlobalAnnouncement = async function() {
      const inp = document.getElementById('admin-announcement-input');
      const text = inp ? inp.value.trim() : '';

      if (!text) {
        toast('Escribe el texto del comunicado antes de publicar.', 'error');
        return;
      }

      const u = sb.getUser() || {};
      const meta = u.user_metadata || {};
      const staff = getStaffInfo(u);
      const roleName = staff ? staff.label : (getAdminRole() === 'superadmin' ? 'Desarrolladora' : 'Admin');
      const authorName = meta.full_name || meta.name || (staff ? staff.display.replace(/^[^\s]+\s*/, '') : 'Administrador');

      const newAnn = {
        id: 'ann-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        text: text,
        type: currentAnnouncementType || 'info',
        author_name: authorName,
        author_role: roleName,
        author_email: u.email || '',
        created_at: new Date().toISOString(),
        active: true
      };

      if (inp) inp.value = '';
      const charCount = document.getElementById('admin-announcement-charcount');
      if (charCount) charCount.textContent = '0 caracteres';

      // 1. Mostrar de inmediato en pantalla local
      activeAnnouncementsList = [newAnn, ...activeAnnouncementsList.filter(a => a && a.id !== newAnn.id)];
      currentBannerIndex = 0;
      renderAdminAnnouncementsUI();
      renderStudentBannerUI();

      // 2. Traer la lista más reciente de Supabase para no sobreescribir los avisos de otros admins
      try {
        const freshServerList = await fetchServerAnnouncements();
        const mergedList = [newAnn, ...freshServerList.filter(a => a && a.id !== newAnn.id)];
        activeAnnouncementsList = mergedList;
        renderAdminAnnouncementsUI();
        renderStudentBannerUI();

        await saveServerAnnouncements(mergedList);
        toast('¡Aviso publicado y sincronizado en la nube!', 'success');
      } catch (err) {
        console.error('Error persistiendo comunicado en Supabase:', err);
        toast('Error al guardar en la nube: ' + (err.message || 'Error de conexión'), 'error');
      }
    };

    window.adminDeleteAnnouncement = async function(annId) {
      if (!confirm('¿Deseas eliminar este comunicado de la plataforma?')) return;

      activeAnnouncementsList = activeAnnouncementsList.filter(a => a && a.id !== annId);
      currentBannerIndex = 0;
      renderAdminAnnouncementsUI();
      renderStudentBannerUI();

      try {
        const freshServerList = await fetchServerAnnouncements();
        const mergedList = freshServerList.filter(a => a && a.id !== annId);
        activeAnnouncementsList = mergedList;
        renderAdminAnnouncementsUI();
        renderStudentBannerUI();

        await saveServerAnnouncements(mergedList);
        toast('Comunicado eliminado exitosamente.', 'success');
      } catch (err) {
        console.error('Error eliminando comunicado en Supabase:', err);
        toast('Error al eliminar en la nube.', 'error');
      }
    };

    window.clearGlobalAnnouncement = window.adminDeleteAnnouncement;

    async function loadGlobalAnnouncement() {
      try {
        const res = await fetchServerAnnouncements();
        if (Array.isArray(res)) {
          activeAnnouncementsList = res;
          renderStudentBannerUI();
        }
      } catch (e) {
        console.warn('Error cargando anuncios globales:', e);
      }
    }
    window.loadGlobalAnnouncement = loadGlobalAnnouncement;

    async function loadAdminAnnouncementInput() {
      const input = document.getElementById('admin-announcement-input');
      const charCount = document.getElementById('admin-announcement-charcount');

      if (input && !input.oninput) {
        input.oninput = function() {
          if (charCount) charCount.textContent = this.value.length + ' caracteres';
        };
      }

      renderAdminAnnouncementsUI();
      try {
        const res = await fetchServerAnnouncements();
        if (Array.isArray(res)) {
          activeAnnouncementsList = res;
          renderAdminAnnouncementsUI();
        }
      } catch (e) {}
    }
    window.loadAdminAnnouncementInput = loadAdminAnnouncementInput;

    // Sincronización automática periódica en segundo plano cada 8 segundos
    if (!window._announcementSyncInterval) {
      window._announcementSyncInterval = setInterval(async () => {
        try {
          const latest = await fetchServerAnnouncements();
          if (!Array.isArray(latest)) return; // No sobreescribir si hubo error de red
          const currentIds = (activeAnnouncementsList || []).map(a => a.id).join(',');
          const latestIds = latest.map(a => a.id).join(',');
          if (currentIds !== latestIds) {
            activeAnnouncementsList = latest;
            renderAdminAnnouncementsUI();
            renderStudentBannerUI();
          }
        } catch (e) {}
      }, 8000);
    }

    // ── Pestaña 5: Monitor de Salud del Bot (Superadmin Sara) ──
    async function loadAdminBotTab() {
      if (!isAdminUser()) {
        const botSec = document.getElementById('admin-sec-bot');
        if (botSec) botSec.style.display = 'none';
        return;
      }

      const statusDot = document.getElementById('bot-status-dot');
      const statusText = document.getElementById('bot-status-text');
      const lastSyncText = document.getElementById('bot-last-sync');
      const succEl = document.getElementById('bot-success-count');
      const totEl = document.getElementById('bot-total-count');
      const failBadge = document.getElementById('bot-failed-badge');
      const pingEl = document.getElementById('db-ping-display');
      const container = document.getElementById('bot-failed-accounts-container');

      showLoading(true);
      const t0 = performance.now();
      try {
        const tourneys = await sb.query('tournaments', { select: '*', filter: 'status=eq.Activo', order: 'created_at.desc' });
        const latency = Math.round(performance.now() - t0);
        if (pingEl) pingEl.textContent = latency + ' ms';

        let heartbeat = null;
        if (Array.isArray(tourneys) && tourneys.length > 0 && tourneys[0].rules && tourneys[0].rules.bot_heartbeat) {
          heartbeat = tourneys[0].rules.bot_heartbeat;
        }

        const totalMonitored = adminParticipantsData.length || 74;
        if (totEl) totEl.textContent = totalMonitored;

        if (heartbeat) {
          const lastDate = new Date(heartbeat.last_sync);
          const diffMinutes = Math.round((Date.now() - lastDate.getTime()) / 60000);
          let timeAgo = diffMinutes <= 0 ? 'Hace menos de 1 min' : (diffMinutes === 1 ? 'Hace 1 min' : 'Hace ' + diffMinutes + ' min');
          if (diffMinutes > 120) timeAgo = lastDate.toLocaleDateString('es-CO', { hour: '2-digit', minute: '2-digit' });

          if (lastSyncText) lastSyncText.textContent = timeAgo;

          const isOnline = diffMinutes <= 15;
          if (statusText) {
            statusText.textContent = isOnline ? 'En Línea' : 'Inactivo';
            statusText.style.color = isOnline ? '#4ade80' : '#f87171';
          }
          if (statusDot) {
            statusDot.style.background = isOnline ? '#4ade80' : '#ef4444';
            statusDot.style.boxShadow = isOnline ? '0 0 8px #4ade80' : '0 0 8px #ef4444';
          }

          const failedList = Array.isArray(heartbeat.failed_accounts) ? heartbeat.failed_accounts : [];
          const successCount = heartbeat.success_count !== undefined ? heartbeat.success_count : (totalMonitored - failedList.length);

          if (succEl) succEl.textContent = successCount;
          if (failBadge) failBadge.textContent = failedList.length;

          if (container) {
            if (failedList.length === 0) {
              container.innerHTML = `
                <div style="text-align:center; padding:32px 20px; color:#94a3b8; font-size:13px;">
                  <div style="font-size:32px; margin-bottom:8px;">✅</div>
                  <strong style="color:#4ade80; font-size:15px;">¡Todas las cuentas MT5 están conectando perfectamente!</strong>
                  <div style="margin-top:6px; font-size:12px; color:#cbd5e1;">No se detectaron errores de contraseña ni caídas de broker en la última sincronización.</div>
                </div>
              `;
            } else {
              container.innerHTML = `
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; text-align:left; font-size:12px;">
                    <thead>
                      <tr style="background:#13161f; color:#94a3b8; font-size:10.5px; font-weight:800; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.08);">
                        <th style="padding:12px 16px;">Estudiante</th>
                        <th style="padding:12px 14px;">Cuenta MT5</th>
                        <th style="padding:12px 14px;">Servidor</th>
                        <th style="padding:12px 14px;">Diagnóstico del Error</th>
                        <th style="padding:12px 14px; text-align:right;">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${failedList.map(f => {
                        const pMatch = adminParticipantsData.find(p => String(p.mt5_login) === String(f.login));
                        const pid = pMatch ? pMatch.id : '';
                        return `
                          <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                            <td style="padding:12px 16px;">
                              <div style="font-weight:700; color:#fff;">${escapeHtml(f.name || 'Estudiante')}</div>
                            </td>
                            <td style="padding:12px 14px; font-family:var(--mono); color:#ef4444; font-weight:700;">#${f.login}</td>
                            <td style="padding:12px 14px; font-family:var(--mono); color:#94a3b8; font-size:11px;">${f.server || 'WeTrade-MT5'}</td>
                            <td style="padding:12px 14px;">
                              <span style="background:rgba(239,68,68,0.15); color:#fca5a5; border:1px solid rgba(239,68,68,0.3); font-size:11px; font-weight:600; padding:2px 8px; border-radius:6px;">
                                ⚠️ ${escapeHtml(f.reason || 'Error de conexión')}
                              </span>
                            </td>
                            <td style="padding:12px 14px; text-align:right;">
                              ${pid ? `
                                <button type="button" class="btn-gold" onclick="openAdminEditModal('${pid}')" style="font-size:11px; padding:4px 10px; border-radius:6px; font-weight:700;">
                                  ✏️ Corregir Clave
                                </button>
                              ` : '—'}
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `;
            }
          }
        } else {
          if (statusText) statusText.textContent = 'Sin Datos';
          if (lastSyncText) lastSyncText.textContent = 'Esperando primer ciclo';
          if (succEl) succEl.textContent = totalMonitored;
          if (failBadge) failBadge.textContent = '0';
          if (container) {
            container.innerHTML = `
              <div style="text-align:center; padding:32px 20px; color:#94a3b8; font-size:13px;">
                <div style="font-size:32px; margin-bottom:8px;">⏳</div>
                <strong style="color:#cbd5e1;">El bot registrará su primer ciclo de salud al arrancar.</strong>
              </div>
            `;
          }
        }
      } catch (err) {
        console.error('Error cargando salud del bot:', err);
      } finally {
        showLoading(false);
      }
    }
    window.loadAdminBotTab = loadAdminBotTab;
