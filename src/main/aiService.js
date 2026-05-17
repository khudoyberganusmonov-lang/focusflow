const { getDb } = require('./database');
const reportsService = require('./reportsService');
const settingsService = require('./settingsService');

const MODEL = 'claude-haiku-4-5-20251001';
const ERROR_MSG = 'AI vaqtincha ishlamayapti';
const NO_KEY_MSG =
  "API key kiritilmagan. Sozlamalar bo'limiga o'ting va Anthropic API keyingizni kiriting.";

let AnthropicSdk = null;

function loadAnthropicSdk() {
  if (AnthropicSdk) return AnthropicSdk;
  try {
    AnthropicSdk = require('@anthropic-ai/sdk');
    return AnthropicSdk;
  } catch (err) {
    console.error('[aiService] SDK load failed:', err.message);
    return null;
  }
}

function getApiKey() {
  const key = settingsService.getAnthropicApiKey();
  if (!key || String(key).trim().length < 10) return null;
  return String(key).trim();
}

function hasApiKey() {
  return Boolean(getApiKey());
}

const BASE_SYSTEM = `Sen FocusFlow macOS app ichidagi AI assistantsan.
Foydalanuvchi: Xudoybergan, motion graphics dizayner.
Brend: Power FX Studios (Farg'ona, O'zbekiston).
Platformalar: VideoHive, Freepik, Adobe Stock, Pond5.
Asosiy ish: After Effects shablonlar, MOGRT export, VFX pack, texture asset yaratish.
Muammo: kun boshida reja yo'q, chalg'ish (YouTube, Instagram, Telegram).
Doim o'zbek tilida, qisqa, amaliy javob ber.`;

function getClient() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const Anthropic = loadAnthropicSdk();
  if (!Anthropic) return null;
  try {
    return new Anthropic({ apiKey });
  } catch (err) {
    console.error('[aiService] Anthropic client init failed:', err.message);
    return null;
  }
}

