import { describe, expect, it } from 'vitest';
import { detectFileType } from './file-type.js';

const bytes = (...values: number[]) => Buffer.from(values);

describe('detectFileType', () => {
  it('recognises the allowed types by their magic bytes', () => {
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))?.mimeType).toBe('image/jpeg');
    expect(
      detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))?.mimeType,
    ).toBe('image/png');
    expect(detectFileType(Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'latin1'))).toEqual({
      mimeType: 'image/webp',
      extension: 'webp',
    });
    expect(detectFileType(Buffer.from('%PDF-1.7\n'))?.extension).toBe('pdf');
  });

  it('rejects everything else, whatever the file is called', () => {
    expect(detectFileType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectFileType(Buffer.from('MZ\x90\x00', 'latin1'))).toBeNull(); // Windows .exe
    expect(detectFileType(Buffer.from('RIFF\x10\x00\x00\x00WAVE', 'latin1'))).toBeNull(); // audio
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });
});
