const fs = require('fs');
const url = process.env.BACKEND_URL || 
            process.env.API_URL || 
            process.env.NEXT_PUBLIC_BACKEND_URL || 
            'https://iot-water-quality-monitoring-system.onrender.com';

const cleanUrl = url.trim().replace(/\/+$/, '');
const content = `window.__ENV = { BACKEND_URL: "${cleanUrl}" };\n`;

fs.writeFileSync('env.js', content, 'utf8');
console.log('✓ Injected Vercel Environment Variable into env.js:', cleanUrl);
