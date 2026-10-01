import {
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_TRANSACTION,
} from '@income-expenses/shared';
import multer from 'multer';

/**
 * Multipart parser for attachments. Files are kept in memory (≤ 3 × 5 MB) so the
 * magic bytes can be checked BEFORE anything is written to disk.
 * Mount it AFTER requireAuth: an anonymous client must not make us buffer uploads.
 */
export const uploadAttachments = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_BYTES,
    files: MAX_ATTACHMENTS_PER_TRANSACTION,
    fields: 5,
    parts: MAX_ATTACHMENTS_PER_TRANSACTION + 5,
  },
  // Browsers send UTF-8 filenames ("ใบเสร็จ.jpg"); the default would decode them as latin1.
  defParamCharset: 'utf8',
}).array('files', MAX_ATTACHMENTS_PER_TRANSACTION);
