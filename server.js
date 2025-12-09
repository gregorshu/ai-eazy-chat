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

function fetchOpenRouterModels(apiKey) {
  const key = apiKey || API_KEY;
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      hostname: 'openrouter.ai',
      path: '/api/v1/models',
      headers: {
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'ai-eazy-chat',
      },
    };

    const req = https.request(options, (apiRes) => {
      let body = '';
      apiRes.on('data', (chunk) => (body += chunk));
      apiRes.on('end', () => {
        if (apiRes.statusCode >= 400) {
          const message = body || `OpenRouter responded with status ${apiRes.statusCode}`;
          reject(new Error(message));
          return;
        }

        try {
          const parsed = JSON.parse(body || '{}');
          const models = (parsed?.data || [])
            .map((entry) => entry.id)
            .filter(Boolean);
          resolve(models);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function handleModels(req, res) {
  let payload = {};
  if (req.method === 'POST') {
    try {
      const body = await bufferBody(req);
      payload = JSON.parse(body || '{}');
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }
  }

  const apiKey = payload.apiKey || API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: 'OpenRouter API key is not set. Please set it in settings or as OPENROUTER_API_KEY environment variable.' });
    return;
  }

  try {
    const models = await fetchOpenRouterModels(apiKey);
    sendJson(res, 200, { models });
  } catch (err) {
    console.error('Failed to fetch OpenRouter models', err);
    sendJson(res, 502, { error: 'Failed to fetch model list from OpenRouter' });
  }
}

async function handleChat(req, res) {
  let payload;
  try {
    const body = await bufferBody(req);
    payload = JSON.parse(body || '{}');
  } catch (err) {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const apiKey = payload.apiKey || API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: 'OpenRouter API key is not set. Please set it in settings or as OPENROUTER_API_KEY environment variable.' });
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
    stream: true,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  });

  const options = {
    method: 'POST',
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost',
      'X-Title': 'ai-eazy-chat',
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    const statusCode = apiRes.statusCode || 500;
    const contentType = apiRes.headers['content-type'] || '';

    if (statusCode >= 400) {
      let errorBody = '';
      apiRes.on('data', (chunk) => (errorBody += chunk));
      apiRes.on('end', () => {
        sendJson(res, statusCode, { error: errorBody || 'Upstream error' });
      });
      return;
    }

    const isStream = contentType.includes('text/event-stream');
    if (isStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      apiRes.on('data', (chunk) => {
        res.write(chunk);
      });

      apiRes.on('end', () => {
        res.end();
      });

      apiRes.on('error', (err) => {
        if (!res.writableEnded) {
          res.end();
        }
        console.error('Stream error', err);
      });
      return;
    }

    let data = '';
    apiRes.on('data', (chunk) => (data += chunk));
    apiRes.on('end', () => {
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

  req.on('aborted', () => {
    apiReq.destroy();
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

  if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/api/models') {
    handleModels(req, res);
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
