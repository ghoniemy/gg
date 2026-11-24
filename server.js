const http = require('http');
const fs = require('fs');
const path = require('path');

// Load local .env without dependencies. Host-provided environment variables win.
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function fallbackReply(message, level) {
  const corrections = [];
  if (/\bi am agree\b/i.test(message)) corrections.push(['I agree.', 'نقول I agree وليس I am agree. فعل agree لا يحتاج am.']);
  if (/\bhe go\b/i.test(message)) corrections.push(['He goes.', 'مع he / she / it نضيف غالبًا s للفعل في المضارع البسيط.']);
  if (/\bshe go\b/i.test(message)) corrections.push(['She goes.', 'مع he / she / it نضيف غالبًا s للفعل في المضارع البسيط.']);
  if (/\bi has\b/i.test(message)) corrections.push(['I have.', 'مع I نستخدم have وليس has.']);
  if (/\bi am have\b/i.test(message)) corrections.push(['I have …', 'لا نستخدم am قبل have في هذا المعنى.']);
  const replies = {
    A1: 'Nice! Let’s practice one small step at a time. What do you usually do in the morning?',
    A2: 'Good job expressing your idea. Can you tell me a little more about it?',
    B1: 'Great effort. Let’s make your answer more detailed: what is the main reason?'
  };
  return {
    reply: replies[level],
    correction: corrections[0]?.[0] || '',
    explanation: corrections[0]?.[1] || 'جملتك وصلتني. أضف مفتاح Gemini لتفعيل التصحيح الذكي.',
    pronunciation_tip: 'قسّم الجملة إلى كلمات، وانطق ببطء ثم أعدها بسرعة طبيعية. هذا الوضع لا يحلل الصوت نفسه.',
    encouragement: 'أحسنت! الغلط جزء طبيعي من التعلم. استمر ❤️',
    mode: 'basic'
  };
}

async function askGemini(message, level) {
  const prompt = `You are SpeakMate, a kind, patient English speaking tutor for an Arabic-speaking learner. Current level: ${level}. Reply in JSON only with keys: reply (short natural English response that continues conversation), correction (corrected version or empty string), explanation (brief Egyptian Arabic explanation or empty string), pronunciation_tip (one practical pronunciation tip or empty string), encouragement (short encouraging Arabic phrase). Do not claim to hear pronunciation from text. Correct only the most important 1-2 mistakes. Keep the conversation going with one simple question. Learner said: ${message}`;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.5 }
    }),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || 'Gemini API request failed.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  const output = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!output) throw new Error('Gemini returned an empty response.');
  try {
    const parsed = JSON.parse(output);
    return {
      reply: String(parsed.reply || 'Good job! Tell me more.'),
      correction: String(parsed.correction || ''),
      explanation: String(parsed.explanation || ''),
      pronunciation_tip: String(parsed.pronunciation_tip || ''),
      encouragement: String(parsed.encouragement || 'ممتاز، كمل!'),
      mode: 'ai'
    };
  } catch {
    throw new Error('Gemini returned a response that could not be read. Please try again.');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health' && req.method === 'GET') {
    return send(res, 200, { ok: true, aiConfigured: Boolean(process.env.GEMINI_API_KEY), model: GEMINI_MODEL });
  }

  if (url.pathname === '/api/chat' && req.method === 'POST') {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 20000) {
        send(res, 413, { error: 'الرسالة طويلة جدًا. اختصرها وجرب مرة أخرى.' });
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (res.writableEnded) return;
      try {
        const body = JSON.parse(raw || '{}');
        const message = String(body.message || '').trim();
        if (!message) return send(res, 400, { error: 'اكتب أو قل جملة بالإنجليزية أولاً.' });
        const level = ['A1', 'A2', 'B1'].includes(body.level) ? body.level : 'A1';
        if (!process.env.GEMINI_API_KEY) return send(res, 200, fallbackReply(message, level));
        try {
          return send(res, 200, await askGemini(message, level));
        } catch (error) {
          const status = error.status === 400 || error.status === 401 || error.status === 403 || error.status === 429 ? 502 : 503;
          return send(res, status, {
            error: status === 502
              ? 'Gemini رفض الطلب. راجع صلاحية المفتاح وحصة الاستخدام وإعدادات Google AI Studio.'
              : 'تعذر الوصول إلى Gemini حاليًا. حاول مرة أخرى بعد قليل.'
          });
        }
      } catch {
        return send(res, 400, { error: 'تعذر قراءة الرسالة. حاول مرة أخرى.' });
      }
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const full = path.resolve(ROOT, requested);
  if (!full.startsWith(ROOT + path.sep) && full !== path.join(ROOT, 'index.html')) {
    return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }
  fs.readFile(full, (error, data) => {
    if (error) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`SpeakMate AI running on port ${PORT}`));
