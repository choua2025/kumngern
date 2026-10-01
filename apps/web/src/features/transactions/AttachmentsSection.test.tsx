import type { AxiosAdapter, AxiosResponse } from 'axios';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import { renderPage } from '../../test/render-page';
import { AttachmentsSection, checkFiles } from './AttachmentsSection';

const file = (name: string, type: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type });

describe('checkFiles', () => {
  it('catches count, size and type before uploading', () => {
    expect(checkFiles([file('a.jpg', 'image/jpeg')], 0)).toBeNull();
    expect(checkFiles([file('a.jpg', 'image/jpeg'), file('b.pdf', 'application/pdf')], 2)).toMatch(
      /สูงสุด 3/,
    );
    expect(checkFiles([file('big.png', 'image/png', 5 * 1024 * 1024 + 1)], 0)).toMatch(/5 MB/);
    expect(checkFiles([file('x.svg', 'image/svg+xml')], 0)).toMatch(/ไม่รองรับ/);
  });
});

describe('AttachmentsSection', () => {
  const createObjectURL = vi.fn(() => 'blob:thumb-1');
  const revokeObjectURL = vi.fn();
  let uploads: FormData[] = [];

  beforeEach(() => {
    uploads = [];
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    // jsdom has no object URLs
    Object.assign(URL, { createObjectURL, revokeObjectURL });

    const adapter: AxiosAdapter = (config) => {
      const url = config.url ?? '';
      let data: unknown = null;
      if (url === '/transactions/5') {
        data = {
          data: {
            id: '5',
            attachments: [
              {
                id: '7',
                originalName: 'ใบเสร็จ.jpg',
                mimeType: 'image/jpeg',
                sizeBytes: 245_120,
                uploadedAt: '2026-10-01T00:00:00Z',
              },
              {
                id: '8',
                originalName: 'invoice.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 2_200_000,
                uploadedAt: '2026-10-01T00:00:00Z',
              },
            ],
          },
        };
      } else if (url === '/attachments/7') {
        data = new Blob(['jpeg']);
      } else if (config.method === 'post') {
        uploads.push(config.data as FormData);
        data = { data: [] };
      }
      return Promise.resolve({
        status: 200,
        statusText: '',
        headers: {},
        config,
        data,
      } as AxiosResponse);
    };
    api.defaults.adapter = adapter;
  });

  const originalAdapter = api.defaults.adapter;
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('shows image thumbnails through a blob URL and revokes it on unmount', async () => {
    const view = renderPage(<AttachmentsSection transactionId="5" />);

    expect(await screen.findByText('ใบเสร็จ.jpg')).toBeInTheDocument();
    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.1 MB')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ไฟล์แนบ (2/3)' })).toBeInTheDocument();
    // Only the image is fetched for a thumbnail, never the PDF.
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));

    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:thumb-1');
  });

  it('uploads picked files as multipart field "files"', async () => {
    const user = userEvent.setup();
    renderPage(<AttachmentsSection transactionId="5" />);
    await screen.findByText('ใบเสร็จ.jpg');

    await user.upload(screen.getByLabelText('เลือกไฟล์แนบ'), file('new.png', 'image/png'));

    await waitFor(() => expect(uploads).toHaveLength(1));
    const sent = uploads[0]?.getAll('files') as File[];
    expect(sent.map((f) => f.name)).toEqual(['new.png']);
  });

  it('refuses a 4th file without calling the API', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage(<AttachmentsSection transactionId="5" />);
    await screen.findByText('ใบเสร็จ.jpg');

    await user.upload(screen.getByLabelText('เลือกไฟล์แนบ'), [
      file('a.png', 'image/png'),
      file('b.png', 'image/png'),
    ]);

    expect(await screen.findByRole('alert')).toHaveTextContent(/สูงสุด 3/);
    expect(uploads).toEqual([]);
  });
});
