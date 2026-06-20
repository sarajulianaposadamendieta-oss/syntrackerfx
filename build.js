const fs = require('fs');
const path = require('path');
let JavaScriptObfuscator;
try {
  JavaScriptObfuscator = require('javascript-obfuscator');
} catch (e) {
  console.error("Error: 'javascript-obfuscator' is not installed yet. Please run npm install first.");
  process.exit(1);
}

const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');

// Obfuscation configuration (High protection, balanced performance)
const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  numbersToExpressions: true,
  simplify: true,
  stringArray: true,
  stringArrayThreshold: 0.75,
  splitStrings: true,
  splitStringsChunkLength: 8,
  unicodeEscapeSequence: false
};

function cleanAndCreateDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${path.basename(src)} -> ${path.basename(dest)}`);
  } else {
    console.warn(`Warning: Source file ${src} does not exist!`);
  }
}

async function run() {
  console.log('--- Starting Build & Obfuscation Process ---');

  // 1. Clean and setup dist directory
  cleanAndCreateDir(DIST_DIR);

  // 2. Copy static assets
  copyFile(path.join(SRC_DIR, 'logo.png'), path.join(DIST_DIR, 'logo.png'));
  copyFile(path.join(SRC_DIR, 'gold_bull.png'), path.join(DIST_DIR, 'gold_bull.png'));

  // 3. Process index.html (production web)
  // Copy index.html to dist/
  copyFile(path.join(SRC_DIR, 'index.html'), path.join(DIST_DIR, 'index.html'));

  // 4. Obfuscate app.js
  console.log('Obfuscating app.js...');
  const appJsSrcPath = path.join(SRC_DIR, 'app.js');
  if (fs.existsSync(appJsSrcPath)) {
    let appJsContent = fs.readFileSync(appJsSrcPath, 'utf8');

    // Replace Supabase credentials with environment variables if available
    const supabaseUrl = process.env.SUPABASE_URL || 'https://xtynjkstprkkbontplow.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_aoQyXV5JAq7Pvkh4cTIxow_df9AyT_D';

    appJsContent = appJsContent.replace('https://xtynjkstprkkbontplow.supabase.co', supabaseUrl);
    appJsContent = appJsContent.replace('sb_publishable_aoQyXV5JAq7Pvkh4cTIxow_df9AyT_D', supabaseKey);

    const obfuscatedResult = JavaScriptObfuscator.obfuscate(appJsContent, obfuscationOptions);
    fs.writeFileSync(path.join(DIST_DIR, 'app.js'), obfuscatedResult.getObfuscatedCode(), 'utf8');
    console.log('Successfully obfuscated app.js!');
  } else {
    console.error('Error: src/app.js not found!');
    process.exit(1);
  }

  // 5. Process syntracker-fx.html (desktop single-file version)
  console.log('Processing syntracker-fx.html (desktop version)...');
  const desktopSrcPath = path.join(SRC_DIR, 'syntracker-fx.html');
  if (fs.existsSync(desktopSrcPath)) {
    const desktopContent = fs.readFileSync(desktopSrcPath, 'utf8');
    const startMarker = '  <script>';
    const endMarker = '  </script>';

    const startIndex = desktopContent.indexOf(startMarker);
    const endIndex = desktopContent.indexOf(endMarker, startIndex);

    if (startIndex !== -1 && endIndex !== -1) {
      let inlineJs = desktopContent.substring(startIndex + startMarker.length, endIndex);
      console.log('Obfuscating inline JS for desktop version...');

      // Replace Supabase credentials with environment variables if available
      const supabaseUrl = process.env.SUPABASE_URL || 'https://xtynjkstprkkbontplow.supabase.co';
      const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_aoQyXV5JAq7Pvkh4cTIxow_df9AyT_D';

      inlineJs = inlineJs.replace('https://xtynjkstprkkbontplow.supabase.co', supabaseUrl);
      inlineJs = inlineJs.replace('sb_publishable_aoQyXV5JAq7Pvkh4cTIxow_df9AyT_D', supabaseKey);

      const obfuscatedInlineJs = JavaScriptObfuscator.obfuscate(inlineJs, obfuscationOptions);
      
      const newDesktopContent = desktopContent.substring(0, startIndex) + 
        '  <script>\n' + obfuscatedInlineJs.getObfuscatedCode() + '\n  </script>' + 
        desktopContent.substring(endIndex + endMarker.length);
      
      // Save in dist/
      fs.writeFileSync(path.join(DIST_DIR, 'syntracker-fx.html'), newDesktopContent, 'utf8');
      // Save in root for double-click convenience
      fs.writeFileSync(path.join(__dirname, 'syntracker-fx.html'), newDesktopContent, 'utf8');
      console.log('Successfully processed syntracker-fx.html!');
    } else {
      console.warn('Warning: Could not find script tags in src/syntracker-fx.html!');
    }
  } else {
    console.warn('Warning: src/syntracker-fx.html not found!');
  }

  console.log('--- Build Completed Successfully! ---');
}

run().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
