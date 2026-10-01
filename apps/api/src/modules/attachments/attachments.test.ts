import type { AttachmentDto, TransactionDetailDto } from '@income-expenses/shared';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { config } from '../../config/index.js';
import { prisma } from '../../lib/prisma.js';
import { registerUser } from '../../test/auth-helpers.js';
import { resetDatabase } from '../../test/db.js';
import {
  type ApiClient,
  apiClient,
  createTransaction,
  createWallet,
  systemCategoryId,
} from '../../test/fixtures.js';
import { cleanFileName } from './attachments.service.js';

const app = createApp();
const API = '/api/v1';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
const PDF = Buffer.from('%PDF-1.7\n% test document\n');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

interface User {
  id: string;
  token: string;
  client: ApiClient;
}
let alice: User;
let bob: User;
let walletId: string;
let food: string;

async function newUser(): Promise<User> {
  const { user, accessToken } = await registerUser(app);
  return { id: user.id, token: accessToken, client: apiClient(app, accessToken) };
}

async function newTransaction(): Promise<TransactionDetailDto> {
  return createTransaction(alice.client, {
    type: 'expense',
    walletId,
    categoryId: food,
    amount: '10',
    occurredAt: new Date().toISOString(),
  });
}

function upload(
  user: User,
  transactionId: string,
  files: { data: Buffer; name: string; contentType?: string }[],
  field = 'files',
) {
  let req = request(app)
    .post(`${API}/transactions/${transactionId}/attachments`)
    .set('Authorization', `Bearer ${user.token}`);
  for (const file of files) {
    req = req.attach(field, file.data, {
      filename: file.name,
      contentType: file.contentType ?? 'application/octet-stream',
    });
  }
  return req;
}

/** Files on disk for one user — proves nothing is left behind after a failure. */
async function filesOnDisk(userId: string): Promise<string[]> {
  try {
    return await readdir(path.join(config.UPLOAD_DIR, userId));
  } catch {
    return [];
  }
}

beforeAll(async () => {
  await resetDatabase();
  await rm(config.UPLOAD_DIR, { recursive: true, force: true });
  alice = await newUser();
  bob = await newUser();
  walletId = (await createWallet(alice.client)).id;
  food = await systemCategoryId('อาหาร', 'expense');
});

