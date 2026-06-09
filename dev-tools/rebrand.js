const fs = require('fs');
const path = require('path');

const base64Path = path.join(__dirname, 'logo_base64.txt');
const htmlPath = 'c:/Users/SraJu/Desktop/sfx-journal-v3 (1).html';

try {
  // 1. Read Base64 Logo
  let base64Data = fs.readFileSync(base64Path, 'utf8').trim();
  // Remove potential BOM or wrapping quotes
  base64Data = base64Data.replace(/^\uFEFF/, '').replace(/[\r\n]/g, '');

  // 2. Read HTML File
  let html = fs.readFileSync(htmlPath, 'utf8');

  // 3. Replacements

  // A. Replace Title
  html = html.replace(
    '<title>SarahFX Dominio - Trading Journal</title>',
    '<title>ESTEBAN GOLDFX - Dominio Journal</title>'
  );

  // B. Replace CSS variables in :root
  const oldRoot = `:root {
      --bg-primary: #09080f;
      --bg-secondary: #0e0c18;
      --bg-card: #13111e;
      --bg-card-inner: #17152a;
      --bg-hover: #1c1930;
      --bg-active: #1a1535;
      --border: #221f38;
      --border-light: #2e2950;
      --text-primary: #ece8ff;
      --text-secondary: #7b72a8;
      --text-muted: #4a4270;
      --green: #22c55e;
      --green-dim: #16a34a;
      --red: #ef4444;
      --yellow: #eab308;
      --orange: #f97316;
      --purple: #a855f7;
      --purple-dim: #9333ea;
      --purple-glow: rgba(168,85,247,0.35);
      --purple-soft: rgba(168,85,247,0.12);
      --purple-border: rgba(168,85,247,0.3);
      --mono: 'JetBrains Mono', monospace;
      --sans: 'Sora', sans-serif;
    }`;

  const newRoot = `:root {
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
  html = html.replace(oldRoot, newRoot);

  // C. Replace User Avatar Gradient
  html = html.replace(
    'background: linear-gradient(135deg, #7c3aed, #4f46e5);',
    'background: linear-gradient(135deg, #ffcd1b, #a67726); color: #000; font-weight: 700;'
  );

  // D. Replace Button and Toggle Active colors in CSS
  html = html.replace(
    `    .btn-purple {
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
    }
    .btn-purple:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(124, 58, 237, 0.4);
      filter: brightness(1.1);
    }`,
    `    .btn-purple {
      background: linear-gradient(135deg, #ffcd1b, #a67726);
      color: #000000;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(255, 205, 27, 0.25);
    }
    .btn-purple:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(255, 205, 27, 0.35);
      filter: brightness(1.1);
    }`
  );

  html = html.replace(
    `    .tog-btn.purple-active.active {
      background: #7c3aed !important;
      color: #fff !important;
      border-color: #7c3aed !important;
    }
    
    /* Fix active tab purple */
    .toggle-group .tog-btn.active[data-acct="global"] {
      background: #7c3aed;
      color: #fff;
      border-color: #7c3aed;
    }

    .eq-tab.active {
       background: #7c3aed !important;
       color: #fff !important;
       border-color: #7c3aed !important;
    }`,
    `    .tog-btn.purple-active.active {
      background: #ffcd1b !important;
      color: #000000 !important;
      border-color: #ffcd1b !important;
    }
    
    /* Fix active tab purple */
    .toggle-group .tog-btn.active[data-acct="global"] {
      background: #ffcd1b;
      color: #000000;
      border-color: #ffcd1b;
    }

    .eq-tab.active {
       background: #ffcd1b !important;
       color: #000000 !important;
       border-color: #ffcd1b !important;
    }`
  );

  // E. Replace hardcoded login screen gradients and SVGs
  html = html.replace(
    `      background: radial-gradient(circle at 20% 20%, rgba(34, 197, 94, 0.05) 0%, transparent 40%),
                  radial-gradient(circle at 80% 80%, rgba(109, 40, 217, 0.05) 0%, transparent 40%),
                  #0d0c12;`,
    `      background: radial-gradient(circle at 20% 20%, rgba(255, 205, 27, 0.04) 0%, transparent 40%),
                  radial-gradient(circle at 80% 80%, rgba(166, 119, 38, 0.04) 0%, transparent 40%),
                  #000000;`
  );

  // Login background chart SVG (replaced green line with gold line)
  html = html.replace(
    `background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1000' height='400' viewBox='0 0 1000 400' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2322c55e' stop-opacity='0.08'/%3E%3Cstop offset='100%25' stop-color='%2322c55e' stop-opacity='0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0,300 Q150,100 300,250 T600,100 T1000,200 L1000,400 L0,400 Z' fill='url(%23g)'/%3E%3Cpath d='M0,300 Q150,100 300,250 T600,100 T1000,200' fill='none' stroke='%2322c55e' stroke-width='1.2' stroke-linecap='round' opacity='0.4'/%3E%3C/svg%3E");`,
    `background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1000' height='400' viewBox='0 0 1000 400' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23ffcd1b' stop-opacity='0.08'/%3E%3Cstop offset='100%25' stop-color='%23ffcd1b' stop-opacity='0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0,300 Q150,100 300,250 T600,100 T1000,200 L1000,400 L0,400 Z' fill='url(%23g)'/%3E%3Cpath d='M0,300 Q150,100 300,250 T600,100 T1000,200' fill='none' stroke='%23ffcd1b' stroke-width='1.2' stroke-linecap='round' opacity='0.4'/%3E%3C/svg%3E");`
  );

  // F. Replace Auth Box styles (purple shadows and borders to gold/bronze)
  html = html.replace(
    `    .auth-box {
      width: 400px;
      background: rgba(13, 12, 18, 0.7);
      backdrop-filter: blur(25px);
      border: 1px solid rgba(168, 85, 247, 0.5);
      border-radius: 28px;
      padding: 40px;
      position: relative;
      box-shadow: 0 0 40px rgba(168, 85, 247, 0.2), 
                  inset 0 0 20px rgba(168, 85, 247, 0.05),
                  0 25px 50px -12px rgba(0,0,0,0.8);
      z-index: 10;
    }`,
    `    .auth-box {
      width: 400px;
      background: rgba(10, 10, 10, 0.8);
      backdrop-filter: blur(25px);
      border: 1px solid rgba(166, 119, 38, 0.4);
      border-radius: 28px;
      padding: 40px;
      position: relative;
      box-shadow: 0 0 40px rgba(166, 119, 38, 0.15), 
                  inset 0 0 20px rgba(166, 119, 38, 0.05),
                  0 25px 50px -12px rgba(0,0,0,0.9);
      z-index: 10;
    }`
  );

  // G. Active Auth Tab, fields input, submit button colors
  html = html.replace(
    `    .auth-tab.active {
      background: #6d28d9;
      color: #fff;
      box-shadow: 0 4px 12px rgba(109, 40, 217, 0.3);
    }`,
    `    .auth-tab.active {
      background: #ffcd1b;
      color: #000000;
      box-shadow: 0 4px 12px rgba(255, 205, 27, 0.25);
    }`
  );

  html = html.replace(
    '      color: #6d28d9;',
    '      color: var(--text-secondary);'
  );

  html = html.replace(
    `    .auth-input:focus {
      border-color: #6d28d9 !important;
      background: rgba(109, 40, 217, 0.05) !important;
      box-shadow: 0 0 15px rgba(109, 40, 217, 0.1);
    }`,
    `    .auth-input:focus {
      border-color: #ffcd1b !important;
      background: rgba(255, 205, 27, 0.05) !important;
      box-shadow: 0 0 15px rgba(255, 205, 27, 0.1);
    }`
  );

  html = html.replace(
    'color: #9333ea;',
    'color: #ffcd1b;'
  );

  html = html.replace(
    `    .auth-btn-submit {
      width: 100%;
      background: linear-gradient(135deg, #7c3aed, #6d28d9) !important;
      color: #fff !important;
      border: none;
      border-radius: 14px;
      padding: 16px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.3s;
      box-shadow: 0 8px 24px rgba(109, 40, 217, 0.4);
    }

    .auth-btn-submit:hover {
      transform: translateY(-2px);
      filter: brightness(1.1);
      box-shadow: 0 12px 32px rgba(109, 40, 217, 0.5);
    }`,
    `    .auth-btn-submit {
      width: 100%;
      background: linear-gradient(135deg, #ffcd1b, #a67726) !important;
      color: #000000 !important;
      border: none;
      border-radius: 14px;
      padding: 16px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.3s;
      box-shadow: 0 8px 24px rgba(255, 205, 27, 0.3);
    }

    .auth-btn-submit:hover {
      transform: translateY(-2px);
      filter: brightness(1.1);
      box-shadow: 0 12px 32px rgba(255, 205, 27, 0.4);
    }`
  );

  // Hardcoded colors on landing page tags
  html = html.replace(
    'background: rgba(34,197,94,0.1);',
    'background: rgba(255,205,27,0.08);'
  );
  html = html.replace(
    'border: 1px solid rgba(34,197,94,0.2);',
    'border: 1px solid rgba(255,205,27,0.15);'
  );

  // H. Replace Landing page details
  // Replace "BY: SARAHFX" and logo markup in Login Panel
  const oldLoginLogoBlock = `        <div class="auth-logo-wrap" style="text-align:center; margin-bottom:30px;">
          <div class="auth-logo-icon" style="color:var(--green); margin-bottom:15px; filter: drop-shadow(0 0 10px rgba(34,197,94,0.3));">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          </div>
          <div style="font-size:32px; font-weight:900; color:#fff; line-height:1; letter-spacing:1px; text-transform:uppercase;">TRADING JOURNAL<br>DOMINIO</div>
          <div style="font-size:14px; font-weight:800; color:var(--green); letter-spacing:3px; margin-top:15px; text-transform:uppercase;">BY: SARAHFX</div>
          <div style="font-size:11px; color:rgba(255,255,255,0.4); letter-spacing:2px; margin-top:20px; text-transform:uppercase;">AQUÍ EMPIEZA TU RENTABILIDAD</div>
        </div>`;

  const newLoginLogoBlock = `        <div class="auth-logo-wrap" style="text-align:center; margin-bottom:25px;">
          <img src="data:image/png;base64,${base64Data}" alt="ESTEBAN GOLDFX Logo" style="width:160px; height:auto; margin-bottom:15px; filter: drop-shadow(0 0 15px rgba(255,205,27,0.2));">
          <div style="font-size:26px; font-weight:900; color:#fff; line-height:1.2; letter-spacing:1px; text-transform:uppercase;">TRADING JOURNAL<br>DOMINIO</div>
          <div style="font-size:12px; font-weight:800; color:var(--text-secondary); letter-spacing:3px; margin-top:10px; text-transform:uppercase;">BY: ESTEBAN GOLDFX</div>
          <div style="font-size:11px; color:var(--text-muted); font-weight:700; letter-spacing:2px; margin-top:15px; text-transform:uppercase;">"EL ORO NO BRILLA POR SÍ SOLO"</div>
        </div>`;

  html = html.replace(oldLoginLogoBlock, newLoginLogoBlock);

  // I. Replace Sidebar Logo
  const oldSidebarLogo = `    <div class="sidebar-logo">
      <img src="https://i.imgur.com/placeholder.png" alt="" style="display:none">
      <div style="display:flex;align-items:center;gap:10px;">
        <div
          style="width:32px;height:32px;background:var(--green);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#000;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);">SarahFX</div>
          <div style="font-size:10px;color:var(--text-muted);">DOMINIO JOURNAL</div>
        </div>
      </div>
    </div>`;

  const newSidebarLogo = `    <div class="sidebar-logo" style="padding: 10px 14px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="data:image/png;base64,${base64Data}" alt="Logo" style="width:38px;height:38px;object-fit:contain;filter: drop-shadow(0 0 8px rgba(255,205,27,0.15));">
        <div>
          <div style="font-size:12px;font-weight:800;color:var(--text-primary);letter-spacing:0.5px;">ESTEBAN GOLDFX</div>
          <div style="font-size:8.5px;color:var(--text-muted);font-weight:700;letter-spacing:1px;">DOMINIO JOURNAL</div>
        </div>
      </div>
    </div>`;

  html = html.replace(oldSidebarLogo, newSidebarLogo);

  // J. Inject Slogan into Dashboard (Empty State & Normal State)
  html = html.replace(
    `        if (!trades.length) {
          page.innerHTML = '<div class="empty-state"><div class="empty-icon">📬</div><div class="empty-title">Sin trades todavía</div><div class="empty-sub">Añade tu primer trade para ver las estadísticas</div></div>';
          return;
        }`,
    `        if (!trades.length) {
          page.innerHTML = 
            '<div style="text-align: center; margin-bottom: 20px; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: 10px;">"EL ORO NO BRILLA POR SÍ SOLO"</div>' +
            '<div class="empty-state"><div class="empty-icon">📬</div><div class="empty-title">Sin trades todavía</div><div class="empty-sub">Añade tu primer trade para ver las estadísticas</div></div>';
          return;
        }`
  );

  html = html.replace(
    `        page.innerHTML =
          '<div class="dashboard-header-card">' +`,
    `        page.innerHTML =
          '<div style="text-align: center; margin-bottom: 20px; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: 10px;">"EL ORO NO BRILLA POR SÍ SOLO"</div>' +
          '<div class="dashboard-header-card">' +`
  );

  // K. Replace Hardcoded colors in Equity Curve canvas rendering
  html = html.replace(
    `        ctx.shadowColor = '#22c55e';
        ctx.strokeStyle = '#22c55e';`,
    `        ctx.shadowColor = '#ffcd1b';
        ctx.strokeStyle = '#ffcd1b';`
  );
  
  html = html.replace(
    `        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;`,
    `        ctx.strokeStyle = '#ffcd1b';
        ctx.lineWidth = 2.5;`
  );

  // L. Adjust calendar win colors in styles and week text
  html = html.replace(
    `    .cal-pnl.win {
      color: #22c55e;
    }`,
    `    .cal-pnl.win {
      color: #ffcd1b;
    }`
  );

  html = html.replace(
    `    .cal-bar.win {
      background: linear-gradient(90deg, #16a34a, #22c55e);
    }`,
    `    .cal-bar.win {
      background: linear-gradient(90deg, #a67726, #ffcd1b);
    }`
  );

  html = html.replace(
    `    .week-val.win {
      color: #22c55e;
    }`,
    `    .week-val.win {
      color: #ffcd1b;
    }`
  );

  // M. Adjust plan status Si colors in trade table view
  html = html.replace(
    `      planEl.style.color = t.plan === 'Si' ? '#22c55e' : (t.plan === 'No' ? '#ef4444' : 'var(--text-muted)');`,
    `      planEl.style.color = t.plan === 'Si' ? '#ffcd1b' : (t.plan === 'No' ? '#ef4444' : 'var(--text-muted)');`
  );

  html = html.replace(
    `      var pnlColor = isWin ? '#22c55e' : '#ef4444';`,
    `      var pnlColor = isWin ? '#ffcd1b' : '#ef4444';`
  );

  html = html.replace(
    `      var planColor = t.plan === 'Si' ? '#22c55e' : (t.plan === 'No' ? '#ef4444' : 'var(--text-muted)');`,
    `      var planColor = t.plan === 'Si' ? '#ffcd1b' : (t.plan === 'No' ? '#ef4444' : 'var(--text-muted)');`
  );

  // 4. Save file
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Rebranding applied successfully to desktop file!');

} catch (err) {
  console.error('Error during rebranding:', err);
  process.exit(1);
}
