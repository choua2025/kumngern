import { pipeline } from 'node:stream/promises';
import { asyncHandler } from '../../lib/async-handler.js';
import { currentUserId } from '../../middlewares/auth.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import type { attachmentIdRequest, uploadAttachmentsRequest } from './attachments.schema.js';
import { attachmentsService } from './attachments.service.js';

/** RFC 5987 encoding for non-ASCII filenames: filename*=UTF-8''%E0%B8%... */
function encodeFilename(name: string): string {
  return encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export const attachmentsController = {
  upload: asyncHandler<ValidatedRequest<typeof uploadAttachmentsRequest>>(async (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    const created = await attachmentsService.upload(
      currentUserId(req),
      req.params.id,
      files.map((file) => ({ originalName: file.originalname, buffer: file.buffer })),
    );
    res.status(201).json({ data: created });
  }),

  download: asyncHandler<ValidatedRequest<typeof attachmentIdRequest>>(async (req, res) => {
    const { attachment, stream } = await attachmentsService.open(currentUserId(req), req.params.id);
    // Content-Type comes from the DB (detected from magic bytes), never from the client.
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', String(attachment.sizeBytes));
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeFilename(attachment.originalName)}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=0');
    await pipeline(stream, res);
  }),

  delete: asyncHandler<ValidatedRequest<typeof attachmentIdRequest>>(async (req, res) => {
    await attachmentsService.delete(currentUserId(req), req.params.id);
    res.status(204).end();
  }),
};
