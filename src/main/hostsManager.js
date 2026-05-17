const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HOSTS_PATH = '/etc/hosts';
const SUDOERS_PATH = '/etc/sudoers.d/focusflow';
const MARKER_START = '# >>>> FocusFlow BLOCK';
const MARKER_END = '# <<<< FocusFlow BLOCK';
const LEGACY_MARKER_STARTS = ['# <<<< FocusFlow BLOCK START >>>>'];
const LEGACY_MARKER_ENDS = ['# <<<< FocusFlow BLOCK END >>>>'];

const SYSTEM_ENTRIES = [
  '127.0.0.1\tlocalhost',
  '255.255.255.255\tbroadcasthost',
  '::1\tlocalhost',
];

const RESERVED_HOSTS = new Set([
  'localhost',
  'broadcasthost',
  'local',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
]);

let hostsWatcher = null;
let pollInterval = null;
let lockActive = false;
let lockedDomains = [];

function isUserCanceledError(err) {
  const msg = String(err?.message || err?.stderr || err || '');
  return (
    msg.includes('-128') ||
    /user canceled/i.test(msg) ||
    /user cancelled/i.test(msg)
  );
}

function normalizeDomain(input) {
  let d = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
  return d;
}

function isFocusFlowMarkerStart(line) {
  const t = line.trim();
  return t === MARKER_START || LEGACY_MARKER_STARTS.includes(t);
}

function isFocusFlowMarkerEnd(line) {
  const t = line.trim();
  return t === MARKER_END || LEGACY_MARKER_ENDS.includes(t);
}

function isReservedHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  return RESERVED_HOSTS.has(h);
}

function expandDomain(domain) {
  const base = normalizeDomain(domain);
  if (!base || isReservedHost(base)) return [];
  const set = new Set([base, `www.${base}`, `m.${base}`]);
  if (base.includes('.')) {
    const parts = base.split('.');
    if (parts.length > 2) {
      set.add(parts.slice(-2).join('.'));
    }
  }
  return Array.from(set);
}

function readHostsSafe() {
  try {
    return fs.readFileSync(HOSTS_PATH, 'utf8');
  } catch {
    return '';
  }
}

