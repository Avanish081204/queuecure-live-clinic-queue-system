const http = require('http');
const path = require('path');
const fs   = require('fs');

const BASE   = path.join(__dirname, 'frontend');
const PUBLIC = path.join(BASE, 'public');
const SRC    = path.join(BASE, 'src');
const PORT   = 8080;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

http.createServer((req, res) => {
  let url = req.url.split('?')[0];

  // src assets route
  let filePath;
  if (url.startsWith('/src/')) {
    filePath = path.join(SRC, url.slice(5));
  } else if (url === '/' || url === '/index.html') {
    filePath = path.join(PUBLIC, 'index.html');
  } else {
    filePath = path.join(PUBLIC, url);
  }

  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'text/plain';

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found: ' + url);
  }
}).listen(PORT, () => {
  console.log('QueueCure preview server running at http://localhost:' + PORT);
});
