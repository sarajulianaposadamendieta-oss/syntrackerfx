      // ── TORNEO DE TRADING (STARKLAB LUXURY GAMING EDITION) ──
      let activeTournament = null;
      let tournamentParticipants = [];
      let activeTournamentTimeframe = 'all'; // 'all' | 'week' | 'month'

      const CRESTS = {
        platino: (size = 48) => `
          <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
            <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="#0c1e2e" stroke="#22d3ee" stroke-width="2.2"/>
            <polygon points="32,10 50,21 50,43 32,54 14,43 14,21" fill="#0e3d54" stroke="#67e8f9" stroke-width="1.5"/>
            <polygon points="32,18 44,25 44,39 32,46 20,39 20,25" fill="#0891b2" stroke="#a5f3fc" stroke-width="1.5"/>
            <path d="M32 24L38 34H34V42H30V34H26L32 24Z" fill="#ffffff"/>
            <circle cx="32" cy="14" r="2.5" fill="#a5f3fc"/>
            <path d="M18 48L32 54L46 48" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/>
          </svg>`,
        oro: (size = 48) => `
          <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
            <path d="M12 24C12 24 20 18 32 18C44 18 52 24 52 24C52 40 42 52 32 58C22 52 12 40 12 24Z" fill="#2d1e05" stroke="#eab308" stroke-width="2.2"/>
            <path d="M8 30C16 28 24 30 28 38C22 40 16 38 8 30Z" fill="#ca8a04"/>
            <path d="M56 30C48 28 40 30 36 38C42 40 48 38 56 30Z" fill="#ca8a04"/>
            <polygon points="32,22 44,30 40,46 32,52 24,46 20,30" fill="#eab308" stroke="#fef08a" stroke-width="1.5"/>
            <polygon points="32,28 38,34 35,43 32,46 29,43 26,34" fill="#b45309" stroke="#fde047" stroke-width="1"/>
            <polygon points="32,31 35,36 32,40 29,36" fill="#fef08a"/>
          </svg>`,
        plata: (size = 48) => `
          <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
            <path d="M14 22C14 22 22 18 32 18C42 18 50 22 50 22C50 38 42 50 32 56C22 50 14 38 14 22Z" fill="#1e293b" stroke="#94a3b8" stroke-width="2.2"/>
            <path d="M10 28C16 26 22 28 26 34C20 36 14 34 10 28Z" fill="#64748b"/>
            <path d="M54 28C48 26 42 28 38 34C44 36 50 34 54 28Z" fill="#64748b"/>
            <polygon points="32,24 42,32 38,46 32,50 26,46 22,32" fill="#475569" stroke="#cbd5e1" stroke-width="1.5"/>
            <path d="M32 29L34 35H40L35 39L37 45L32 41L27 45L29 39L24 35H30L32 29Z" fill="#f8fafc"/>
          </svg>`,
        bronce: (size = 48) => `
          <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
            <path d="M14 22C14 22 22 18 32 18C42 18 50 22 50 22C50 38 42 50 32 56C22 50 14 38 14 22Z" fill="#291508" stroke="#c2410c" stroke-width="2.2"/>
            <polygon points="32,24 42,32 38,46 32,50 26,46 22,32" fill="#7c2d12" stroke="#ea580c" stroke-width="1.5"/>
            <polygon points="32,30 36,36 32,42 28,36" fill="#fdba74"/>
          </svg>`
      };

      const TACTICAL_BADGE_ICONS = ['🛡️', '🎯', '🔥', '⚡', '👑', '💎'];

      function getParticipantCountryInfo(p) {
        let code = (p && p.country) || 'CO';
        code = String(code).toUpperCase();
        if (COUNTRIES_MAP[code]) return COUNTRIES_MAP[code];
        return { name: 'Internacional', flag: '🌐', flagImg: 'https://flagcdn.com/w160/un.png' };
      }

      function getParticipantAvatarHtml(p, size) {
        if (!size) size = 36;
        const user = sb.getUser();
        let avatarUrl = p ? p.avatar_url : null;
        if (!avatarUrl && user && p && p.user_id === user.id) {
          avatarUrl = user.user_metadata && user.user_metadata.avatar_url;
        }
        if (!avatarUrl) {
          const avImg = document.querySelector('.user-av img');
          if (avImg && avImg.src) {
            const myName = ((user && user.user_metadata && user.user_metadata.full_name) || (user && user.email) || '').toLowerCase();
            const pName = (p && p.user_name ? p.user_name : '').toLowerCase();
            if (pName && myName && (pName === myName || (pName.includes('sara') && myName.includes('sara')))) {
              avatarUrl = avImg.src;
            }
          }
        }
        if (avatarUrl) {
          return `<img src="${avatarUrl}" alt="${p && p.user_name ? p.user_name : 'User'}" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover; display:block;" />`;
        }
        return null;
      }

      const TOURNAMENT_ACHIEVEMENTS = [
        {
          id: 'disciplina',
          icon: '🎖️',
          name: 'Disciplina',
          desc: 'Cumple la regla de 1 operación por día y respeta el límite de drawdown.',
          color: '#38bdf8',
          bg: 'rgba(56, 189, 248, 0.12)',
          border: 'rgba(56, 189, 248, 0.35)'
        },
        {
          id: 'consistencia',
          icon: '🔥',
          name: 'Consistencia',
          desc: 'Mantiene resultados positivos y gestión constante en sus operaciones.',
          color: '#f97316',
          bg: 'rgba(249, 115, 22, 0.12)',
          border: 'rgba(249, 115, 22, 0.35)'
        },
        {
          id: 'semana',
          icon: '🏆',
          name: 'Trader de la Semana',
          desc: 'Participante con el mayor rendimiento porcentual de esta semana.',
          color: '#eab308',
          bg: 'rgba(234, 179, 8, 0.15)',
          border: 'rgba(234, 179, 8, 0.45)'
        },
        {
          id: 'mes',
          icon: '👑',
          name: 'Trader del Mes',
          desc: 'Participante con el mayor rendimiento porcentual de este mes.',
          color: '#c084fc',
          bg: 'rgba(192, 132, 252, 0.15)',
          border: 'rgba(192, 132, 252, 0.45)'
        }
      ];

      function calculateParticipantBadges(p, allParticipants) {
        if (!p) return [];
        const badges = [];
        const isDisqualified = p.status === 'Descalificado' || parseFloat(p.dd_max_pct || 0) >= 5.0;
        if (isDisqualified) return [];

        const pnlAcum = parseFloat(p.return_pct || 0);
        const pnlWeekly = parseFloat(p.pnl_weekly_pct || 0);
        const pnlMonthly = parseFloat(p.pnl_monthly_pct || 0);
        const ddDaily = parseFloat(p.dd_daily_pct || 0);
        const ddMax = parseFloat(p.dd_max_pct || 0);
        const trades = parseInt(p.total_trades || p.trades_count || 0, 10);
        const violations = parseInt(p.violations_count || 0, 10);
        const disciplineScore = parseFloat(p.discipline_score != null ? p.discipline_score : 100);

        // 1. 🎖️ Disciplina: Ha operado al menos 1 trade, DD diario <= 1.1%, CERO faltas y 100% disciplina
        if (trades >= 1 && ddDaily <= 1.1 && ddMax < 5.0 && violations === 0 && disciplineScore >= 100) {
          badges.push(TOURNAMENT_ACHIEVEMENTS[0]);
        }

        // 2. 🔥 Consistencia: Retorno positivo acumulado (> 0%), al menos 2 trades, CERO faltas y activo
        if (pnlAcum > 0 && trades >= 2 && violations === 0 && ddMax < 5.0) {
          badges.push(TOURNAMENT_ACHIEVEMENTS[1]);
        }

        // 3. 🏆 Trader de la Semana: Mayor rendimiento semanal (> 0%), CERO faltas y activo
        if (allParticipants && allParticipants.length > 0 && pnlWeekly > 0 && violations === 0) {
          const maxWeekly = Math.max(...allParticipants.map(x => parseFloat(x.pnl_weekly_pct || 0)));
          if (pnlWeekly === maxWeekly && maxWeekly > 0) {
            badges.push(TOURNAMENT_ACHIEVEMENTS[2]);
          }
        }

        // 4. 👑 Trader del Mes: Mayor rendimiento mensual (> 0%), CERO faltas y activo
        if (allParticipants && allParticipants.length > 0 && pnlMonthly > 0 && violations === 0) {
          const maxMonthly = Math.max(...allParticipants.map(x => parseFloat(x.pnl_monthly_pct || 0)));
          if (pnlMonthly === maxMonthly && maxMonthly > 0) {
            badges.push(TOURNAMENT_ACHIEVEMENTS[3]);
          }
        }

        return badges;
      }

      function renderStarkPedestal(p, rank) {
        const isRank1 = rank === 1;
        const isRank2 = rank === 2;
        const rankClass = isRank1 ? 'rank-1' : (isRank2 ? 'rank-2' : 'rank-3');
        const numClass = isRank1 ? 'num-1' : (isRank2 ? 'num-2' : 'num-3');
        const circleClass = isRank1 ? 'circle-1' : (isRank2 ? 'circle-2' : 'circle-3');
        const baseClass = isRank1 ? 'base-1' : (isRank2 ? 'base-2' : 'base-3');
        
        const tierName = isRank1 ? '1er Lugar • Oro' : (isRank2 ? '2do Lugar • Plata' : '3er Lugar • Bronce');
        const tierClass = isRank1 ? 'oro' : (isRank2 ? 'plata' : 'bronce');
        const tierIco = isRank1 ? '🥇' : (isRank2 ? '🥈' : '🥉');

        if (!p) {
          const fallbackCrest = isRank1 ? CRESTS.oro(60) : (isRank2 ? CRESTS.plata(52) : CRESTS.bronce(52));
          return `
            <div class="stark-pedestal-card ${rankClass}">
              <div class="pedestal-content">
                ${isRank1 ? '<div class="crown-glow">👑</div>' : ''}
                <div class="pedestal-avatar-wrap">
                  <div class="pedestal-avatar-aura aura-${rank}"></div>
                  <div class="pedestal-avatar-circle ${circleClass}">
                    ${fallbackCrest}
                  </div>
                  <div class="pedestal-rank-badge-pill ${numClass}">${rank}</div>
                </div>
                <div class="pedestal-trader-name-${rank}" style="margin-top:8px;">Vacante</div>
                <div class="stark-tier-pill ${tierClass}">${tierIco} ${tierName}</div>
                <div class="stark-pnl-pill pill-${rank}">0.0% Retorno</div>
              </div>
              <div class="pedestal-flag-base ${baseClass}">
                <span class="pedestal-rank-footer-num">${rank}</span>
              </div>
            </div>
          `;
        }

        const country = getParticipantCountryInfo(p);
        const avatarSize = isRank1 ? 72 : 62;
        const customAvatar = getParticipantAvatarHtml(p, avatarSize);
        const crestSvg = isRank1 ? CRESTS.oro(60) : (isRank2 ? CRESTS.plata(52) : CRESTS.bronce(52));
        const avatarOrCrest = customAvatar || crestSvg;

        let retVal = 0;
        if (activeTournamentTimeframe === 'all') retVal = parseFloat(p.return_pct || 0);
        else if (activeTournamentTimeframe === 'week') retVal = parseFloat(p.pnl_weekly_pct || 0);
        else if (activeTournamentTimeframe === 'month') retVal = parseFloat(p.pnl_monthly_pct || 0);

        const retSign = retVal >= 0 ? '+' : '';
        const pnlFormatted = `${retSign}${retVal.toFixed(1)}% Retorno`;

        const badges = calculateParticipantBadges(p, tournamentParticipants);
        const badgesHtml = badges.length > 0 ? `
          <div style="display:flex; align-items:center; justify-content:center; gap:4px; margin-top:6px; flex-wrap:wrap;">
            ${badges.map(b => `<span title="${b.name}: ${b.desc}" style="background:${b.bg}; border:1px solid ${b.border}; color:${b.color}; font-size:9.5px; font-weight:800; padding:2px 7px; border-radius:12px; display:inline-flex; align-items:center; gap:3px; cursor:help;">${b.icon} <span>${b.name}</span></span>`).join('')}
          </div>
        ` : '';

        return `
          <div class="stark-pedestal-card ${rankClass}">
            <div class="pedestal-content">
              ${isRank1 ? '<div class="crown-glow">👑</div>' : ''}
              
              <div class="pedestal-avatar-wrap">
                <div class="pedestal-avatar-aura aura-${rank}"></div>
                <div class="pedestal-avatar-circle ${circleClass}">
                  ${avatarOrCrest}
                </div>
                <div class="pedestal-rank-badge-pill ${numClass}">${rank}</div>
              </div>

              <!-- Nombre con micro-bandera elegante y tipografía metálica con gradiente -->
              <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:8px; max-width:220px;">
                <span class="pedestal-trader-name-${rank}">
                  ${p.user_name || 'Trader'}
                </span>
                <img src="${country.flagImg}" alt="${country.name}" style="width:18px; height:12px; border-radius:2px; object-fit:cover; display:inline-block; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.2);" title="${country.name}" />
              </div>

              <div class="stark-tier-pill ${tierClass}">
                ${tierIco} ${tierName}
              </div>

              ${badgesHtml}

              <div class="stark-pnl-pill pill-${rank}">
                ${pnlFormatted}
              </div>
            </div>

            <!-- BASE DEL PEDESTAL 3D ESCALONADA -->
            <div class="pedestal-flag-base ${baseClass}">
              <span class="pedestal-rank-footer-num">${rank}</span>
            </div>
          </div>
        `;
      }

      function renderStarkRankCard(p, rank, isCurrentUser) {
        const country = getParticipantCountryInfo(p);
        
        const pnlAcum = parseFloat(p.return_pct || 0);
        const pnlDaily = parseFloat(p.pnl_daily_pct || 0);
        const pnlWeekly = parseFloat(p.pnl_weekly_pct || 0);
        const pnlMonthly = parseFloat(p.pnl_monthly_pct || 0);
        const ddDaily = parseFloat(p.dd_daily_pct || 0);
        const tradesCount = parseInt(p.trades_count != null ? p.trades_count : (p.total_trades || 0), 10);

        // Paleta de colores neón por rango
        const COLOR_PALETTE = [
          '#ef4444', // 4 (rojo)
          '#f97316', // 5 (naranja)
          '#3b82f6', // 6 (azul)
          '#2563eb', // 7 (azul profundo)
          '#38bdf8', // 8 (cyan)
          '#eab308', // 9 (amarillo/oro)
          '#38bdf8', // 10 (celeste)
          '#ef4444'  // 11+
        ];
        const isDisqualified = (p.status && p.status.startsWith('Descalificado')) || parseFloat(p.dd_max_pct || 0) >= 5.0;
        const borderCol = isDisqualified ? '#ef4444' : (COLOR_PALETTE[(rank - 4) % COLOR_PALETTE.length] || '#3b82f6');
        const isOro = !isDisqualified && rank <= 5;
        const tierName = isDisqualified ? 'Descalificado' : (isOro ? 'Oro' : 'Plata');
        const tierCol = isDisqualified ? '#ef4444' : (isOro ? '#eab308' : '#94a3b8');

        const customAvatar = getParticipantAvatarHtml(p, 32);
        const crestSvg = isOro ? CRESTS.oro(32) : CRESTS.plata(32);
        const avatarOrCrest = customAvatar || crestSvg;

        const acumSign = pnlAcum >= 0 ? '+' : '';
        const acumFormatted = `${acumSign}${pnlAcum.toFixed(1)}%`;
        const acumCol = pnlAcum >= 0 ? '#4ade80' : '#f87171';

        const dSign = pnlDaily >= 0 ? '+' : '';
        const sSign = pnlWeekly >= 0 ? '+' : '';
        const mSign = pnlMonthly >= 0 ? '+' : '';

        const badges = calculateParticipantBadges(p, tournamentParticipants);
        const badgesHtml = badges.length > 0 ? `
          <div style="display:inline-flex; align-items:center; gap:4px; margin-left:4px; flex-wrap:wrap;">
            ${badges.map(b => `<span title="${b.name}: ${b.desc}" style="background:${b.bg}; border:1px solid ${b.border}; color:${b.color}; font-size:9px; font-weight:800; padding:1.5px 6px; border-radius:8px; display:inline-flex; align-items:center; gap:2.5px; cursor:help;">${b.icon} <span class="hide-mobile">${b.name}</span></span>`).join('')}
          </div>
        ` : '';

        return `
          <div class="stark-rank-card ${isCurrentUser ? 'my-card' : ''}" style="border-color:${borderCol}; box-shadow: 0 0 16px ${borderCol}18;">
            <div style="display:flex; align-items:center; gap:12px; z-index:2; flex:1; min-width:0;">
              <!-- Posición -->
              <div style="width:26px; text-align:center; font-size:15px; font-weight:900; font-family:var(--mono); color:${borderCol}; flex-shrink:0;">
                #${rank}
              </div>

              <!-- Crest / Avatar con aro de color -->
              <div class="stark-card-crest-wrap" style="border-color:${borderCol};">
                ${avatarOrCrest}
              </div>

              <!-- Nombre y Nivel / Tier -->
              <div style="min-width:130px; overflow:hidden;">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <span style="font-size:13.5px; font-weight:800; color:#ffffff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${p.user_name || 'Participante'}
                  </span>
                  <img src="${country.flagImg}" alt="${country.name}" style="width:16px; height:11px; border-radius:2px; object-fit:cover; display:inline-block; flex-shrink:0;" title="${country.name}" />
                  ${isCurrentUser ? '<span class="badge-status completed" style="font-size:9px; padding:1px 5px; margin-left:2px;">TÚ</span>' : ''}
                  ${badgesHtml}
                </div>
                <div style="display:flex; align-items:center; gap:6px; font-size:10.5px; color:#64748b; margin-top:2px;">
                  <span style="color:${tierCol}; font-weight:700;">${tierName}</span>
                </div>
              </div>

              <!-- Métricas de Trading: D, S, M, DD Diario, Trades -->
              <div class="hide-mobile" style="display:flex; align-items:center; gap:16px; margin-left:auto; margin-right:20px; font-size:11px; font-family:var(--mono);">
                <!-- D (Diario) -->
                <div style="display:flex; flex-direction:column; align-items:center;">
                  <span style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase;">D</span>
                  <span style="color:${pnlDaily >= 0 ? '#4ade80' : '#f87171'}; font-weight:800;">${dSign}${pnlDaily.toFixed(1)}%</span>
                </div>

                <!-- S (Semanal) -->
                <div style="display:flex; flex-direction:column; align-items:center;">
                  <span style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase;">S</span>
                  <span style="color:${pnlWeekly >= 0 ? '#4ade80' : '#f87171'}; font-weight:800;">${sSign}${pnlWeekly.toFixed(1)}%</span>
                </div>

                <!-- M (Mensual) -->
                <div style="display:flex; flex-direction:column; align-items:center;">
                  <span style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase;">M</span>
                  <span style="color:${pnlMonthly >= 0 ? '#4ade80' : '#f87171'}; font-weight:800;">${mSign}${pnlMonthly.toFixed(1)}%</span>
                </div>

                <!-- Drawdown Diario -->
                <div style="display:flex; flex-direction:column; align-items:center;">
                  <span style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase;">DD Diario</span>
                  <span style="color:${ddDaily > 1.1 ? '#f87171' : '#cbd5e1'}; font-weight:800;">${ddDaily.toFixed(1)}%</span>
                </div>

                <!-- Trades -->
                <div style="display:flex; flex-direction:column; align-items:center;">
                  <span style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase;">Trades</span>
                  <span style="color:#94a3b8; font-weight:800;">${tradesCount}</span>
                </div>
              </div>
            </div>

            <!-- Acumulado a la derecha -->
            <div style="text-align:right; z-index:2; flex-shrink:0; min-width:85px;">
              <div style="font-size:9.5px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Acumulado</div>
              <div style="font-size:15px; font-weight:900; font-family:var(--mono); color:${acumCol};">
                ${acumFormatted}
              </div>
            </div>
          </div>
        `;
      }

      function renderTournamentViews() {
        const user = sb.getUser();
        const top3Container = document.getElementById('tournament-top3-container');
        const cardsContainer = document.getElementById('tournament-cards-container');

        // Ordenar participantes: ACTIVOS primero (por PnL), DESCALIFICADOS al fondo (nunca en el podio)
        const sortedList = [...tournamentParticipants].sort((a, b) => {
          const disqA = (a.status && a.status.startsWith('Descalificado')) || parseFloat(a.dd_max_pct || 0) >= 5.0;
          const disqB = (b.status && b.status.startsWith('Descalificado')) || parseFloat(b.dd_max_pct || 0) >= 5.0;
          if (disqA && !disqB) return 1;
          if (!disqA && disqB) return -1;
          let valA = 0, valB = 0;
          if (activeTournamentTimeframe === 'all') {
            valA = parseFloat(a.return_pct || 0);
            valB = parseFloat(b.return_pct || 0);
          } else if (activeTournamentTimeframe === 'week') {
            valA = parseFloat(a.pnl_weekly_pct || 0);
            valB = parseFloat(b.pnl_weekly_pct || 0);
          } else if (activeTournamentTimeframe === 'month') {
            valA = parseFloat(a.pnl_monthly_pct || 0);
            valB = parseFloat(b.pnl_monthly_pct || 0);
          }
          return valB - valA;
        });

        // 1. Renderizar Podio TOP 3 (3 pedestales: 2do a la izq, 1ro al centro, 3ro a la der)
        if (top3Container) {
          const p1 = sortedList[0] || null;
          const p2 = sortedList[1] || null;
          const p3 = sortedList[2] || null;

          top3Container.innerHTML = `
            ${renderStarkPedestal(p2, 2)}
            ${renderStarkPedestal(p1, 1)}
            ${renderStarkPedestal(p3, 3)}
          `;
        }

        // 2. Renderizar Tarjetas de Clasificación (#4 en adelante como en StarkLab)
        if (cardsContainer) {
          if (sortedList.length === 0) {
            cardsContainer.innerHTML = `
              <div style="text-align:center; padding:30px 15px; color:#64748b; font-size:12.5px;">
                <div style="font-size:28px; margin-bottom:8px;">🏆</div>
                Aún no hay participantes inscritos en este torneo.<br>
                ¡Sé el primero en conectar tu cuenta MT5 y liderar el podio!
              </div>
            `;
          } else if (sortedList.length > 3) {
            // Mostrar desde el #4 en adelante
            cardsContainer.innerHTML = sortedList.slice(3).map((p, idx) => {
              const isMe = user && p.user_id === user.id;
              return renderStarkRankCard(p, idx + 4, isMe);
            }).join('');
          } else {
            // Si hay 3 o menos participantes, mostrar todos en la lista también
            cardsContainer.innerHTML = sortedList.map((p, idx) => {
              const isMe = user && p.user_id === user.id;
              return renderStarkRankCard(p, idx + 1, isMe);
            }).join('');
          }
        }
      }

      window.setTournamentTimeframe = function(tf) {
        activeTournamentTimeframe = tf;
        ['all', 'week', 'month'].forEach(t => {
          const tab = document.getElementById('stark-tab-' + t);
          if (tab) {
            if (t === tf) tab.classList.add('active');
            else tab.classList.remove('active');
          }
        });
        const tfLabel = document.getElementById('stark-timeframe-label');
        if (tfLabel) {
          if (tf === 'all') tfLabel.textContent = 'Según todo tiempo';
          else if (tf === 'week') tfLabel.textContent = 'Según esta semana';
          else if (tf === 'month') tfLabel.textContent = 'Según este mes';
        }
        renderTournamentViews();
      };

      async function loadTournamentData() {
        const user = sb.getUser();

        try {
          // 1. Cargar torneo activo
          const tournamentsData = await sb.query('tournaments', { select: '*', order: 'created_at.desc' });
          if (Array.isArray(tournamentsData) && tournamentsData.length > 0) {
            activeTournament = tournamentsData[0];
          } else {
            activeTournament = {
              id: 'default-active-id',
              name: '🏆 TORNEO GOLD FX',
              start_date: new Date().toISOString(),
              end_date: new Date(Date.now() + 60*24*60*60*1000).toISOString()
            };
          }

          const nameEl = document.getElementById('tournament-name');
          if (nameEl) nameEl.textContent = '🏆 TORNEO GOLD FX';
          const startStr = new Date(activeTournament.start_date).toLocaleDateString('es-CO');
          const endStr = new Date(activeTournament.end_date).toLocaleDateString('es-CO');
          const datesEl = document.getElementById('tournament-dates');
          if (datesEl) datesEl.textContent = `Periodo: ${startStr} — ${endStr}`;

          // 2. Cargar participantes
          if (activeTournament.id && activeTournament.id !== 'default-active-id') {
            const participantsData = await sb.query('tournament_participants', {
              select: '*',
              filter: `tournament_id=eq.${activeTournament.id}`,
              order: 'return_pct.desc'
            });
            tournamentParticipants = Array.isArray(participantsData) ? participantsData : [];

            // Sincronizar fotos/avatares reales de la tabla profiles
            try {
              const profilesData = await sb.query('profiles', { select: 'id, avatar_url, country' });
              if (Array.isArray(profilesData)) {
                const profileMap = {};
                profilesData.forEach(pr => { if (pr.id) profileMap[pr.id] = pr; });
                tournamentParticipants.forEach(p => {
                  if (profileMap[p.user_id]) {
                    if (!p.avatar_url && profileMap[p.user_id].avatar_url) {
                      p.avatar_url = profileMap[p.user_id].avatar_url;
                    }
                    if (!p.country && profileMap[p.user_id].country) {
                      p.country = profileMap[p.user_id].country;
                    }
                  }
                });
              }
            } catch (errAv) {
              console.log('Profile sync check:', errAv);
            }
          } else {
            tournamentParticipants = [];
          }

          // Actualizar contador de participantes
          const pCountEl = document.getElementById('tournament-participants-count');
          if (pCountEl) pCountEl.textContent = `${tournamentParticipants.length} participante${tournamentParticipants.length === 1 ? '' : 's'}`;

          // 3. Verificar si el usuario actual ya está inscrito
          const btnContainer = document.getElementById('tournament-join-btn-container');
          const userDashboard = document.getElementById('tournament-user-dashboard');
          const isJoined = user && tournamentParticipants.some(p => p.user_id === user.id);

          if (isJoined) {
            const myPartIndex = tournamentParticipants.findIndex(p => p.user_id === user.id);
            const myPart = tournamentParticipants[myPartIndex];

            // Sincronizar foto/avatar del usuario en la tabla pública
            let currentAvatar = (user.user_metadata && user.user_metadata.avatar_url) || '';
            if (!currentAvatar) {
              const avImg = document.querySelector('.user-av img');
              if (avImg && avImg.src) currentAvatar = avImg.src;
            }
            if (myPart && currentAvatar && myPart.avatar_url !== currentAvatar) {
              myPart.avatar_url = currentAvatar;
              sb.update('tournament_participants', myPart.id, { avatar_url: currentAvatar }).catch(e => console.log('Avatar auto-sync err:', e));
            }

            btnContainer.innerHTML = `
              <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.3); padding:7px 14px; border-radius:18px; color:var(--green); font-size:11.5px; font-weight:700;">
                <span>✅ Conectado (#${myPart ? myPart.mt5_login : '—'})</span>
              </div>
            `;

            // Renderizar Dashboard Privado del Participante
            if (userDashboard && myPart) {
              userDashboard.style.display = 'block';

              const isDisqualified = myPart.status === 'Descalificado' || parseFloat(myPart.dd_max_pct || 0) >= 5.0;
              const badgeEl = document.getElementById('user-status-badge');
              if (badgeEl) {
                badgeEl.innerHTML = isDisqualified
                  ? `<span class="badge-status rejected" style="font-size:10px; padding:3px 8px;">🛑 DESCALIFICADO</span>`
                  : `<span class="badge-status completed" style="font-size:10px; padding:3px 8px;">🟢 ACTIVO</span>`;
              }

              const acctEl = document.getElementById('u-account-label');
              const countryInfo = getParticipantCountryInfo(myPart);
              if (acctEl) {
                acctEl.textContent = `${countryInfo.flag} ${countryInfo.name} | Cuenta MT5: #${myPart.mt5_login} (${myPart.mt5_server || 'MT5'})`;
              }

              const pnlDaily = parseFloat(myPart.pnl_daily_pct || 0);
              const pnlWeekly = parseFloat(myPart.pnl_weekly_pct || 0);
              const pnlMonthly = parseFloat(myPart.pnl_monthly_pct || 0);
              const pnlAcum = parseFloat(myPart.return_pct || 0);

              const ddDaily = parseFloat(myPart.dd_daily_pct || 0);
              const ddMax = parseFloat(myPart.dd_max_pct || 0);
              const ddMargin = Math.max(0, 5.0 - ddMax);

              // 1. Rendimiento
              const setPnl = (id, val) => {
                const el = document.getElementById(id);
                if (el) {
                  el.textContent = (val >= 0 ? '+' : '') + val.toFixed(2) + '%';
                  el.style.color = val >= 0 ? 'var(--green)' : 'var(--red)';
                }
              };
              setPnl('u-pnl-daily', pnlDaily);
              setPnl('u-pnl-weekly', pnlWeekly);
              setPnl('u-pnl-monthly', pnlMonthly);
              setPnl('u-pnl-acum', pnlAcum);

              // 2. Riesgo
              const elDdDaily = document.getElementById('u-dd-daily');
              if (elDdDaily) {
                elDdDaily.textContent = ddDaily.toFixed(2) + '%';
                elDdDaily.style.color = ddDaily > 1.1 ? 'var(--red)' : 'var(--text-primary)';
              }

              const elDdMax = document.getElementById('u-dd-max');
              if (elDdMax) {
                elDdMax.textContent = ddMax.toFixed(2) + '%';
              }

              const elMargin = document.getElementById('u-dd-margin');
              if (elMargin) {
                elMargin.textContent = ddMargin.toFixed(2) + '% restante';
                elMargin.style.color = ddMargin < 1.0 ? 'var(--red)' : (ddMargin < 2.5 ? 'var(--yellow)' : 'var(--green)');
              }

              // 3. Operativa
              const elTrades = document.getElementById('u-trades-count');
              if (elTrades) elTrades.textContent = myPart.trades_count || 0;

              const elWins = document.getElementById('u-w-count');
              if (elWins) elWins.textContent = myPart.win_count || 0;

              const elLosses = document.getElementById('u-l-count');
              if (elLosses) elLosses.textContent = myPart.loss_count || 0;

              const elBE = document.getElementById('u-be-count');
              if (elBE) elBE.textContent = myPart.be_count || 0;

              const elWinRate = document.getElementById('u-win-rate');
              if (elWinRate) {
                elWinRate.textContent = parseFloat(myPart.win_rate || 0).toFixed(1) + '%';
              }

              const elViolations = document.getElementById('u-violations-count');
              const violations = parseInt(myPart.violations_count || 0, 10);
              if (elViolations) {
                elViolations.textContent = violations === 0 ? '0 (Ninguna)' : `${violations} falta${violations === 1 ? '' : 's'}`;
                elViolations.style.color = violations === 0 ? 'var(--green)' : (violations === 1 ? 'var(--yellow)' : 'var(--red)');
              }

              const elDiscipline = document.getElementById('u-discipline-score');
              const discScore = parseFloat(myPart.discipline_score != null ? myPart.discipline_score : 100);
              if (elDiscipline) {
                elDiscipline.textContent = discScore.toFixed(0) + '%';
                elDiscipline.style.color = discScore >= 100 ? 'var(--green)' : (discScore >= 70 ? 'var(--yellow)' : 'var(--red)');
              }

              // 4. Posición
              const elRankBadge = document.getElementById('u-rank-pos-badge');
              if (elRankBadge) {
                elRankBadge.textContent = `POSICIÓN: #${myPartIndex + 1} DE ${tournamentParticipants.length}`;
              }

              // 5. Insignias & Reconocimientos del usuario
              const badgesGridEl = document.getElementById('u-badges-grid');
              if (badgesGridEl) {
                const myEarnedBadges = calculateParticipantBadges(myPart, tournamentParticipants);
                const earnedIds = new Set(myEarnedBadges.map(b => b.id));

                badgesGridEl.innerHTML = TOURNAMENT_ACHIEVEMENTS.map(ach => {
                  const isUnlocked = earnedIds.has(ach.id);
                  return `
                    <div style="background:${isUnlocked ? ach.bg : 'rgba(255,255,255,0.02)'}; border:1px solid ${isUnlocked ? ach.border : 'rgba(255,255,255,0.06)'}; border-radius:10px; padding:10px 12px; display:flex; align-items:flex-start; gap:10px; opacity:${isUnlocked ? '1' : '0.45'}; transition:all 0.2s ease;">
                      <div style="font-size:22px; line-height:1; filter:${isUnlocked ? 'none' : 'grayscale(1)'}; flex-shrink:0;">
                        ${ach.icon}
                      </div>
                      <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; margin-bottom:3px;">
                          <span style="font-size:11.5px; font-weight:800; color:${isUnlocked ? ach.color : '#94a3b8'};">
                            ${ach.name}
                          </span>
                          <span style="font-size:8.5px; font-weight:700; padding:1px 5px; border-radius:6px; background:${isUnlocked ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)'}; color:${isUnlocked ? '#4ade80' : '#64748b'}; text-transform:uppercase;">
                            ${isUnlocked ? 'OBTENIDA' : 'BLOQUEADA'}
                          </span>
                        </div>
                        <div style="font-size:10px; color:#94a3b8; line-height:1.3;">
                          ${ach.desc}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('');
              }
            }
          } else {
            if (userDashboard) userDashboard.style.display = 'none';
            btnContainer.innerHTML = `
              <span style="background:rgba(234,179,8,0.12); border:1px solid rgba(234,179,8,0.35); color:#facc15; font-size:11.5px; font-weight:800; padding:6px 14px; border-radius:18px; display:inline-flex; align-items:center; gap:6px;">
                🔒 Inscripciones MT5 Cerradas
              </span>
            `;
          }

          // 4. Renderizar vistas principales (Podio 3 pedestales + Tarjetas de ranking)
          renderTournamentViews();

        } catch (e) {
          console.error('Error al cargar datos del torneo:', e);
          const cardsContainer = document.getElementById('tournament-cards-container');
          if (cardsContainer) {
            cardsContainer.innerHTML = `
              <div style="text-align: center; color: var(--red); padding: 20px; font-size:12.5px;">
                Error al conectar con la base de datos del torneo: ${e.message}
              </div>
            `;
          }
        }
      }

      function openTournamentJoinModal() {
        toast('El torneo ha finalizado oficialmente. Las inscripciones de cuentas MT5 están deshabilitadas hasta el próximo torneo.', 'warning');
      }

      async function submitTournamentJoin(event) {
        if (event && event.preventDefault) event.preventDefault();
        toast('El torneo ha finalizado. No se permiten nuevas inscripciones.', 'warning');
        closeModal('tournament-join-modal');
        return;

        const serverEl = document.getElementById('tjm-server');
        const server = (serverEl && serverEl.value.trim()) || 'WeTrade-MT5';
        const login = document.getElementById('tjm-login').value.trim();
        const country = document.getElementById('tjm-country').value || 'CO';
        const password = document.getElementById('tjm-password').value.trim();

        if (!server || !login || !password) {
          alert('Por favor completa todos los campos.');
          return;
        }

        const submitBtn = document.getElementById('tjm-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Conectando...';

        try {
          const userName = (user.user_metadata && user.user_metadata.full_name) || user.email;
          const userAvatar = (user.user_metadata && user.user_metadata.avatar_url) || '';
          const participantData = {
            tournament_id: activeTournament ? activeTournament.id : 'default-active-id',
            user_id: user.id,
            user_name: userName,
            user_email: user.email,
            avatar_url: userAvatar,
            country: country,
            mt5_server: server,
            mt5_login: parseInt(login, 10),
            mt5_password: password,
            initial_balance: 0.00,
            current_balance: 0.00,
            net_pnl: 0.00,
            return_pct: 0.00,
            discipline_score: 100.00,
            win_rate: 0.00,
            current_score: 100.00,
            trades_count: 0,
            badges: ['🛡️', '🎯', '🔥']
          };

          try {
            await sb.insert('tournament_participants', participantData);
          } catch (insertErr) {
            // Si falta la columna country en la base de datos, reintentar sin ella
            if (insertErr.message && insertErr.message.includes('country')) {
              delete participantData.country;
              await sb.insert('tournament_participants', participantData);
            } else {
              throw insertErr;
            }
          }
          try {
            await sb.update('profiles', user.id, { country: country });
          } catch (pe) {}
          alert('¡Genial! Tu cuenta de MT5 ha sido conectada exitosamente al torneo. El servidor central comenzará a sincronizar tus operaciones.');
          closeModal('tournament-join-modal');
          document.getElementById('tournament-join-form').reset();
          await loadTournamentData();
        } catch (e) {
          alert('Error al inscribir la cuenta en el torneo: ' + e.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Conectar e Inscribirme';
        }
      }

      function renderLiveTournamentChart(participants) {
        const canvas = document.getElementById('tournament-live-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        if (rect.width === 0 || rect.height === 0) return;

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        ctx.clearRect(0, 0, width, height);

        // Generar curva elegante basada en el líder
        const top1 = participants && participants[0] ? parseFloat(participants[0].return_pct || 0) : 42.1;
        const totalReturnEl = document.getElementById('live-chart-total-return');
        if (totalReturnEl) {
          totalReturnEl.textContent = (top1 >= 0 ? '+' : '') + top1.toFixed(1) + '%';
        }

        // Puntos suavizados para la curva estilo maqueta
        const points = [
          { x: 0, y: height * 0.8 },
          { x: width * 0.2, y: height * 0.55 },
          { x: width * 0.4, y: height * 0.65 },
          { x: width * 0.65, y: height * 0.3 },
          { x: width * 0.85, y: height * 0.4 },
          { x: width, y: height * 0.15 }
        ];

        // Relleno de degradado dorado
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(255, 205, 27, 0.45)');
        gradient.addColorStop(1, 'rgba(255, 205, 27, 0.0)');

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 0; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();

        // Línea dorada suave de borde
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.strokeStyle = '#ffcd1b';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(255, 205, 27, 0.6)';
        ctx.shadowBlur = 10;
        ctx.stroke();
      }

      // Exponer globalmente funciones de multi-foto y galería lightbox
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

      window.openLightboxGallery = openLightboxGallery;
      window.openLightboxFromSrc = openLightboxFromSrc;
      window.openLightboxFromImg = openLightboxFromImg;
      window.setLightboxIndex = setLightboxIndex;
      window.nextLightboxImage = nextLightboxImage;
      window.prevLightboxImage = prevLightboxImage;
      window.closeLightbox = closeLightbox;
      window.closeLightboxOnBg = closeLightboxOnBg;

      window.setPanelPhotoIndex = setPanelPhotoIndex;
      window.setDetailModalPhotoIndex = setDetailModalPhotoIndex;

      async function manualRefreshTournament() {
        const spinEl = document.getElementById('refresh-spinner');
        const btnEl = document.getElementById('btn-refresh-tournament');
        if (spinEl) spinEl.style.transform = 'rotate(360deg)';
        if (btnEl) btnEl.style.opacity = '0.6';

        try {
          await loadTournamentData();
        } catch (err) {
          console.error('Error refreshing tournament:', err);
        } finally {
          setTimeout(() => {
            if (spinEl) spinEl.style.transform = 'none';
            if (btnEl) btnEl.style.opacity = '1';
          }, 500);
        }
      }

      // Exponer globalmente
      window.loadTournamentData = loadTournamentData;
      window.manualRefreshTournament = manualRefreshTournament;
      window.openTournamentJoinModal = openTournamentJoinModal;
      window.submitTournamentJoin = submitTournamentJoin;

      window.switchAuthTab = switchAuthTab;
      window.doLogin = doLogin;
      window.doRegister = doRegister;
      window.doSendRecovery = doSendRecovery;
      window.doResetPassword = doResetPassword;
      window.checkRecoveryFlow = checkRecoveryFlow;

      window.openCalendarExportModal = openCalendarExportModal;
      window.downloadCalendarExportImage = downloadCalendarExportImage;
      window.copyCalendarExportImage = copyCalendarExportImage;

      window.openDepositModal = openDepositModal;
      window.updateDepositModalLabels = updateDepositModalLabels;
      window.submitDeposit = submitDeposit;
      window.openEditAccount = openEditAccount;
      window.openDeleteAccount = openDeleteAccount;

      window.openProfileModal = openProfileModal;
      window.saveUserProfile = saveUserProfile;
      window.handleAvatarChange = handleAvatarChange;

      // Exponer navegación y filtros
      window.setTlMode = setTlMode;
      window.changeTlMonth = changeTlMonth;
      window.goTlToday = goTlToday;
      window.setStMode = setStMode;
      window.changeStMonth = changeStMonth;
      window.goStToday = goStToday;
      window.setAnMode = setAnMode;
      window.changeAnMonth = changeAnMonth;
      window.goAnToday = goAnToday;
      window.openJumpPicker = openJumpPicker;