function stripFocusFlowSection(content) {
  const lines = content.split('\n');
  const out = [];
  let inBlock = false;
  for (const line of lines) {
    if (isFocusFlowMarkerStart(line)) {
      inBlock = true;
      continue;
    }
    if (isFocusFlowMarkerEnd(line)) {
      inBlock = false;
      continue;
    }
    if (!inBlock) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function hostsFileHasLocalhost(content) {
  const text = content.toLowerCase();
  const hasIpv4 =
    /^\s*127\.0\.0\.1\s+localhost\s*$/m.test(text) ||
    /\s127\.0\.0\.1\s+localhost/.test(text);
  const hasIpv6 =
    /^\s*::1\s+localhost\s*$/m.test(text) || /\s::1\s+localhost/.test(text);
  return hasIpv4 && hasIpv6;
}

/** Preserve macOS system hosts lines; never drop localhost / broadcasthost. */
function ensureSystemEntries(content) {
  const body = stripFocusFlowSection(content || '').trim();
  if (hostsFileHasLocalhost(body)) return body;

  const header = [
    '##',
    '# Host Database',
    '#',
    '# localhost is used to configure the loopback interface',
    '# when the system is booting.  Do not change this entry.',
    '##',
  ].join('\n');

  if (!body) {
    return `${header}\n${SYSTEM_ENTRIES.join('\n')}`;
  }
  return `${header}\n${SYSTEM_ENTRIES.join('\n')}\n\n${body}`;
}

function buildBlockSection(domains) {
  const entries = new Set();
  for (const domain of domains) {
    for (const host of expandDomain(domain)) {
      if (isReservedHost(host)) continue;
      entries.add(`127.0.0.1 ${host}`);
      entries.add(`0.0.0.0 ${host}`);
    }
  }
  if (entries.size === 0) return '';
  return [MARKER_START, ...Array.from(entries).sort(), MARKER_END].join('\n');
}

function buildFullHostsContent(domains) {
  const safeBase = ensureSystemEntries(readHostsSafe());
  const section = buildBlockSection(domains);
  if (!section) return safeBase ? `${safeBase}\n` : `${SYSTEM_ENTRIES.join('\n')}\n`;
  return safeBase ? `${safeBase}\n\n${section}\n` : `${section}\n`;
}

function hasFocusFlowBlock(content) {
  return (
    content.includes(MARKER_START) ||
    LEGACY_MARKER_STARTS.some((m) => content.includes(m))
  );
}

function sectionMatches(content, domains) {
  const expected = buildBlockSection(domains);
  if (!domains.length) return !hasFocusFlowBlock(content);
  return (
    content.includes(MARKER_START) &&
    content.includes(MARKER_END) &&
    hostsFileHasLocalhost(content) &&
    expected &&
    content.includes(expected.split('\n')[1] || '')
  );
}

function runWithSudo(tmpFile) {
  execFileSync('sudo', ['-n', 'cp', tmpFile, HOSTS_PATH], {
    stdio: 'pipe',
    timeout: 120000,
    encoding: 'utf8',
  });
  execFileSync('sudo', ['-n', 'chmod', '644', HOSTS_PATH], {
    stdio: 'pipe',
    timeout: 120000,
    encoding: 'utf8',
  });
}

function writeHosts(domains) {
  lockedDomains = [...domains];

  const content = buildFullHostsContent(domains);
  const tmp = path.join(os.tmpdir(), `focusflow-hosts-${Date.now()}.txt`);
  fs.writeFileSync(tmp, content, 'utf8');
  try {
    runWithSudo(tmp);
  } catch (err) {
    if (isUserCanceledError(err)) {
      return false;
    }
    throw err;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
  return true;
}

function removeHostsBlock() {
  const clean = ensureSystemEntries(readHostsSafe());
  const tmp = path.join(os.tmpdir(), `focusflow-hosts-clear-${Date.now()}.txt`);
  fs.writeFileSync(tmp, `${clean}\n`, 'utf8');
  try {
    runWithSudo(tmp);
  } catch (err) {
    if (isUserCanceledError(err)) {
      lockedDomains = [];
      return false;
    }
    throw err;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
  lockedDomains = [];
  return true;
}

function syncHostsIfNeeded() {
  if (!lockActive || lockedDomains.length === 0) return false;
  const current = readHostsSafe();
  if (sectionMatches(current, lockedDomains)) return true;
  return writeHosts(lockedDomains);
}

function restoreIfTampered() {
  if (!lockActive || lockedDomains.length === 0) return false;
  const current = readHostsSafe();
  if (sectionMatches(current, lockedDomains)) return false;
  try {
    return writeHosts(lockedDomains);
  } catch {
    return false;
  }
}

function startHostsWatch(onTamper) {
  stopHostsWatch();
  const check = () => {
    if (!lockActive) return;
    try {
      if (restoreIfTampered()) onTamper?.();
    } catch {
      /* no sudo — skip */
    }
  };
  try {
    hostsWatcher = fs.watch(HOSTS_PATH, { persistent: false }, check);
  } catch {
  }
  pollInterval = setInterval(check, 2000);
}

function stopHostsWatch() {
  if (hostsWatcher) {
    hostsWatcher.close();
    hostsWatcher = null;
  }
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function activateHostsLock(domains, onTamper) {
  lockActive = true;
  lockedDomains = [...domains];
  try {
    writeHosts(domains);
  } catch {
    /* sudoers not configured yet */
  }
  startHostsWatch(onTamper);
}

function deactivateHostsLock() {
  lockActive = false;
  stopHostsWatch();
  try {
    removeHostsBlock();
  } catch {
    lockedDomains = [];
  }
}

function getConsoleUsername() {
  return os.userInfo().username;
}

function readSudoersRule() {
  try {
    return execFileSync('sudo', ['-n', 'cat', SUDOERS_PATH], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: 'pipe',
    }).trim();
  } catch {
    return null;
  }
}

/** True when NOPASSWD sudoers allows chmod/cp on /etc/hosts (chmod 440 blocks reading the file directly). */
function isAdminAuthenticated() {
  try {
    execFileSync('sudo', ['-n', 'chmod', '644', HOSTS_PATH], {
      stdio: 'ignore',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/** One-time setup: installs /etc/sudoers.d/focusflow (password via osascript). */
function setupSudoers() {
  console.log('[hostsManager] setupSudoers: start');

  if (isAdminAuthenticated()) {
    console.log('[hostsManager] setupSudoers: already configured');
    syncHostsIfNeeded();
    return { ok: true, alreadyAuthenticated: true };
  }

  const user = getConsoleUsername();
  const sudoRule = `${user} ALL=(ALL) NOPASSWD: /bin/cp * /etc/hosts, /bin/chmod 644 /etc/hosts`;
  const shellRule = sudoRule.replace(/'/g, "'\\''");
  const shellCmd = `printf '%s\\n' '${shellRule}' > /etc/sudoers.d/focusflow && chmod 440 /etc/sudoers.d/focusflow`;
  const osaScript = `do shell script "${shellCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" with administrator privileges`;

  console.log('[hostsManager] setupSudoers: user =', user);
  console.log('[hostsManager] setupSudoers: rule =', sudoRule);
  console.log('[hostsManager] setupSudoers: osascript =', osaScript);

  try {
    const out = execFileSync('osascript', ['-e', osaScript], {
      stdio: 'pipe',
      timeout: 120000,
      encoding: 'utf8',
    });
    console.log('[hostsManager] setupSudoers: osascript stdout:', out || '(empty)');
  } catch (err) {
    console.log('[hostsManager] setupSudoers: osascript error:', err.message);
    console.log('[hostsManager] setupSudoers: osascript stderr:', err.stderr || '(none)');
    console.log('[hostsManager] setupSudoers: osascript stdout:', err.stdout || '(none)');
    if (isUserCanceledError(err)) {
      return { ok: false, canceled: true };
    }
    return { ok: false, error: String(err.message || err) };
  }

  const sudoersExists = fs.existsSync(SUDOERS_PATH);
  const installedRule = readSudoersRule();
  const adminOk = isAdminAuthenticated();
  console.log(
    '[hostsManager] setupSudoers: after run — file exists:',
    sudoersExists,
    'rule:',
    installedRule,
    'adminOk:',
    adminOk
  );

  if (adminOk) {
    syncHostsIfNeeded();
    return { ok: true };
  }

  return {
    ok: false,
    error: 'Sudoers o\'rnatilmadi',
    sudoersExists,
    rule: installedRule,
  };
}

/** Restore localhost if missing (requires sudoers). */
function repairSystemHosts() {
  const current = readHostsSafe();
  if (hostsFileHasLocalhost(current) && !hasFocusFlowBlock(current)) {
    return { ok: true, repaired: false };
  }

  if (!isAdminAuthenticated()) {
    return { ok: false, error: 'Admin ruxsat kerak' };
  }

  const content = ensureSystemEntries(current);
  const tmp = path.join(os.tmpdir(), `focusflow-hosts-repair-${Date.now()}.txt`);
  fs.writeFileSync(tmp, `${content}\n`, 'utf8');
  try {
    runWithSudo(tmp);
    return { ok: true, repaired: true };
  } catch (err) {
    if (isUserCanceledError(err)) {
      return { ok: false, canceled: true };
    }
    return { ok: false, error: String(err.message || err) };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function needsSystemHostsRepair() {
  const current = readHostsSafe();
  return !hostsFileHasLocalhost(current);
}

module.exports = {
  normalizeDomain,
  expandDomain,
  activateHostsLock,
  deactivateHostsLock,
  restoreIfTampered,
  setupSudoers,
  syncHostsIfNeeded,
  isAdminAuthenticated,
  repairSystemHosts,
  needsSystemHostsRepair,
  buildBlockSection,
  readHostsSafe,
};
