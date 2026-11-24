const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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
    reply: replies[level] || replies.A1,
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
    const error = new Error(data.error?.message || 'Gemini API request failed.');
    error.status = response.status;
    throw error;
  }

  const output = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
  if (!output) throw new Error('Gemini returned an empty response.');
  const parsed = JSON.parse(output);

  return {
    reply: String(parsed.reply || 'Good job! Tell me more.'),
    correction: String(parsed.correction || ''),
    explanation: String(parsed.explanation || ''),
    pronunciation_tip: String(parsed.pronunciation_tip || ''),
    encouragement: String(parsed.encouragement || 'ممتاز، كمل!'),
    mode: 'ai'
  };
}

module.exports = { GEMINI_MODEL, fallbackReply, askGemini };
