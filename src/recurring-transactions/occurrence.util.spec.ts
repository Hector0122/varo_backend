import { latestOccurrence } from './occurrence.util';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date | null) => x?.toISOString().slice(0, 10) ?? null;

describe('latestOccurrence', () => {
  it('mensual cae en su día, no el 1.º', () => {
    expect(
      iso(latestOccurrence(d('2026-09-05'), 'MONTHLY', d('2026-11-17'))),
    ).toBe('2026-11-05');
    expect(
      iso(latestOccurrence(d('2026-09-05'), 'MONTHLY', d('2026-11-04'))),
    ).toBe('2026-10-05');
  });

  it('bimestral, semanal y aún no empieza', () => {
    expect(
      iso(latestOccurrence(d('2026-07-15'), 'BIMONTHLY', d('2026-11-17'))),
    ).toBe('2026-11-15');
    expect(
      iso(latestOccurrence(d('2026-11-06'), 'WEEKLY', d('2026-11-17'))),
    ).toBe('2026-11-13');
    expect(
      latestOccurrence(d('2026-12-01'), 'MONTHLY', d('2026-11-17')),
    ).toBeNull();
  });

  it('día 31 se ajusta a fin de mes', () => {
    expect(
      iso(latestOccurrence(d('2026-01-31'), 'MONTHLY', d('2026-02-28'))),
    ).toBe('2026-02-28');
  });
});
