import { describe, expect, it } from 'vitest';
import { civilDay, dayStartUTC, normalizeTimeZone, observesDst } from '../src/lib/time.ts';

const LA = 'America/Los_Angeles';

describe('civilDay', () => {
  it('resolves the civil date in the given timezone', () => {
    // 03:00 UTC on Jun 18 is still Jun 17 in Pacific (20:00 PDT the previous evening).
    const t = new Date('2026-06-18T03:00:00Z');
    expect(civilDay(t, 'UTC')).toBe('2026-06-18');
    expect(civilDay(t, LA)).toBe('2026-06-17');
    expect(civilDay(t, 'Asia/Tokyo')).toBe('2026-06-18');
  });
});

describe('dayStartUTC', () => {
  it('returns UTC midnight for the UTC zone', () => {
    expect(dayStartUTC(new Date('2026-06-18T12:00:00Z'), 'UTC').toISOString()).toBe(
      '2026-06-18T00:00:00.000Z',
    );
  });

  it('returns the UTC instant of local midnight for an offset zone', () => {
    // Pacific in June is PDT (UTC-7), so midnight Pacific is 07:00 UTC.
    expect(dayStartUTC(new Date('2026-06-18T15:00:00Z'), LA).toISOString()).toBe(
      '2026-06-18T07:00:00.000Z',
    );
  });

  it('handles the fall-back DST day as 25 hours long', () => {
    // Nov 2 2025: clocks fall back 02:00 PDT -> 01:00 PST. Midnight Nov 2 is PDT
    // (07:00 UTC); midnight Nov 3 is PST (08:00 UTC) — 25h apart.
    const nov2 = dayStartUTC(new Date('2025-11-02T20:00:00Z'), LA);
    const nov3 = dayStartUTC(new Date('2025-11-03T20:00:00Z'), LA);
    expect(nov2.toISOString()).toBe('2025-11-02T07:00:00.000Z');
    expect(nov3.toISOString()).toBe('2025-11-03T08:00:00.000Z');
    expect(nov3.getTime() - nov2.getTime()).toBe(25 * 3600 * 1000);
  });

  it('handles the spring-forward DST day as 23 hours long', () => {
    // Mar 9 2025: clocks spring forward 02:00 PST -> 03:00 PDT. Midnight Mar 9 is PST
    // (08:00 UTC); midnight Mar 10 is PDT (07:00 UTC) — 23h apart.
    const mar9 = dayStartUTC(new Date('2025-03-09T20:00:00Z'), LA);
    const mar10 = dayStartUTC(new Date('2025-03-10T20:00:00Z'), LA);
    expect(mar9.toISOString()).toBe('2025-03-09T08:00:00.000Z');
    expect(mar10.toISOString()).toBe('2025-03-10T07:00:00.000Z');
    expect(mar10.getTime() - mar9.getTime()).toBe(23 * 3600 * 1000);
  });
});

describe('observesDst', () => {
  it('detects DST zones', () => {
    expect(observesDst(LA)).toBe(true);
    expect(observesDst('Europe/London')).toBe(true);
  });
  it('is false for fixed-offset zones', () => {
    expect(observesDst('UTC')).toBe(false);
    expect(observesDst('America/Phoenix')).toBe(false); // Arizona: no DST
    expect(observesDst('Asia/Tokyo')).toBe(false);
  });
});

describe('normalizeTimeZone', () => {
  it('passes through valid IANA names', () => {
    expect(normalizeTimeZone(LA)).toBe(LA);
    expect(normalizeTimeZone('Europe/Berlin')).toBe('Europe/Berlin');
  });
  it('falls back to UTC for missing or invalid names', () => {
    expect(normalizeTimeZone(undefined)).toBe('UTC');
    expect(normalizeTimeZone('')).toBe('UTC');
    expect(normalizeTimeZone('Not/ARealZone')).toBe('UTC');
  });
});
