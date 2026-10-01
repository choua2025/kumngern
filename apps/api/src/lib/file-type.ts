import type { AttachmentMimeType } from '@income-expenses/shared';

export interface DetectedFileType {
  mimeType: AttachmentMimeType;
  extension: 'jpg' | 'png' | 'webp' | 'pdf';
}

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/**
 * Identifies a file from its first bytes ("magic numbers"). The client's Content-Type
 * and file extension are NOT trusted — both are just strings the client chose.
 * Returns null for anything outside the allow-list (chk_att_mime).
 */
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  // "RIFF" <4-byte size> "WEBP"
  if (startsWith(buffer, ascii('RIFF')) && startsWith(buffer, ascii('WEBP'), 8)) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (startsWith(buffer, ascii('%PDF-'))) {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }
  return null;
}
