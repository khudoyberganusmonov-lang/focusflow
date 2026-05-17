import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { taskShowsOnDate, parseRepeatDays } = require('../src/main/taskRepeat.js');

describe('taskRepeat', () => {
  it('parseRepeatDays normalizes weekdays', () => {
    expect(parseRepeatDays('[1,7,3]')).toEqual([1, 3, 7]);
  });

  it('taskShowsOnDate uses repeat_days', () => {
    const task = { repeat_days: '[1,3,5]', status: 'backlog' };
    expect(taskShowsOnDate(task, '2026-05-18')).toBe(true);
    expect(taskShowsOnDate(task, '2026-05-17')).toBe(false);
  });
});
