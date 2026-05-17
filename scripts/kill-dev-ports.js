#!/usr/bin/env node
const { execSync } = require('child_process');

const PORT = 5173;

function killPort(port) {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGKILL');
        console.log(`To'xtatildi PID ${pid} (port ${port})`);
      } catch {
        /* ignore */
      }
    }
    if (!pids.length) console.log(`Port ${port} allaqachon bo'sh.`);
  } catch {
    console.log(`Port ${port} bo'sh.`);
  }
}

killPort(PORT);
