const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    ok: true,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    model: GEMINI_MODEL
  });
};
