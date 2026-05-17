import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const logic = require('../src/shared/sedentaryLogic.cjs');

describe('sedentaryLogic', () => {
  it('normalizeWarnMinutes snaps to 5 min steps', () => {
    expect(logic.normalizeWarnMinutes(32)).toBe(30);
    expect(logic.normalizeWarnMinutes(33)).toBe(35);
    expect(logic.normalizeWarnMinutes(3)).toBe(5);
    expect(logic.normalizeWarnMinutes(999)).toBe(180);
  });

  it('shouldWatchForFocus requires matching project', () => {
    expect(
      logic.shouldWatchForFocus({
        enabled: true,
        projectId: 5,
        focus: { projectId: 5, paused: false },
      })
    ).toBe(true);
    expect(
      logic.shouldWatchForFocus({
        enabled: true,
        projectId: 5,
        focus: { projectId: 9, paused: false },
      })
    ).toBe(false);
    expect(
      logic.shouldWatchForFocus({
        enabled: true,
        projectId: 5,
        focus: { projectId: 5, paused: true },
      })
    ).toBe(false);
  });

  it('appMatchesProject detects After Effects', () => {
    expect(
      logic.appMatchesProject('Adobe After Effects 2024', 'Ae da ishlash')
    ).toBe(true);
    expect(logic.appMatchesProject('Google Chrome', 'Ae da ishlash')).toBe(false);
  });

  it('countsAsSitting respects front app', () => {
    expect(
      logic.countsAsSitting({
        present: true,
        activeAppName: 'Adobe After Effects',
        activeAppMatches: true,
      })
    ).toBe(true);
    expect(
      logic.countsAsSitting({
        present: true,
        activeAppName: 'Chrome',
        activeAppMatches: false,
      })
    ).toBe(false);
    expect(
      logic.countsAsSitting({
        present: true,
        activeAppName: null,
        activeAppMatches: false,
      })
    ).toBe(true);
  });
});
