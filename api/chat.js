const { fallbackReply, askGemini } = require('../lib/gemini');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};

    const message = String(body.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'اكتب أو قل جملة بالإنجليزية أولاً.' });
    }
    if (message.length > 12000) {
      return res.status(413).json({ error: 'الرسالة طويلة جدًا. اختصرها وجرب مرة أخرى.' });
    }

    const level = ['A1', 'A2', 'B1'].includes(body.level) ? body.level : 'A1';
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json(fallbackReply(message, level));
    }

    try {
      const result = await askGemini(message, level);
      return res.status(200).json(result);
    } catch (error) {
      const status = [400, 401, 403, 429].includes(error.status) ? 502 : 503;
      return res.status(status).json({
        error: status === 502
          ? 'Gemini رفض الطلب. راجع صلاحية المفتاح وحصة الاستخدام وإعدادات Google AI Studio.'
          : 'تعذر الوصول إلى Gemini حاليًا. حاول مرة أخرى بعد قليل.'
      });
    }
  } catch (error) {
    return res.status(500).json({ error: 'حدث خطأ داخلي أثناء معالجة الرسالة.' });
  }
};
