import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.js';

/**
 * Attachment files on local disk (a Docker volume in production).
 * Keys look like "<userId>/<uuid>.<ext>": the server picks the name, so a client
 * filename such as "../../etc/passwd" never reaches the filesystem.
 */
export function createFileStorage(root: string) {
  const base = path.resolve(root);

  /** Defence in depth: a key from the DB must still resolve INSIDE the root. */
  function resolveKey(key: string): string {
    const fullPath = path.resolve(base, key);
    if (!fullPath.startsWith(base + path.sep)) {
      throw new Error(`Storage key escapes the upload directory: ${key}`);
    }
    return fullPath;
  }

  return {
    async save(userId: bigint, data: Buffer, extension: string): Promise<string> {
      const key = `${userId.toString()}/${randomUUID()}.${extension}`;
      const fullPath = resolveKey(key);
      await mkdir(path.dirname(fullPath), { recursive: true });
      // 'wx' fails instead of overwriting if the name somehow exists.
      await writeFile(fullPath, data, { flag: 'wx' });
      return key;
    },

    /** Missing files are fine (already removed). */
    async remove(key: string): Promise<void> {
      await rm(resolveKey(key), { force: true });
    },

    async exists(key: string): Promise<boolean> {
      try {
        return (await stat(resolveKey(key))).isFile();
      } catch {
        return false;
      }
    },

    openReadStream(key: string): ReadStream {
      return createReadStream(resolveKey(key));
    },
  };
}

export type FileStorage = ReturnType<typeof createFileStorage>;
export const fileStorage = createFileStorage(config.UPLOAD_DIR);
