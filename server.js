const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY;
const PUBLIC_DIR = path.join(__dirname, 'public');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filepath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filepath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(filepath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filepath);
    const mime = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filepath).pipe(res);
  });
}

function bufferBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1e7) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function buildSystemPrompt(persona, files = []) {
  const personaText = persona ? `You are role-playing as: ${persona}.` : 'Respond as a helpful, concise assistant.';
  if (!files.length) {
    return personaText;
  }
  const fileSummaries = files
    .map((file) => `Filename: ${file.name}\nContent:\n${file.content}`)
    .join('\n\n');
  return `${personaText}\nThe following files are in context:\n${fileSummaries}`;
}

async function handleChat(req, res) {
  if (!API_KEY) {
    sendJson(res, 500, { error: 'OPENROUTER_API_KEY is not set on the server.' });
    return;
  }

  let payload;
  try {
    const body = await bufferBody(req);
    payload = JSON.parse(body || '{}');
  } catch (err) {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const { messages, model = 'openrouter/auto', persona = '', files = [] } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    sendJson(res, 400, { error: 'messages must be a non-empty array' });
    return;
  }

  const systemPrompt = buildSystemPrompt(persona, files);
  const requestBody = JSON.stringify({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  });

  const options = {
    method: 'POST',
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
      Authorization: `Bearer ${API_KEY}`,
      'HTTP-Referer': 'http://localhost',
      'X-Title': 'ai-eazy-chat',
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => (data += chunk));
    apiRes.on('end', () => {
      if (apiRes.statusCode && apiRes.statusCode >= 400) {
        sendJson(res, apiRes.statusCode, { error: data || 'Upstream error' });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const content = parsed?.choices?.[0]?.message?.content || '';
        sendJson(res, 200, { content });
      } catch (err) {
        sendJson(res, 502, { error: 'Invalid response from OpenRouter' });
      }
    });
  });

  apiReq.on('error', (err) => {
    sendJson(res, 502, { error: err.message });
  });

  apiReq.write(requestBody);
  apiReq.end();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    handleChat(req, res);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
