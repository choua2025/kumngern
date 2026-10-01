import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { api } from '../../api/client';
import { renderPage } from '../../test/render-page';
import { RecurringFormModal } from './RecurringFormModal';

const wallets = [
  { id: '1', name: 'เงินสด', type: 'cash', currencyCode: 'THB', isArchived: false },
  { id: '2', name: 'เก่า', type: 'cash', currencyCode: 'THB', isArchived: true },
];
const categories = [
  {
    id: '10',
    name: 'ที่พัก',
    type: 'expense',
    icon: null,
    color: null,
    parentId: null,
    isSystem: true,
    children: [],
  },
  {
    id: '20',
    name: 'เงินเดือน',
    type: 'income',
    icon: null,
    color: null,
    parentId: null,
    isSystem: true,
    children: [],
  },
];

let posted: unknown[] = [];

function fakeApi(): void {
  posted = [];
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    let data: unknown = [];
    if (url.startsWith('/wallets')) data = wallets;
    if (url.startsWith('/categories')) data = categories;
    if (config.method === 'post') {
      posted.push(JSON.parse(String(config.data)));
      data = {};
    }
    return Promise.resolve({
      status: 200,
      statusText: '',
      headers: {},
      config,
      data: { data },
    } as AxiosResponse);
  };
  api.defaults.adapter = adapter;
}

const originalAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

describe('RecurringFormModal', () => {
  it('blocks day 29-31 for monthly before calling the API', async () => {
    fakeApi();
    const user = userEvent.setup();
    renderPage(<RecurringFormModal open recurring={null} onClose={() => undefined} />);

    await screen.findByRole('option', { name: /เงินสด/ });
    await user.selectOptions(screen.getByLabelText('กระเป๋า'), '1');
    await user.selectOptions(await screen.findByLabelText('หมวดหมู่'), '10');
    await user.type(screen.getByLabelText('จำนวนเงิน'), '5,500');
    const start = screen.getByLabelText('เริ่มวันที่');
    await user.clear(start);
    await user.type(start, '2099-01-31');
    await user.click(screen.getByRole('button', { name: 'สร้างรายการประจำ' }));

    expect(await screen.findByText(/ต้องเริ่มวันที่ 1-28/)).toBeInTheDocument();
    expect(posted).toEqual([]);
  });

  it('hides archived wallets and sends null for empty optional fields', async () => {
    fakeApi();
    const user = userEvent.setup();
    renderPage(<RecurringFormModal open recurring={null} onClose={() => undefined} />);

    const walletSelect = await screen.findByLabelText('กระเป๋า');
    await waitFor(() => expect(screen.getByRole('option', { name: /เงินสด/ })).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: /เก่า/ })).not.toBeInTheDocument();

    await user.selectOptions(walletSelect, '1');
    await user.selectOptions(screen.getByLabelText('หมวดหมู่'), '10');
    await user.type(screen.getByLabelText('จำนวนเงิน'), '5,500');
    const start = screen.getByLabelText('เริ่มวันที่');
    await user.clear(start);
    await user.type(start, '2099-01-15');
    await user.click(screen.getByRole('button', { name: 'สร้างรายการประจำ' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({
      type: 'expense',
      walletId: '1',
      categoryId: '10',
      amount: '5500',
      note: null,
      frequency: 'monthly',
      nextRunDate: '2099-01-15',
      endDate: null,
    });
  });
});
