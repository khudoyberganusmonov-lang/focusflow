const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusflow', {
  areas: {
    getAll: () => ipcRenderer.invoke('areas:getAll'),
    create: (data) => ipcRenderer.invoke('areas:create', data),
    update: (data) => ipcRenderer.invoke('areas:update', data),
    delete: (id) => ipcRenderer.invoke('areas:delete', id),
  },
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    getOne: (id) => ipcRenderer.invoke('projects:getOne', id),
    create: (data) => ipcRenderer.invoke('projects:create', data),
    save: (data) => ipcRenderer.invoke('projects:save', data),
    update: (data) => ipcRenderer.invoke('projects:update', data),
    delete: (id) => ipcRenderer.invoke('projects:delete', id),
  },
  tasks: {
    getToday: () => ipcRenderer.invoke('tasks:getToday'),
    getAll: () => ipcRenderer.invoke('tasks:getAll'),
    getUpcoming: () => ipcRenderer.invoke('tasks:getUpcoming'),
    getByStatus: (status) => ipcRenderer.invoke('tasks:getByStatus', status),
    getByProject: (projectId) =>
      ipcRenderer.invoke('tasks:getByProject', projectId),
    getOne: (id) => ipcRenderer.invoke('tasks:getOne', id),
    create: (data) => ipcRenderer.invoke('tasks:create', data),
    update: (data) => ipcRenderer.invoke('tasks:update', data),
    delete: (id) => ipcRenderer.invoke('tasks:delete', id),
    complete: (id) => ipcRenderer.invoke('tasks:complete', id),
    toggle: (id) => ipcRenderer.invoke('tasks:toggle', id),
    reorder: (orderedIds) => ipcRenderer.invoke('tasks:reorder', orderedIds),
    morningSummary: () => ipcRenderer.invoke('tasks:morningSummary'),
  },
  checklist: {
    get: (taskId) => ipcRenderer.invoke('checklist:get', taskId),
    add: (data) => ipcRenderer.invoke('checklist:add', data),
    toggle: (id) => ipcRenderer.invoke('checklist:toggle', id),
    delete: (id) => ipcRenderer.invoke('checklist:delete', id),
  },
  focus: {
    start: (data) => ipcRenderer.invoke('focus:start', data),
    pause: () => ipcRenderer.invoke('focus:pause'),
    resume: () => ipcRenderer.invoke('focus:resume'),
    stop: () => ipcRenderer.invoke('focus:stop'),
    requestStop: () => ipcRenderer.invoke('focus:request-stop'),
    getState: () => ipcRenderer.invoke('focus:getState'),
    tick: () => ipcRenderer.invoke('focus:tick'),
    onStateChange: (callback) => {
      const handler = (_, state) => callback(state);
      ipcRenderer.on('focus:state', handler);
      return () => ipcRenderer.removeListener('focus:state', handler);
    },
    onSummary: (callback) => {
      const handler = (_, summary) => callback(summary);
      ipcRenderer.on('focus:summary', handler);
      return () => ipcRenderer.removeListener('focus:summary', handler);
    },
    onRequestStop: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('focus:request-stop', handler);
      return () => ipcRenderer.removeListener('focus:request-stop', handler);
    },
  },
  tracker: {
    start: (projectId) => ipcRenderer.invoke('tracker:start', projectId),
    stop: () => ipcRenderer.invoke('tracker:stop'),
    getEntries: (date) => ipcRenderer.invoke('tracker:getEntries', date),
    getTodayStats: (date) => ipcRenderer.invoke('tracker:getTodayStats', date),
    getVaqtStats: (opts) => ipcRenderer.invoke('tracker:getVaqtStats', opts),
  },
  time: {
    getToday: (date) => ipcRenderer.invoke('time:getToday', date),
    getUnassigned: (date) => ipcRenderer.invoke('time:getUnassigned', date),
    assignProject: (data) => ipcRenderer.invoke('time:assignProject', data),
    createManual: (data) => ipcRenderer.invoke('time:createManual', data),
  },
  blocker: {
    requestAdmin: () => ipcRenderer.invoke('blocker:requestAdmin'),
    getStatus: () => ipcRenderer.invoke('blocker:getStatus'),
    getConfig: (projectId) => ipcRenderer.invoke('blocker:getConfig', projectId),
    addDomain: (data) => ipcRenderer.invoke('blocker:addDomain', data),
    removeDomain: (id) => ipcRenderer.invoke('blocker:removeDomain', id),
    addException: (data) => ipcRenderer.invoke('blocker:addException', data),
    removeException: (id) => ipcRenderer.invoke('blocker:removeException', id),
    listApps: () => ipcRenderer.invoke('blocker:listApps'),
    setAppBlocked: (data) => ipcRenderer.invoke('blocker:setAppBlocked', data),
    getSchedules: () => ipcRenderer.invoke('blocker:getSchedules'),
    addSchedule: (data) => ipcRenderer.invoke('blocker:addSchedule', data),
    removeSchedule: (id) => ipcRenderer.invoke('blocker:removeSchedule', id),
    syncProjectDomains: (projectId) =>
      ipcRenderer.invoke('blocker:syncProjectDomains', projectId),
  },
  apps: {
    list: () => ipcRenderer.invoke('apps:list'),
    getIconUrl: (bundlePath) =>
      bundlePath
        ? `app-icon://icon?path=${encodeURIComponent(bundlePath)}`
        : null,
    resolveBundlePath: (appName) =>
      ipcRenderer.invoke('apps:resolveBundlePath', appName),
    getIconUrlForApp: async (appName) => {
      const bundlePath = await ipcRenderer.invoke(
        'apps:resolveBundlePath',
        appName
      );
      return bundlePath
        ? `app-icon://icon?path=${encodeURIComponent(bundlePath)}`
        : null;
    },
    /** @deprecated use getIconUrl(bundlePath) */
    getIcon: (appName) => ipcRenderer.invoke('apps:getIcon', appName),
  },
  reports: {
    get: (opts) => ipcRenderer.invoke('reports:get', opts),
    exportCsv: (opts) => ipcRenderer.invoke('reports:exportCsv', opts),
  },
  ai: {
    suggestTasks: (projectId) =>
      ipcRenderer.invoke('ai:suggestTasks', { projectId }),
    planDay: () => ipcRenderer.invoke('ai:planDay'),
    analyzeProductivity: (weeklyStats) =>
      ipcRenderer.invoke('ai:analyzeProductivity', weeklyStats),
    analyzeVaqt: (stats, period) =>
      ipcRenderer.invoke('ai:analyzeVaqt', { stats, period }),
    focusCoach: (data) => ipcRenderer.invoke('ai:focusCoach', data),
    chat: (messages, options = {}) =>
      ipcRenderer.invoke('ai:chat', {
        messages,
        context: options.context,
        stream: options.stream ?? true,
      }),
    onChatChunk: (callback) => {
      const handler = (_, chunk) => callback(chunk);
      ipcRenderer.on('ai:chat-chunk', handler);
      return () => ipcRenderer.removeListener('ai:chat-chunk', handler);
    },
    onFocusCoach: (callback) => {
      const handler = (_, payload) => callback(payload);
      ipcRenderer.on('ai:focusCoach', handler);
      return () => ipcRenderer.removeListener('ai:focusCoach', handler);
    },
    morningGreeting: () => ipcRenderer.invoke('ai:morningGreeting'),
    eveningSummary: () => ipcRenderer.invoke('ai:eveningSummary'),
    getDailyGreeting: () => ipcRenderer.invoke('ai:getDailyGreeting'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
    setAll: (obj) => ipcRenderer.invoke('settings:setAll', obj),
    testApiKey: (type, key) =>
      ipcRenderer.invoke('settings:testApiKey', { type, key }),
    onChange: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('settings:changed', handler);
      return () => ipcRenderer.removeListener('settings:changed', handler);
    },
  },
  notifications: {
    pickSound: (soundKey) =>
      ipcRenderer.invoke('notifications:pickSound', soundKey),
    clearSound: (soundKey) =>
      ipcRenderer.invoke('notifications:clearSound', soundKey),
    testSound: (soundKey) =>
      ipcRenderer.invoke('notifications:testSound', soundKey),
  },
  sedentary: {
    getStatus: () => ipcRenderer.invoke('sedentary:getStatus'),
    start: () => ipcRenderer.invoke('sedentary:start'),
    stop: () => ipcRenderer.invoke('sedentary:stop'),
    test: () => ipcRenderer.invoke('sedentary:test'),
    onStatus: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('sedentary:status', handler);
      return () => ipcRenderer.removeListener('sedentary:status', handler);
    },
  },
  app: {
    getTheme: () => ipcRenderer.invoke('app:getTheme'),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    quit: () => ipcRenderer.invoke('app:quit'),
    cancelQuit: () => ipcRenderer.invoke('app:cancel-quit'),
    isQuitPending: () => ipcRenderer.invoke('app:is-quit-pending'),
    onQuitAfterLock: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('app:quit-after-lock', handler);
      return () => ipcRenderer.removeListener('app:quit-after-lock', handler);
    },
    onThemeChange: (callback) => {
      const handler = () => ipcRenderer.invoke('app:getTheme').then(callback);
      ipcRenderer.on('theme:changed', handler);
      return () => ipcRenderer.removeListener('theme:changed', handler);
    },
  },
});
