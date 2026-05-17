const { getDb } = require('./database');
const settingsService = require('./settingsService');
const notificationHub = require('./notificationHub');

function incrementDistractions(sessionId) {
  const db = getDb();
  const row = db
    .prepare('SELECT id FROM focus_session_stats WHERE session_id = ?')
    .get(sessionId);
  if (row) {
    db.prepare(
      'UPDATE focus_session_stats SET distractions_blocked = distractions_blocked + 1 WHERE session_id = ?'
    ).run(sessionId);
  } else {
    db.prepare(
      'INSERT INTO focus_session_stats (session_id, distractions_blocked) VALUES (?, 1)'
    ).run(sessionId);
  }
}

function getDistractionCount(sessionId) {
  const row = getDb()
    .prepare(
      'SELECT distractions_blocked FROM focus_session_stats WHERE session_id = ?'
    )
    .get(sessionId);
  return row?.distractions_blocked || 0;
}

function buildSessionSummary(session) {
  const db = getDb();
  const started = session.startedAt;
  const ended = new Date().toISOString();
  const duration = session.duration || 0;

  const tasksCompleted = db
    .prepare(
      `SELECT COUNT(*) as c FROM tasks
       WHERE status = 'done' AND completed_at >= ? AND completed_at <= ?`
    )
    .get(started, ended).c;

  const distractions = getDistractionCount(session.sessionId);

  return {
    projectName: session.projectName,
    durationMinutes: Math.floor(duration / 60),
    tasksCompleted,
    distractionsBlocked: distractions,
    message: `Siz ${Math.floor(duration / 60)} daqiqa fokus qildingiz, ${tasksCompleted} vazifa bajarildi, ${distractions} ta chalg'itish bloklandi.`,
  };
}

let lastSessionEndNotifyId = null;

function showSessionSummary(session) {
  const summary = buildSessionSummary(session);
  const notifyKey = session?.sessionId ?? session?.startedAt;
  if (notifyKey != null && lastSessionEndNotifyId !== notifyKey) {
    lastSessionEndNotifyId = notifyKey;
    notificationHub.show({
      soundKey: 'sessionEnd',
      notifyKey: 'sessionEnd',
      title: 'Fokus yakunlandi',
      body: summary.message,
    });
  }
  return summary;
}

module.exports = {
  incrementDistractions,
  getDistractionCount,
  buildSessionSummary,
  showSessionSummary,
};
