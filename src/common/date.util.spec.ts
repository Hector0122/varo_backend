import { parseDateInput } from './date.util';

describe('parseDateInput', () => {
  it('anchors a bare YYYY-MM-DD date at local noon, not UTC midnight', () => {
    const result = parseDateInput('2026-07-25');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(25);
    expect(result.getHours()).toBe(12);
  });

  it('stays on the same calendar day when viewed from a negative UTC offset', () => {
    const result = parseDateInput('2026-07-25');
    const displayed = result.toLocaleDateString('en-CA', {
      timeZone: 'America/Mexico_City',
    });
    expect(displayed).toBe('2026-07-25');
  });

  it('parses a full ISO datetime string as-is', () => {
    const result = parseDateInput('2026-07-25T03:15:00.000Z');
    expect(result.toISOString()).toBe('2026-07-25T03:15:00.000Z');
  });
});
