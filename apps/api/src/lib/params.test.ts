import { describe, expect, it } from 'vitest';
import { escapeLikePattern } from './params.js';

describe('escapeLikePattern', () => {
  it('escapes %, _ and the escape character itself', () => {
    expect(escapeLikePattern('100%')).toBe(String.raw`100\%`);
    expect(escapeLikePattern('a_b')).toBe(String.raw`a\_b`);
    expect(escapeLikePattern(String.raw`C:\temp`)).toBe(String.raw`C:\\temp`);
    expect(escapeLikePattern('ข้าวมันไก่')).toBe('ข้าวมันไก่');
  });
});
