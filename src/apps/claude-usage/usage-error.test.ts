import { describe, it, expect } from 'vitest';
import { describeUsageError } from './usage-error';

describe('describeUsageError', () => {
  it('reads a keychain failure as the Mac being signed out', () => {
    const d = describeUsageError('keychain: no accessToken in keychain entry');
    expect(d.label).toBe('signed out on the mac');
    expect(d.detail).toBe('open claude code on the mac to sign in again');
  });

  it('reads a proxy failure as the Mac being unreachable', () => {
    const d = describeUsageError('proxy: connect ECONNREFUSED (stale)');
    expect(d.label).toBe('mac unreachable');
    expect(d.detail).toBe('the usage daemon on the mac did not answer');
  });

  it('reads a network failure as the Mac being offline', () => {
    const d = describeUsageError('network: fetch failed');
    expect(d.label).toBe('mac offline');
    expect(d.detail).toBe('the mac could not reach anthropic');
  });

  it('reads the first poll as waiting', () => {
    expect(describeUsageError('no poll yet').label).toBe('first reading pending');
  });

  it('never leaks the raw error string onto the glass', () => {
    const raw = 'no rate-limit headers (HTTP 429)';
    const d = describeUsageError(raw);
    expect(d.label).toBe('usage unavailable');
    expect(`${d.label} ${d.detail}`).not.toContain('HTTP');
    expect(`${d.label} ${d.detail}`).not.toContain(raw);
  });

  it('copes with no error string at all', () => {
    expect(describeUsageError(undefined).label).toBe('usage unavailable');
  });
});