function getOpenAIKey() {
  return settingsService.getOpenaiApiKey();
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function apiErrorFromException(err) {
  const status = err?.status ?? err?.statusCode;
  if (status === 401) {
    console.warn('[aiService] API key rejected (401)');
    return { error: true, content: ERROR_MSG, reason: 'invalid_api_key' };
  }
  console.warn('[aiService]', err?.message || err);
  return { error: true, content: ERROR_MSG, reason: err?.message };
}

function buildAppState(extra = {}) {
  const db = getDb();
  const today = todayStr();
  const focusProjectId = extra.activeProjectId ?? null;

  let taskCount = 0;
  let timeTrackedSeconds = 0;
  let activeProject = null;

  if (db) {
    try {
      taskCount = db
        .prepare(
          `SELECT COUNT(*) as c FROM tasks
           WHERE status != 'done' AND (status = 'today' OR due_date = ? OR due_date IS NULL)`
        )
        .get(today).c;

      timeTrackedSeconds = db
        .prepare(
          `SELECT COALESCE(SUM(duration), 0) as s FROM time_entries
           WHERE date(started_at) = date('now', 'localtime')`
        )
        .get().s;

      if (focusProjectId) {
        activeProject = db
          .prepare('SELECT id, name FROM projects WHERE id = ?')
          .get(focusProjectId);
      }
    } catch (err) {
      console.warn('[aiService] buildAppState db:', err.message);
    }
  }

  let weekReport = { productivityScore: null };
  try {
    weekReport = reportsService.getReportData('week');
  } catch (err) {
    console.warn('[aiService] buildAppState reports:', err.message);
  }

  return {
    date: today,
    dateFormatted: new Date().toLocaleDateString('uz-UZ', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    activeProject: activeProject?.name || "yo'q",
    activeProjectId: activeProject?.id || null,
    tasksCount: taskCount,
    timeTrackedMinutes: Math.floor((timeTrackedSeconds || 0) / 60),
    productivityScore: weekReport.productivityScore,
    ...extra,
  };
}

function formatStateBlock(state) {
  return [
    '--- App holati ---',
    `Sana: ${state.dateFormatted || state.date}`,
    `Faol loyiha: ${state.activeProject}`,
    `Bugungi vazifalar: ${state.tasksCount}`,
    `Bugun kuzatilgan vaqt: ${state.timeTrackedMinutes} daqiqa`,
    `Mahsuldorlik balli: ${state.productivityScore ?? '—'}`,
  ].join('\n');
}

async function callClaude({ userPrompt, systemExtra = '', maxTokens = 1024 }) {
  if (!getApiKey()) return null;

  const client = getClient();
  if (!client) return null;

  const state = buildAppState();
  const system = `${BASE_SYSTEM}\n\n${formatStateBlock(state)}${systemExtra ? `\n\n${systemExtra}` : ''}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return { error: false, content: text };
  } catch (err) {
    return apiErrorFromException(err);
  }
}

function parseJsonArray(text) {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch {
    /* fall through */
  }
  return null;
}

function parseJsonObject(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {
    /* fall through */
  }
  return null;
}

async function suggestTasks(projectName, existingTasks, timeTracked) {
  if (!getApiKey()) return null;

  const taskList = (existingTasks || [])
    .map((t) => `- ${t.title} (${t.status || 'open'})`)
    .join('\n') || "(yo'q)";

  const res = await callClaude({
    maxTokens: 1024,
    userPrompt: `Loyiha: "${projectName}"
Bugun shu loyiha uchun ${Math.floor((timeTracked || 0) / 60)} daqiqa ishlagan.
Mavjud vazifalar:
${taskList}

Mahsuldorlik murabbiyi sifatida 3-5 ta aniq, bajariladigan keyingi vazifa tavsiya qil.
Faqat JSON massiv qaytar: [{"title":"...","reason":"..."}]`,
    systemExtra: "Faqat valid JSON massiv, boshqa matn yo'q.",
  });

  if (!res) return null;
  if (res.error) return { error: true, tasks: [], message: res.content };

  const parsed = parseJsonArray(res.content);
  const tasks = Array.isArray(parsed)
    ? parsed.slice(0, 5).map((t) => ({
        title: String(t.title || t).slice(0, 200),
        reason: t.reason ? String(t.reason) : '',
      }))
    : res.content
        .split('\n')
        .filter((l) => l.trim())
        .slice(0, 5)
        .map((line) => ({
          title: line.replace(/^[-*\d.]+\s*/, '').trim(),
          reason: '',
        }));

  return { error: false, tasks };
}

async function planDay(projects, timeEntries, completedTasks) {
  if (!getApiKey()) return null;

  const projectLines = (projects || [])
    .map((p) => `- ${p.name} (focus: ${p.focus_duration || 60} min)`)
    .join('\n');

  const timeLines = (timeEntries || [])
    .slice(0, 15)
    .map(
      (e) =>
        `- ${e.app_name || 'app'}: ${Math.floor((e.duration || 0) / 60)} min${e.project_name ? ` [${e.project_name}]` : ''}`
    )
    .join('\n');

  const doneLines = (completedTasks || [])
    .map((t) => `- ${t.title} (${t.project_name || ''})`)
    .join('\n');

  const res = await callClaude({
    maxTokens: 1024,
    userPrompt: `Bugungi kun uchun vaqt bloklari bilan strukturali reja tuz.

Loyihalar:
${projectLines || "(yo'q)"}

Bugungi vaqt yozuvlari:
${timeLines || "(yo'q)"}

Bajarilgan vazifalar:
${doneLines || "(yo'q)"}

Format misol:
09:00-11:00 VideoHive Pack (3 vazifa)
11:00-12:00 Tanaffus
...

Qisqa, amaliy reja yoz.`,
  });

  if (!res) return null;

  return {
    error: res.error,
    plan: res.error ? res.content : res.content,
    message: res.error ? res.content : undefined,
  };
}

function formatSecondsHM(seconds) {
  const h = Math.floor((seconds || 0) / 3600);
  const m = Math.floor(((seconds || 0) % 3600) / 60);
  if (h === 0) return `${m} daqiqa`;
  if (m === 0) return `${h} soat`;
  return `${h} soat ${m} daqiqa`;
}

async function analyzeVaqt(vaqtStats, periodLabel = 'bugun') {
  if (!getApiKey()) return null;
  if (!vaqtStats) return null;

  const topApps = (vaqtStats.apps || []).slice(0, 8).map((a) => ({
    name: a.name,
    minutes: Math.round((a.seconds || 0) / 60),
    category: a.category,
  }));

  const peakHours = (vaqtStats.productiveHours || [])
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((h) => ({ hour: h.hour, score: h.score }));

  const payload = JSON.stringify(
    {
      period: periodLabel,
      totalTracked: formatSecondsHM(vaqtStats.totalSeconds),
      focusTime: formatSecondsHM(vaqtStats.focusSeconds),
      productivityScore: vaqtStats.productivityScore,
      tasksCompleted: vaqtStats.tasksCompleted,
      categoryMinutes: {
        productive: Math.round((vaqtStats.categoryTotals?.productive || 0) / 60),
        distracting: Math.round((vaqtStats.categoryTotals?.distracting || 0) / 60),
        neutral: Math.round((vaqtStats.categoryTotals?.neutral || 0) / 60),
      },
      topApps,
      peakHours,
      bestWeekday: (vaqtStats.productiveWeekday || [])
        .slice()
        .sort((a, b) => b.score - a.score)[0],
    },
    null,
    0
  );

  const res = await callClaude({
    maxTokens: 1400,
    userPrompt: `Vaqt kuzatuv statistikasi (${periodLabel}):
${payload}

Faqat JSON qaytar (boshqa matn yo'q):
{
  "headline": "1 ta qisqa xulosa jumlasi",
  "score": 0-100,
  "scoreLabel": "Juda yaxshi|Yaxshi|O'rtacha|Past",
  "highlights": [
    {"icon":"clock|target|zap|alert|trend|check|coffee|monitor","title":"3-5 so'z","text":"1-2 jumla"}
  ],
  "categoryNotes": [
    {"key":"productive|distracting|neutral","text":"qisqa izoh"}
  ],
  "tips": [
    {"icon":"target|zap|coffee","text":"aniq tavsiya"}
  ]
}
highlights: 3 ta, categoryNotes: faqat mavjud kategoriyalar, tips: 2-3 ta. O'zbek tilida.`,
    systemExtra: "Faqat valid JSON obyekt, markdown yo'q.",
  });

  if (!res) return null;

  if (res.error) {
    return { error: true, message: res.content, insights: res.content };
  }

  const parsed = parseJsonObject(res.content);
  if (parsed?.headline) {
    return { error: false, analysis: parsed };
  }

  return {
    error: false,
    analysis: {
      headline: "Kunlik tahlil",
      score: vaqtStats.productivityScore || 0,
      scoreLabel: "Tahlil",
      highlights: [{ icon: 'trend', title: 'Xulosa', text: res.content }],
      tips: [],
      categoryNotes: [],
    },
    insights: res.content,
  };
}

async function analyzeProductivity(weeklyStats) {
  if (!getApiKey()) return null;

  const stats = weeklyStats || reportsService.getReportData('week');
  const payload = JSON.stringify(
    {
      totalFocusHours: Math.round(((stats.totalFocusSeconds || 0) / 3600) * 10) / 10,
      tasksDone: stats.tasksDone,
      productiveHour: stats.productiveHour,
      topProject: stats.topProject,
      topApps: (stats.topApps || []).slice(0, 5),
      distractionsBlocked: stats.distractionsBlocked,
      productivityScore: stats.productivityScore,
      streak: stats.streak,
      sessionFocus: stats.sessionFocus || null,
    },
    null,
    0
  );

  const res = await callClaude({
    maxTokens: 1024,
    userPrompt: `Haftalik mahsuldorlik ma'lumotlari:
${payload}

Tahlil qil: eng samarali vaqt oralig'i, chalg'ituvchilar, 3-4 ta aniq tavsiya.
Agar sessionFocus bo'lsa, oxirgi fokus sessiyasini ham qisqa bahola.`,
  });

  if (!res) return null;

  return {
    error: res.error,
    insights: res.content,
    message: res.error ? res.content : undefined,
  };
}

async function focusCoach(sessionMinutes, project, completedTasks, blockedAttempts) {
  if (!getApiKey()) return null;

  const done = (completedTasks || []).length;
  const res = await callClaude({
    maxTokens: 512,
    userPrompt: `Fokus sessiyasi: ${sessionMinutes} daqiqa, loyiha: "${project}".
Sessiyada bajarilgan vazifalar: ${done}.
Bloklangan chalg'itishlar: ${blockedAttempts || 0}.

JSON qaytar: {"message":"rag'batlantiruvchi xabar","suggestBreak":true/false}
suggestBreak true bo'lsin agar 25+ daqiqa fokus yoki tanaffus kerak bo'lsa.`,
    systemExtra: 'Faqat JSON obyekt.',
  });

  if (!res) return null;

  if (res.error) {
    return {
      error: true,
      message: ERROR_MSG,
      suggestBreak: sessionMinutes >= 25,
    };
  }

  const parsed = parseJsonObject(res.content);
  if (parsed?.message) {
    return {
      error: false,
      message: parsed.message,
      suggestBreak: Boolean(parsed.suggestBreak),
    };
  }

  return {
    error: false,
    message: res.content.slice(0, 300),
    suggestBreak: sessionMinutes >= 25,
  };
}

function buildChatSystem(context) {
  const state = buildAppState(context || {});
  let block = formatStateBlock(state);

  if (context?.todayTasks?.length) {
    block += '\n\nBugungi vazifalar:\n';
    block += context.todayTasks
      .slice(0, 15)
      .map((t) => `  - [${t.project_name || ''}] ${t.title}`)
      .join('\n');
  }

  return `${BASE_SYSTEM}\n\n${block}`;
}

async function chat(messages, context = {}) {
  if (!getApiKey()) return null;

  const client = getClient();
  if (!client) return null;

  const system = buildChatSystem(context);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: (messages || []).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return { error: false, content: text };
  } catch (err) {
    return apiErrorFromException(err);
  }
}

