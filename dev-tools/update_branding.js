const fs = require('fs');

const htmlPath = 'c:/Users/SraJu/Desktop/sfx-journal-v3 (1).html';

try {
  let html = fs.readFileSync(htmlPath, 'utf8');

  // 1. Sort Equity Curve chronological order (ascending: oldest to newest)
  html = html.replace(
    'var sortedTlist = [...tlist].reverse();',
    `var sortedTlist = [...tlist].sort(function(a, b) {
          return new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00');
        });`
  );

  // 2. Title Tag Update
  html = html.replace(
    '<title>ESTEBAN GOLDFX - Dominio Journal</title>',
    '<title>Syntracker Fx - GoldFX Journal</title>'
  );

  // 3. Login Screen Logo Wrap Update: title to "Syntracker Fx", credit "BY: ESTEBAN GOLDFX", and remove slogan
  const oldLoginLogoBlock = `        <div class="auth-logo-wrap" style="text-align:center; margin-bottom:25px;">
          <img src="logo.png" alt="ESTEBAN GOLDFX Logo" style="width:160px; height:auto; margin-bottom:15px; filter: drop-shadow(0 0 15px rgba(255,205,27,0.2));">
          <div style="font-size:26px; font-weight:900; color:#fff; line-height:1.2; letter-spacing:1px; text-transform:uppercase;">TRADING JOURNAL<br>DOMINIO</div>
          <div style="font-size:12px; font-weight:800; color:var(--text-secondary); letter-spacing:3px; margin-top:10px; text-transform:uppercase;">BY: ESTEBAN GOLDFX</div>
          <div style="font-size:11px; color:var(--text-muted); font-weight:700; letter-spacing:2px; margin-top:15px; text-transform:uppercase;">"EL ORO NO BRILLA POR SÍ SOLO"</div>
        </div>`;

  const newLoginLogoBlock = `        <div class="auth-logo-wrap" style="text-align:center; margin-bottom:25px;">
          <img src="logo.png" alt="ESTEBAN GOLDFX Logo" style="width:160px; height:auto; margin-bottom:15px; filter: drop-shadow(0 0 15px rgba(255,205,27,0.2));">
          <div style="font-size:32px; font-weight:900; color:#fff; line-height:1.2; letter-spacing:1px; text-transform:uppercase; font-family:var(--sans);">Syntracker Fx</div>
          <div style="font-size:12px; font-weight:800; color:var(--text-secondary); letter-spacing:3px; margin-top:10px; text-transform:uppercase;">BY: ESTEBAN GOLDFX</div>
        </div>`;

  html = html.replace(oldLoginLogoBlock, newLoginLogoBlock);

  // 4. Sidebar Logo Block Update: main to "Syntracker Fx", sub to "GoldFX"
  const oldSidebarLogo = `    <div class="sidebar-logo" style="padding: 10px 14px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="logo.png" alt="Logo" style="width:38px;height:38px;object-fit:contain;filter: drop-shadow(0 0 8px rgba(255,205,27,0.15));">
        <div>
          <div style="font-size:12px;font-weight:800;color:var(--text-primary);letter-spacing:0.5px;">ESTEBAN GOLDFX</div>
          <div style="font-size:8.5px;color:var(--text-muted);font-weight:700;letter-spacing:1px;">DOMINIO JOURNAL</div>
        </div>
      </div>
    </div>`;

  const newSidebarLogo = `    <div class="sidebar-logo" style="padding: 10px 14px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="logo.png" alt="Logo" style="width:38px;height:38px;object-fit:contain;filter: drop-shadow(0 0 8px rgba(255,205,27,0.15));">
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--text-primary);letter-spacing:0.5px;font-family:var(--sans);">Syntracker Fx</div>
          <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:1px;">GoldFX</div>
        </div>
      </div>
    </div>`;

  html = html.replace(oldSidebarLogo, newSidebarLogo);

  // Save changes
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Branding and chart sorting updates completed successfully!');

} catch (err) {
  console.error('Error applying branding updates:', err);
  process.exit(1);
}
