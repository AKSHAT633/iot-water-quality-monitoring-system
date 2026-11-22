const fs = require('fs');
const path = require('path');

const url = process.env.BACKEND_URL || 
            process.env.API_URL || 
            process.env.NEXT_PUBLIC_BACKEND_URL || 
            'https://iot-water-quality-monitoring-system.onrender.com';

const cleanUrl = url.trim().replace(/\/+$/, '');
const content = `window.__ENV = { BACKEND_URL: "${cleanUrl}" };\n`;

// 1. Write to current directory
fs.writeFileSync('env.js', content, 'utf8');

// 2. Also populate public/ directory so Vercel finds files regardless of output settings
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}
fs.writeFileSync(path.join('public', 'env.js'), content, 'utf8');
if (fs.existsSync('index.html')) {
  fs.copyFileSync('index.html', path.join('public', 'index.html'));
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

if (fs.existsSync('css')) copyDir('css', path.join('public', 'css'));
if (fs.existsSync('js')) copyDir('js', path.join('public', 'js'));

console.log('✓ Injected Vercel Environment Variable and prepared public/ directory for:', cleanUrl);
