import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { localDateKey, dayjs } = require('../src/shared/dateUtils.cjs');

describe('dateUtils', () => {
  it('localDateKey returns YYYY-MM-DD', () => {
    expect(localDateKey('2026-05-17T10:00:00')).toBe('2026-05-17');
  });

  it('dayjs formats consistently', () => {
    expect(dayjs('2026-01-05').format('YYYY-MM-DD')).toBe('2026-01-05');
  });
});
