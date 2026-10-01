import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('keeps paths inside the app', () => {
    expect(safeRedirectPath('/transactions?type=expense')).toBe('/transactions?type=expense');
    expect(safeRedirectPath('/')).toBe('/');
  });

  it('falls back for anything that could leave the site', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/');
    expect(safeRedirectPath('/\\evil.com')).toBe('/');
    expect(safeRedirectPath('https://evil.com')).toBe('/');
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/');
    expect(safeRedirectPath(undefined)).toBe('/');
    expect(safeRedirectPath({ pathname: '/x' })).toBe('/');
  });
});
