const fs = require('fs');

const htmlPath = 'c:/Users/SraJu/Desktop/sfx-journal-v3 (1).html';

try {
  let html = fs.readFileSync(htmlPath, 'utf8');

  // 1. Update :root colors (gray text-secondary #a1a1aa, white green #ffffff, border-bronze #a67726)
  const oldRoot = `:root {
      --bg-primary: #000000;          /* Negro Puro */
      --bg-secondary: #0a0a0a;        /* Fondo muy oscuro para sidebar */
      --bg-card: #121212;             /* Gris muy oscuro para las tarjetas (alto contraste) */
      --bg-card-inner: #181818;       /* Fondo interno de tarjetas */
      --bg-hover: #1e1810;            /* Hover con tinte bronce/dorado */
      --bg-active: #2a2012;           /* Activo con tinte bronce/dorado */
      --border: #2c200c;              /* Bronce muy oscuro */
      --border-light: #4c3614;        /* Bronce medio */
      --text-primary: #ffffff;        /* Blanco puro */
      --text-secondary: #ffcd1b;      /* Amarillo Oro */
      --text-muted: #a67726;          /* Bronce/Dorado Oscuro */
      --green: #ffcd1b;               /* Acento Primario (Amarillo Oro) para positivos */
      --green-dim: #a67726;           /* Acento Secundario (Bronce/Dorado) */
      --red: #ef4444;                 /* Negativas se mantienen rojas */
      --yellow: #ffcd1b;              /* Amarillo Oro */
      --orange: #a67726;              /* Bronce/Dorado Oscuro */
      --purple: #ffcd1b;              /* Mapeo del morado al Amarillo Oro */
      --purple-dim: #a67726;
      --purple-glow: rgba(255, 205, 27, 0.35);
      --purple-soft: rgba(255, 205, 27, 0.12);
      --purple-border: rgba(166, 119, 38, 0.3);
      --mono: 'JetBrains Mono', monospace;
      --sans: 'Sora', sans-serif;
    }`;

  const newRoot = `:root {
      --bg-primary: #000000;          /* Negro Puro */
      --bg-secondary: #0a0a0a;        /* Fondo muy oscuro para sidebar */
      --bg-card: #121212;             /* Gris muy oscuro para las tarjetas */
      --bg-card-inner: #181818;       /* Fondo interno de tarjetas */
      --bg-hover: #1c1c1e;            /* Hover gris oscuro */
      --bg-active: #27272a;           /* Activo gris oscuro */
      --border: #1c1c1e;              /* Borde discreto gris */
      --border-light: #27272a;        /* Borde un poco más claro */
      --border-bronze: #a67726;       /* Bronce para bordes sutiles (1px) de tarjetas o separadores */
      --text-primary: #ffffff;        /* Blanco puro */
      --text-secondary: #a1a1aa;      /* Gris Claro/Plata (#a1a1aa) para textos secundarios y labels */
      --text-muted: #71717a;          /* Gris silenciado */
      --green: #ffffff;               /* Acento positivo de dinero ahora es blanco puro (#ffffff) */
      --green-dim: #a1a1aa;           /* Plata */
      --red: #ef4444;                 /* Negativas se mantienen rojas */
      --yellow: #ffcd1b;              /* Amarillo Oro */
      --orange: #ffcd1b;              /* Acento dorado */
      --purple: #ffcd1b;              /* Mapeo del morado */
      --purple-dim: #ffcd1b;
      --purple-glow: rgba(255, 205, 27, 0.35);
      --purple-soft: rgba(255, 205, 27, 0.12);
      --purple-border: rgba(166, 119, 38, 0.3);
      --mono: 'JetBrains Mono', monospace;
      --sans: 'Sora', sans-serif;
    }`;
  html = html.replace(oldRoot, newRoot);

  // 2. Navigation & active state CSS overrides
  // Sidebar active nav item style (change to #18181b background and #ffcd1b text/border)
  const oldSidebarActive = `    .nav-item.active {
      background: rgba(166, 119, 38, 0.1);
      color: var(--green-dim); /* Bronce / Dorado Oscuro (#a67726) */
      font-weight: 600;
    }`;

  const newSidebarActive = `    .nav-item.active {
      background: #18181b;
      color: var(--yellow); /* Dorado (#ffcd1b) */
      font-weight: 600;
      border-left: 3px solid var(--yellow);
      border-radius: 0 7px 7px 0;
      margin-left: 0;
    }`;
  html = html.replace(oldSidebarActive, newSidebarActive);

  // Active filter buttons (change to #18181b background and #ffcd1b text/border)
  const oldFilterActive = `    .tog-btn.active {
      background: var(--green-dim); /* Bronce / Dorado Oscuro (#a67726) */
      color: #ffffff;
      font-weight: 600;
    }`;

  const newFilterActive = `    .tog-btn.active {
      background: #18181b;
      color: var(--yellow); /* Dorado (#ffcd1b) */
      font-weight: 600;
      border: 1px solid var(--yellow);
    }`;
  html = html.replace(oldFilterActive, newFilterActive);

  // Purple-active tog button
  html = html.replace(
    `    .tog-btn.purple-active.active {
      background: #ffcd1b !important;
      color: #000000 !important;
      border-color: #ffcd1b !important;
    }`,
    `    .tog-btn.purple-active.active {
      background: #18181b !important;
      color: var(--yellow) !important;
      border-color: var(--yellow) !important;
    }`
  );

  // Global account active toggle button
  html = html.replace(
    `    .toggle-group .tog-btn.active[data-acct="global"] {
      background: #ffcd1b;
      color: #000000;
      border-color: #ffcd1b;
    }`,
    `    .toggle-group .tog-btn.active[data-acct="global"] {
      background: #18181b;
      color: var(--yellow);
      border-color: var(--yellow);
    }`
  );

  // Active equity curve tab
  html = html.replace(
    `    .eq-tab.active {
       background: #ffcd1b !important;
       color: #000000 !important;
       border-color: #ffcd1b !important;
    }`,
    `    .eq-tab.active {
       background: #18181b !important;
       color: var(--yellow) !important;
       border-color: var(--yellow) !important;
    }`
  );

  // 3. Card Borders (Set to 1px fine bronze #a67726 border)
  // Dashboard Header Card
  const oldHeaderCard = `    .dashboard-header-card {
      background: linear-gradient(135deg, #100d08, #050402); /* Bronce/dorado muy oscuro */
      border: 1px solid rgba(166, 119, 38, 0.15); /* Bronce/dorado oscuro */
      border-radius: 16px;
      padding: 24px 32px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }`;

  const newHeaderCard = `    .dashboard-header-card {
      background: #0a0a0a;
      border: 1px solid var(--border-bronze); /* Bronce sutil 1px (#a67726) */
      border-radius: 16px;
      padding: 24px 32px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }`;
  html = html.replace(oldHeaderCard, newHeaderCard);

  // Stat Pill
  const oldStatPill = `    .stat-pill {
      background: #0d0c12;
      border: 1px solid #1e1d24;
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.2s;
    }`;

  const newStatPill = `    .stat-pill {
      background: #0c0c0c;
      border: 1px solid var(--border-bronze); /* Bronce sutil 1px (#a67726) */
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.2s;
    }`;
  html = html.replace(oldStatPill, newStatPill);

  // Stats Card
  const oldStatsCard = `    .stats-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px 22px;
    }`;

  const newStatsCard = `    .stats-card {
      background: var(--bg-card);
      border: 1px solid var(--border-bronze); /* Bronce sutil 1px (#a67726) */
      border-radius: 12px;
      padding: 20px 22px;
    }`;
  html = html.replace(oldStatsCard, newStatsCard);

  // 4. Fix Equity Badge (No more green, use dark bg with gold text)
  const oldBadgeLogic = `         var netPnl = runBal - init;
         var badge = document.getElementById('eq-net-badge');
         if (badge) {
            badge.textContent = (netPnl >= 0 ? '+' : '') + '$' + netPnl.toFixed(2);
            badge.style.color = netPnl >= 0 ? 'var(--green)' : 'var(--red)';
            badge.style.background = netPnl >= 0 ? '#112a1f' : '#2a1111';
         }`;

  const newBadgeLogic = `         var netPnl = runBal - init;
         var badge = document.getElementById('eq-net-badge');
         if (badge) {
            badge.textContent = (netPnl >= 0 ? '+' : '') + '$' + netPnl.toFixed(2);
            badge.style.color = netPnl >= 0 ? '#ffcd1b' : 'var(--red)';
            badge.style.background = netPnl >= 0 ? '#18181b' : '#2a1111';
            badge.style.border = netPnl >= 0 ? '1px solid #ffcd1b' : '1px solid var(--red)';
         }`;
  html = html.replace(oldBadgeLogic, newBadgeLogic);

  // 5. Save changes
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Contrast and UI updates completed successfully!');

} catch (err) {
  console.error('Error applying contrast updates:', err);
  process.exit(1);
}
