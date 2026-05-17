const aiService = require('./aiService');

async function getMorningGreeting() {
  if (!aiService.hasApiKey()) return null;

  const hour = new Date().getHours();
  if (hour >= 18) return null;

  const ctx = aiService.gatherTodayContext();
  return aiService.chat(
    [{ role: 'user', content: 'Ertalab salomlash va bugungi reja uchun qisqa xabar yoz.' }],
    { ...ctx, greetingHint: 'Bu ertalab avtomatik xabar. Juda qisqa (2-3 gap).' }
  );
}

async function getEveningSummary() {
  if (!aiService.hasApiKey()) return null;

  const hour = new Date().getHours();
  if (hour < 18) return null;

  return aiService.chat(
    [
      {
        role: 'user',
        content:
          'Kechki xulosa: bugungi vaqt tracking va vazifalarni tahlil qilib, ertangi kun uchun 2-3 maslahat ber.',
      },
    ],
    aiService.gatherTodayContext()
  );
}

async function chat(messages, context) {
  if (!aiService.hasApiKey()) return null;
  return aiService.chat(messages, context || aiService.gatherTodayContext());
}

module.exports = { chat, getMorningGreeting, getEveningSummary };