afterAll(async () => {
  await rm(config.UPLOAD_DIR, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('upload, download, delete', () => {
  it('stores files, lists them on the transaction and streams them back unchanged', async () => {
    const tx = await newTransaction();

    const res = await upload(alice, tx.id, [
      { data: JPEG, name: 'ใบเสร็จ 7-11.jpg', contentType: 'image/jpeg' },
      { data: PDF, name: 'invoice.pdf' }, // wrong Content-Type: detected from the bytes
    ]);

    expect(res.status).toBe(201);
    const created = res.body.data as AttachmentDto[];
    expect(created.map((a) => [a.originalName, a.mimeType, a.sizeBytes])).toEqual([
      ['ใบเสร็จ 7-11.jpg', 'image/jpeg', JPEG.length],
      ['invoice.pdf', 'application/pdf', PDF.length],
    ]);

    const detail = (await alice.client.get(`/transactions/${tx.id}`)).body
      .data as TransactionDetailDto;
    expect(detail.attachmentCount).toBe(2);
    expect(detail.attachments.map((a) => a.id)).toEqual(created.map((a) => a.id));

    const file = await alice.client
      .get(`/attachments/${created[0]?.id}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.headers['cache-control']).toBe('private, max-age=0');
    expect(file.headers['content-disposition']).toBe(
      `inline; filename*=UTF-8''${encodeURIComponent('ใบเสร็จ 7-11.jpg')}`,
    );
    expect(Buffer.compare(file.body as Buffer, JPEG)).toBe(0);

    // Stored under <userId>/<uuid>.<ext> — never the client's filename.
    const stored = await filesOnDisk(alice.id);
    expect(stored).toHaveLength(2);
    expect(stored.every((name) => /^[0-9a-f-]{36}\.(jpg|pdf)$/.test(name))).toBe(true);
  });

  it('deletes the record and the file', async () => {
    const tx = await newTransaction();
    const [attachment] = (await upload(alice, tx.id, [{ data: PNG, name: 'a.png' }])).body
      .data as AttachmentDto[];
    const before = await filesOnDisk(alice.id);

    await alice.client.delete(`/attachments/${attachment?.id}`).expect(204);

    expect(await filesOnDisk(alice.id)).toHaveLength(before.length - 1);
    expect((await alice.client.get(`/attachments/${attachment?.id}`)).status).toBe(404);
    expect((await alice.client.delete(`/attachments/${attachment?.id}`)).status).toBe(404);
  });

  it('answers 404 when the file is missing on disk', async () => {
    const tx = await newTransaction();
    const [attachment] = (await upload(alice, tx.id, [{ data: PNG, name: 'gone.png' }])).body
      .data as AttachmentDto[];
    const row = await prisma.attachment.findUniqueOrThrow({
      where: { id: BigInt(attachment?.id ?? '0') },
    });
    await rm(path.join(config.UPLOAD_DIR, row.storageKey));

    expect((await alice.client.get(`/attachments/${attachment?.id}`)).status).toBe(404);
  });
});

describe('upload validation', () => {
  it('rejects a file whose bytes are not an allowed type, even if it claims to be', async () => {
    const tx = await newTransaction();
    const before = await filesOnDisk(alice.id);

    const res = await upload(alice, tx.id, [
      { data: Buffer.from('<script>alert(1)</script>'), name: 'x.jpg', contentType: 'image/jpeg' },
    ]);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/ไม่รองรับ/);
    expect(await filesOnDisk(alice.id)).toEqual(before);
  });

  it('rejects files over 5 MB', async () => {
    const tx = await newTransaction();
    const big = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await upload(alice, tx.id, [{ data: big, name: 'big.jpg' }]);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/5 MB/);
  });

  it('allows at most 3 per transaction (409) and 3 per request (400)', async () => {
    const tx = await newTransaction();
    const one = { data: PNG, name: 'p.png' };

    expect((await upload(alice, tx.id, [one, one])).status).toBe(201);
    const before = await filesOnDisk(alice.id);
    expect((await upload(alice, tx.id, [one, one])).status).toBe(409);
    expect(await filesOnDisk(alice.id)).toEqual(before);
    expect((await upload(alice, tx.id, [one])).status).toBe(201);

    const other = await newTransaction();
    expect((await upload(alice, other.id, [one, one, one, one])).status).toBe(400);
  });

  it('never exceeds 3 when uploads race (row lock), and leaves no orphan files', async () => {
    const tx = await newTransaction();
    const transactionId = BigInt(tx.id);
    const before = await filesOnDisk(alice.id);

    // Another "request" holds the transaction row lock and adds 2 attachments.
    const { pending } = await prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT 1 FROM transactions WHERE transaction_id = ${transactionId} FOR UPDATE`;
      // Supertest only sends on .then(); Promise.resolve starts it now.
      const pending = Promise.resolve(
        upload(alice, tx.id, [
          { data: PNG, name: 'a.png' },
          { data: PNG, name: 'b.png' },
        ]),
      );
      // Wait until the upload is blocked on our lock (gives up after ~3 s: then the
      // service did NOT lock, and the count check below fails the test).
      for (let i = 0; i < 60; i += 1) {
        const [row] = await prisma.$queryRaw<{ waiting: bigint }[]>`
          SELECT count(*) AS waiting FROM pg_stat_activity
          WHERE wait_event_type = 'Lock' AND datname = current_database()`;
        if (row && row.waiting > 0n) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      for (const name of ['x.png', 'y.png']) {
        await db.attachment.create({
          data: {
            transactionId,
            storageKey: `fake/${name}`,
            originalName: name,
            mimeType: 'image/png',
            sizeBytes: 1,
          },
        });
      }
      // Wrapped: returning the promise itself would make the commit wait for the upload.
      return { pending };
    });
    const res = await pending; // continues once our transaction has committed

    expect(res.status).toBe(409);
    expect(await prisma.attachment.count({ where: { transactionId } })).toBe(2);
    // The files written before the lock were removed again.
    expect(await filesOnDisk(alice.id)).toEqual(before);
  });

  it('requires at least one file in the "files" field', async () => {
    const tx = await newTransaction();
    expect((await upload(alice, tx.id, [])).status).toBe(400);
    expect((await upload(alice, tx.id, [{ data: PNG, name: 'a.png' }], 'file')).status).toBe(400);
  });

  it('rejects uploads to a deleted transaction (404)', async () => {
    const tx = await newTransaction();
    await alice.client.delete(`/transactions/${tx.id}`).expect(204);
    expect((await upload(alice, tx.id, [{ data: PNG, name: 'a.png' }])).status).toBe(404);
  });

  it('requires authentication before reading the upload', async () => {
    const res = await request(app)
      .post(`${API}/transactions/1/attachments`)
      .attach('files', PNG, 'a.png');
    expect(res.status).toBe(401);
  });
});

describe('attachments data isolation', () => {
  it("cannot read, delete or add to another user's attachments (404)", async () => {
    const tx = await newTransaction();
    const [attachment] = (await upload(alice, tx.id, [{ data: PDF, name: 'secret.pdf' }])).body
      .data as AttachmentDto[];

    expect((await bob.client.get(`/attachments/${attachment?.id}`)).status).toBe(404);
    expect((await bob.client.delete(`/attachments/${attachment?.id}`)).status).toBe(404);
    expect((await upload(bob, tx.id, [{ data: PNG, name: 'x.png' }])).status).toBe(404);
    expect(await filesOnDisk(bob.id)).toEqual([]);
    expect((await alice.client.get(`/attachments/${attachment?.id}`)).status).toBe(200);
  });
});

describe('cleanFileName', () => {
  it('keeps only a safe display name', () => {
    expect(cleanFileName('../../etc/passwd', 'pdf')).toBe('passwd');
    expect(cleanFileName('C:\\Users\\me\\ใบเสร็จ.jpg', 'jpg')).toBe('ใบเสร็จ.jpg');
    expect(cleanFileName('bad\u0000name\n.png', 'png')).toBe('badname.png');
    expect(cleanFileName('   ', 'png')).toBe('file.png');
    expect(cleanFileName(`${'a'.repeat(300)}.pdf`, 'pdf')).toHaveLength(255);
  });
});