async function chatStream(messages, context, onChunk) {
  if (!getApiKey()) {
    onChunk?.({ type: 'error', text: NO_KEY_MSG });
    return null;
  }

  const client = getClient();
  if (!client) {
    onChunk?.({ type: 'error', text: NO_KEY_MSG });
    return null;
  }

  const system = buildChatSystem(context || {});

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: (messages || []).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    });

    let full = '';
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta'
      ) {
        const text = event.delta.text || '';
        full += text;
        onChunk?.({ type: 'delta', text });
      }
    }

    onChunk?.({ type: 'done', text: full });
    return { error: false, content: full };
  } catch (err) {
    const mapped = apiErrorFromException(err);
    onChunk?.({ type: 'error', text: mapped.content });
    return mapped;
  }
}

function gatherTodayContext() {
  const db = getDb();
  const today = todayStr();
  if (!db) return { todayTasks: [] };

  try {
    const todayTasks = db
      .prepare(
        `SELECT t.*, p.name as project_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.status != 'done' AND (t.status = 'today' OR t.due_date = ? OR t.due_date IS NULL)
         ORDER BY t.priority ASC LIMIT 30`
      )
      .all(today);
    return { todayTasks };
  } catch (err) {
    console.warn('[aiService] gatherTodayContext:', err.message);
    return { todayTasks: [] };
  }
}

module.exports = {
  suggestTasks,
  planDay,
  analyzeProductivity,
  analyzeVaqt,
  focusCoach,
  chat,
  chatStream,
  buildAppState,
  gatherTodayContext,
  getClient,
  getApiKey,
  getOpenAIKey,
  hasApiKey,
  ERROR_MSG,
  NO_KEY_MSG,
  MODEL,
};
