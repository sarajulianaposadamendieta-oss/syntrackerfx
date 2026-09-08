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
  let obfuscatedResult;
  if (fs.existsSync(appJsSrcPath)) {
    let appJsContent = fs.readFileSync(appJsSrcPath, 'utf8');

    // Replace Supabase credentials with environment variables if available
    const supabaseUrl = process.env.SUPABASE_URL || 'https://xtynjkstprkkbontplow.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_aoQyXV5JAq7Pvkh4cTIxow_df9AyT_D';

    appJsContent = appJsContent.replace('https://xtynjkstprkkbontplow.supabase.co', supabaseUrl);
    appJsContent = appJsContent.replace('sb_publishable_aoQyXV5JAq7Pvkh4cTIxow_df9AyT_D', supabaseKey);

    obfuscatedResult = JavaScriptObfuscator.obfuscate(appJsContent, obfuscationOptions);
    fs.writeFileSync(path.join(DIST_DIR, 'app.js'), obfuscatedResult.getObfuscatedCode(), 'utf8');
    console.log('Successfully obfuscated app.js!');
  } else {
    console.error('Error: src/app.js not found!');
    process.exit(1);
  }

  // 5. Process syntracker-fx.html (desktop single-file version)
  console.log('Processing syntracker-fx.html (desktop version)...');
  const indexHtmlContent = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf8');
  const rawAppJs = fs.readFileSync(path.join(SRC_DIR, 'app.js'), 'utf8');
  
  const newDesktopContent = indexHtmlContent.replace(
    '<script src="app.js"></script>',
    '  <script>\n' + obfuscatedResult.getObfuscatedCode() + '\n  </script>'
  );

  // Sync raw single-file to src/syntracker-fx.html for dev reference
  fs.writeFileSync(
    path.join(SRC_DIR, 'syntracker-fx.html'),
    indexHtmlContent.replace('<script src="app.js"></script>', '  <script>\n' + rawAppJs + '\n  </script>'),
    'utf8'
  );

  // Save obfuscated version in dist/ and root
  fs.writeFileSync(path.join(DIST_DIR, 'syntracker-fx.html'), newDesktopContent, 'utf8');
  fs.writeFileSync(path.join(__dirname, 'syntracker-fx.html'), newDesktopContent, 'utf8');
  console.log('Successfully processed syntracker-fx.html!');

  console.log('--- Build Completed Successfully! ---');
}

run().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
