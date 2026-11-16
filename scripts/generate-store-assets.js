import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const assetsDir = path.join(rootDir, 'play-store-assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log('🎨 Generating Google Play Store Listing Assets in /play-store-assets...');

// 1. Copy App Icon (512x512)
const publicIcon = path.join(rootDir, 'public', 'pwa-512x512.png');
const destIcon = path.join(assetsDir, '1_App_Icon_512x512.png');
if (fs.existsSync(publicIcon)) {
  fs.copyFileSync(publicIcon, destIcon);
  console.log('✅ Copied App Icon: play-store-assets/1_App_Icon_512x512.png');
}

// 2. Generate Feature Graphic SVG (1024x500)
const featureGraphicSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="50%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#312E81"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#818CF8"/>
      <stop offset="100%" stop-color="#C084FC"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="500" fill="url(#bg)"/>

  <!-- Subtle Grid Pattern -->
  <g opacity="0.05">
    <path d="M0 50h1024M0 100h1024M0 150h1024M0 200h1024M0 250h1024M0 300h1024M0 350h1024M0 400h1024M0 450h1024" stroke="#FFFFFF" stroke-width="1"/>
    <path d="M100 0v500M200 0v500M300 0v500M400 0v500M500 0v500M600 0v500M700 0v500M800 0v500M900 0v500" stroke="#FFFFFF" stroke-width="1"/>
  </g>

  <!-- Left Side Text Branding -->
  <g transform="translate(80, 160)">
    <!-- Badge -->
    <rect width="160" height="32" rx="16" fill="url(#accent)" opacity="0.2"/>
    <text x="80" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#A5B4FC" text-anchor="middle" letter-spacing="1.5">POWERED BY AI</text>

    <!-- Title -->
    <text x="0" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF">SlideCraft AI</text>

    <!-- Tagline -->
    <text x="0" y="125" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="500" fill="#CBD5E1">Instant AI Presentation &amp; Slide Generator</text>

    <text x="0" y="165" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" fill="#94A3B8">Create professional pitch decks &amp; slides in seconds</text>
  </g>

  <!-- Right Side Floating Cards (Preview UI graphic) -->
  <g transform="translate(560, 60)" filter="url(#shadow)">
    <!-- Main Card -->
    <rect width="400" height="260" rx="16" fill="#1E293B" stroke="#334155" stroke-width="2"/>
    <rect width="400" height="40" rx="16" fill="#0F172A"/>
    <!-- Window buttons -->
    <circle cx="24" cy="20" r="5" fill="#EF4444"/>
    <circle cx="40" cy="20" r="5" fill="#F59E0B"/>
    <circle cx="56" cy="20" r="5" fill="#10B981"/>

    <!-- Slide Header inside card -->
    <rect x="30" y="70" width="220" height="18" rx="4" fill="url(#accent)"/>
    <rect x="30" y="100" width="340" height="10" rx="3" fill="#475569"/>
    <rect x="30" y="118" width="280" height="10" rx="3" fill="#334155"/>

    <!-- Grid Preview -->
    <rect x="30" y="148" width="105" height="75" rx="8" fill="url(#cardGrad)"/>
    <rect x="148" y="148" width="105" height="75" rx="8" fill="#334155"/>
    <rect x="265" y="148" width="105" height="75" rx="8" fill="#334155"/>
  </g>

  <!-- Secondary Floating Card -->
  <g transform="translate(520, 220)" filter="url(#shadow)">
    <rect width="360" height="220" rx="16" fill="#4F46E5" stroke="#6366F1" stroke-width="2"/>
    <text x="30" y="50" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#FFFFFF">✨ AI Topic to Slides</text>
    <rect x="30" y="70" width="300" height="10" rx="3" fill="#A5B4FC"/>
    <rect x="30" y="90" width="220" height="10" rx="3" fill="#818CF8"/>

    <rect x="30" y="130" width="140" height="44" rx="10" fill="#FFFFFF"/>
    <text x="100" y="157" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#4F46E5" text-anchor="middle">Export PPTX</text>
  </g>
</svg>`;

fs.writeFileSync(path.join(assetsDir, '2_Feature_Graphic_1024x500.svg'), featureGraphicSvg);
console.log('✅ Generated Feature Graphic: play-store-assets/2_Feature_Graphic_1024x500.svg');

// 3. Create Screenshot instructions & HTML helper page to capture screenshots easily
const screenshotHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SlideCraft AI - Play Store Asset Generator</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0F172A; color: white; padding: 40px; }
    h1 { color: #818CF8; }
    .card { background: #1E293B; border: 1px solid #334155; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    code { background: #0F172A; padding: 4px 8px; border-radius: 6px; color: #38BDF8; font-family: monospace; }
    ol { line-height: 1.8; }
    .badge { background: #10B981; color: black; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>📱 SlideCraft AI - Play Store Asset Kit</h1>

  <div class="card">
    <h2>1. App Icon (512 x 512 px) <span class="badge">READY</span></h2>
    <p>File path: <code>play-store-assets/1_App_Icon_512x512.png</code></p>
  </div>

  <div class="card">
    <h2>2. Feature Graphic (1024 x 500 px) <span class="badge">READY</span></h2>
    <p>File path: <code>play-store-assets/2_Feature_Graphic_1024x500.svg</code></p>
  </div>

  <div class="card">
    <h2>3. Phone Screenshots (Min 2 required)</h2>
    <p>To capture 1080x2400 high-res screenshots from Chrome in 30 seconds:</p>
    <ol>
      <li>Open your SlideCraft AI app in Chrome (e.g. <code>http://localhost:5173</code>).</li>
      <li>Press <code>F12</code> to open Developer Tools.</li>
      <li>Click <b>Toggle Device Toolbar</b> (<code>Ctrl + Shift + M</code>).</li>
      <li>Set Dimensions to <b>1080 x 2400</b> (or select <i>Pixel 7</i>).</li>
      <li>Press <code>Ctrl + Shift + P</code> in DevTools, type <b>"Capture full size screenshot"</b>, and press Enter!</li>
      <li>Take screenshots of:
        <ul>
          <li><b>Home / Landing Screen</b></li>
          <li><b>Generator Workspace</b> (AI topic input)</li>
          <li><b>Slide Editor &amp; Preview</b></li>
          <li><b>Export / Admin Dashboard</b></li>
        </ul>
      </li>
    </ol>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(assetsDir, 'instructions.html'), screenshotHtml);
console.log('✅ Generated Helper Guide: play-store-assets/instructions.html');
console.log('========================================');
console.log('🎉 All Play Store graphics templates ready in /play-store-assets');
