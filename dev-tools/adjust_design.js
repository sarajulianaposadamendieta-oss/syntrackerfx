const fs = require('fs');

const htmlPath = 'c:/Users/SraJu/Desktop/sfx-journal-v3 (1).html';

try {
  let html = fs.readFileSync(htmlPath, 'utf8');

  // 1. Repair Logo: Replace Base64 logo sources with the local/relative 'logo.png' path
  const regexBase64 = /src="data:image\/png;base64,[^"]*"/g;
  html = html.replace(regexBase64, 'src="logo.png"');

  // 2. User Profile: Rename default "Sara" to "Sarah Posada" in HTML sidebar footer
  html = html.replace(
    '<div class="user-name">Sara</div>',
    '<div class="user-name">Sarah Posada</div>'
  );

  // User Profile: Also override "Sara Juliana" to "Sarah Posada" dynamically in JS
  const oldInitAppSnippet = `      const name = (user.user_metadata && user.user_metadata.full_name) || user.email;
      const av = document.querySelector('.user-av'), nm = document.querySelector('.user-name'), em = document.querySelector('.user-email');
      if (av) av.textContent = name[0].toUpperCase();
      if (nm) nm.textContent = name;`;

  const newInitAppSnippet = `      let name = (user.user_metadata && user.user_metadata.full_name) || user.email;
      if (name.toLowerCase().includes('sara') || name.toLowerCase().includes('juliana')) {
        name = 'Sarah Posada';
      }
      const av = document.querySelector('.user-av'), nm = document.querySelector('.user-name'), em = document.querySelector('.user-email');
      if (av) av.textContent = name[0].toUpperCase();
      if (nm) nm.textContent = name;`;

  html = html.replace(oldInitAppSnippet, newInitAppSnippet);

  // 3. Navigation Accents (Use Bronce #a67726 for active tabs instead of gold/green)
  // Sidebar active nav item style
  const oldNavActiveStyle = `    .nav-item.active {
      background: rgba(34, 197, 94, 0.08);
      color: var(--green);
      font-weight: 500;
    }`;

  const newNavActiveStyle = `    .nav-item.active {
      background: rgba(166, 119, 38, 0.1);
      color: var(--green-dim); /* Bronce / Dorado Oscuro (#a67726) */
      font-weight: 600;
    }`;

  html = html.replace(oldNavActiveStyle, newNavActiveStyle);

  // Active filter buttons in dashboard (use bronze #a67726 for active toggle buttons)
  const oldTogActiveStyle = `    .tog-btn.active {
      background: var(--purple);
      color: #fff;
      font-weight: 600;
    }`;

  const newTogActiveStyle = `    .tog-btn.active {
      background: var(--green-dim); /* Bronce / Dorado Oscuro (#a67726) */
      color: #ffffff;
      font-weight: 600;
    }`;

  html = html.replace(oldTogActiveStyle, newTogActiveStyle);

  // 4. Remove Green Generic from Dashboard Header Card
  const oldHeaderCardStyle = `    .dashboard-header-card {
      background: linear-gradient(135deg, #09120b, #030704);
      border: 1px solid rgba(34, 197, 94, 0.15);
      border-radius: 16px;
      padding: 24px 32px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }`;

  const newHeaderCardStyle = `    .dashboard-header-card {
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

  html = html.replace(oldHeaderCardStyle, newHeaderCardStyle);

  // 5. Equity Curve Gradient: Diffuse exclusively to pure black (#000000)
  html = html.replace(
    `            var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
            grad.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
            grad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');`,
    `            var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
            grad.addColorStop(0, 'rgba(255, 205, 27, 0.2)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');`
  );

  // 6. Profitable Heatmap cells: Replace green rgb/rgba with gold rgb/rgba
  html = html.replace(
    `var bg = cell.pnl >= 0 ? 'rgba(34,197,94,' + intensity + ')' : 'rgba(239,68,68,' + intensity + ')';`,
    `var bg = cell.pnl >= 0 ? 'rgba(255,205,27,' + intensity + ')' : 'rgba(239,68,68,' + intensity + ')';`
  );

  // 7. General positive values and charts: Rebrand remaining rgba green values (rgba(34,197,94...)) to gold (rgba(255,205,27...))
  html = html.replace(
    'border-color: rgba(34,197,94,0.4);',
    'border-color: rgba(255,205,27,0.4);'
  );
  html = html.replace(
    'background: rgba(34,197,94,0.1);',
    'background: rgba(255,205,27,0.1);'
  );
  html = html.replace(
    '.tr-selected { background: rgba(34,197,94,0.05) !important; outline: 1px solid rgba(34,197,94,0.2); }',
    '.tr-selected { background: rgba(255,205,27,0.05) !important; outline: 1px solid rgba(255,205,27,0.2); }'
  );
  html = html.replace(
    `'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'`,
    `'rgba(255,205,27,0.12)' : 'rgba(239,68,68,0.12)'`
  );
  html = html.replace(
    `'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'`,
    `'rgba(255,205,27,0.3)' : 'rgba(239,68,68,0.3)'`
  );
  html = html.replace(
    `var pnlBg = isWin ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';`,
    `var pnlBg = isWin ? 'rgba(255,205,27,0.12)' : 'rgba(239,68,68,0.12)';`
  );
  html = html.replace(
    `var pnlBorder = isWin ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';`,
    `var pnlBorder = isWin ? 'rgba(255,205,27,0.3)' : 'rgba(239,68,68,0.3)';`
  );
  html = html.replace(
    `style="background:rgba(34,197,94,0.1);color:var(--green);`,
    `style="background:rgba(255,205,27,0.1);color:var(--green);`
  );
  html = html.replace(
    `ctx.fillStyle = v >= 0 ? 'rgba(34,197,94,.85)' : 'rgba(239,68,68,.85)';`,
    `ctx.fillStyle = v >= 0 ? 'rgba(255,205,27,.85)' : 'rgba(239,68,68,.85)';`
  );

  // Save changes
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Design adjustments applied successfully!');

} catch (err) {
  console.error('Error applying design adjustments:', err);
  process.exit(1);
}
