import {
  type AttachmentDto,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_TRANSACTION,
} from '@income-expenses/shared';
import type { ReadStream } from 'node:fs';
import { runInTransaction, type TransactionRunner } from '../../lib/db.js';
import { errors } from '../../lib/errors.js';
import { type DetectedFileType, detectFileType } from '../../lib/file-type.js';
import { type FileStorage, fileStorage } from '../../lib/file-storage.js';
import { logger as rootLogger } from '../../lib/logger.js';
import {
  type AttachmentRow,
  type AttachmentsRepository,
  attachmentsRepository,
} from './attachments.repository.js';

export interface UploadedFile {
  originalName: string;
  buffer: Buffer;
}

const NOT_FOUND = 'errors.attachmentNotFound';
const TOO_MANY = 'errors.tooManyAttachments';
const TOO_MANY_PARAMS = { max: MAX_ATTACHMENTS_PER_TRANSACTION };

export function toAttachmentDto(row: AttachmentRow): AttachmentDto {
  return {
    id: row.id.toString(),
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

/**
 * The client's filename is only for display: keep the last path segment, drop control
 * characters, cap at the column length. It is never used as a path on disk.
 */
export function cleanFileName(name: string, fallbackExtension: string): string {
  const lastSegment = name.split(/[/\\]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex -- removing control characters is the point
  const cleaned = lastSegment.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (cleaned === '') {
    return `file.${fallbackExtension}`;
  }
  return cleaned.length > 255 ? cleaned.slice(-255) : cleaned;
}

interface AttachmentsServiceDeps {
  attachments: AttachmentsRepository;
  storage: FileStorage;
  transaction: TransactionRunner;
  logger: Pick<typeof rootLogger, 'warn' | 'error'>;
}

export function createAttachmentsService(deps: AttachmentsServiceDeps) {
  const { attachments, storage, transaction, logger } = deps;

  async function getOwnedOrThrow(userId: bigint, attachmentId: bigint): Promise<AttachmentRow> {
    const row = await attachments.findOwned(userId, attachmentId);
    if (!row) {
      throw errors.notFound(NOT_FOUND);
    }
    return row;
  }

  return {
    async upload(
      userId: bigint,
      transactionId: bigint,
      files: UploadedFile[],
    ): Promise<AttachmentDto[]> {
      if (files.length === 0) {
        throw errors.validation('errors.noFiles');
      }

      // 1. Validate everything BEFORE touching the disk.
      const detected: { file: UploadedFile; type: DetectedFileType }[] = [];
      for (const file of files) {
        // multer enforces this too; kept so the service is safe on its own.
        if (file.buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
          throw errors.validation('errors.namedFileTooLarge', undefined, {
            name: file.originalName,
          });
        }
        const type = detectFileType(file.buffer);
        if (!type) {
          throw errors.validation('errors.fileTypeUnsupported', undefined, {
            name: file.originalName,
          });
        }
        detected.push({ file, type });
      }

      // Cheap pre-check so an obvious 404/409 does not write files for nothing.
      const existing = await attachments.countForOwnedTransaction(userId, transactionId);
      if (existing === null) {
        throw errors.notFound('errors.transactionNotFound');
      }
      if (existing + files.length > MAX_ATTACHMENTS_PER_TRANSACTION) {
        throw errors.conflict(TOO_MANY, TOO_MANY_PARAMS);
      }

      // 2. Write the files, 3. insert the rows under a lock. If anything fails after
      //    a file was written, remove the files — no orphans on disk.
      const written: string[] = [];
      try {
        for (const { file, type } of detected) {
          written.push(await storage.save(userId, file.buffer, type.extension));
        }

        const rows = await transaction(async (tx) => {
          if (!(await attachments.lockActiveTransaction(userId, transactionId, tx))) {
            throw errors.notFound('errors.transactionNotFound');
          }
          const count = await attachments.countForTransaction(transactionId, tx);
          if (count + files.length > MAX_ATTACHMENTS_PER_TRANSACTION) {
            throw errors.conflict(TOO_MANY, TOO_MANY_PARAMS);
          }
          const created: AttachmentRow[] = [];
          for (const [index, { file, type }] of detected.entries()) {
            created.push(
              await attachments.create(
                {
                  transactionId,
                  storageKey: written[index] ?? '',
                  originalName: cleanFileName(file.originalName, type.extension),
                  mimeType: type.mimeType,
                  sizeBytes: file.buffer.length,
                },
                tx,
              ),
            );
          }
          return created;
        });
        return rows.map(toAttachmentDto);
      } catch (error) {
        await Promise.all(
          written.map((key) =>
            storage.remove(key).catch((removeError: unknown) => {
              logger.warn({ err: removeError, storageKey: key }, 'Could not remove orphan file');
            }),
          ),
        );
        throw error;
      }
    },

    async open(
      userId: bigint,
      attachmentId: bigint,
    ): Promise<{ attachment: AttachmentDto; stream: ReadStream }> {
      const row = await getOwnedOrThrow(userId, attachmentId);
      if (!(await storage.exists(row.storageKey))) {
        // The record points at nothing — worth an alert, but to the client it is just gone.
        logger.error(
          { attachmentId: row.id.toString(), storageKey: row.storageKey },
          'Attachment file missing on disk',
        );
        throw errors.notFound(NOT_FOUND);
      }
      return { attachment: toAttachmentDto(row), stream: storage.openReadStream(row.storageKey) };
    },

    /**
     * Record first, then the file: if removing the file fails we only leave an orphan
     * file (harmless, can be swept), never a record that points at a missing file.
     */
    async delete(userId: bigint, attachmentId: bigint): Promise<void> {
      const row = await getOwnedOrThrow(userId, attachmentId);
      if (!(await attachments.delete(userId, attachmentId))) {
        throw errors.notFound(NOT_FOUND);
      }
      try {
        await storage.remove(row.storageKey);
      } catch (error) {
        logger.warn({ err: error, storageKey: row.storageKey }, 'Could not remove attachment file');
      }
    },
  };
}

export type AttachmentsService = ReturnType<typeof createAttachmentsService>;
export const attachmentsService = createAttachmentsService({
  attachments: attachmentsRepository,
  storage: fileStorage,
  transaction: runInTransaction,
  logger: rootLogger,
});
