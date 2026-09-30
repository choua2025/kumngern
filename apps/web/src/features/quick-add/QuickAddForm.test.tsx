import type { CategoryDto, WalletDto } from '@income-expenses/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { QuickAddForm } from './QuickAddForm';

const wallets: WalletDto[] = [
  {
    id: '1',
    name: 'กสิกร',
    type: 'bank',
    currencyCode: 'THB',
    initialBalance: '0.00',
    balance: '100.00',
    isArchived: false,
    createdAt: '',
  },
  {
    id: '2',
    name: 'เงินสด',
    type: 'cash',
    currencyCode: 'THB',
    initialBalance: '0.00',
    balance: '50.00',
    isArchived: false,
    createdAt: '',
  },
];

const category = (
  id: string,
  name: string,
  type: 'income' | 'expense',
  children: CategoryDto[] = [],
): CategoryDto => ({
  id,
  name,
  type,
  icon: null,
  color: null,
  parentId: null,
  isSystem: true,
  children,
});

const categories: CategoryDto[] = [
  category('10', 'อาหาร', 'expense', [{ ...category('11', 'กาแฟ', 'expense'), parentId: '10' }]),
  category('20', 'เงินเดือน', 'income'),
];

const NOW = new Date('2026-09-30T05:00:00.000Z');

function renderForm(ui: ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('<QuickAddForm>', () => {
  it('records an expense in a few keystrokes: amount → category → Enter', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(
      <QuickAddForm
        wallets={wallets}
        categories={categories}
        onSubmit={onSubmit}
        now={() => NOW}
      />,
    );

    // Amount field is focused on open → user can type immediately
    expect(screen.getByLabelText('จำนวนเงิน')).toHaveFocus();
    await user.keyboard('1,250.5');
    await user.click(screen.getByRole('button', { name: 'กาแฟ' })); // sub-categories are pickable
    expect(screen.getByRole('button', { name: 'บันทึก' })).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith({
      type: 'expense',
      amount: '1250.5', // commas stripped, still a STRING
      categoryId: '11',
      walletId: '1',
      note: null,
      occurredAt: '2026-09-30T05:00:00.000Z',
    });
  });

  it('pre-selects the last used wallet', () => {
    renderForm(
      <QuickAddForm
        wallets={wallets}
        categories={categories}
        defaultWalletId="2"
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('กระเป๋า')).toHaveValue('2');
  });

  it('shows the shared-schema validation messages and does not submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm(<QuickAddForm wallets={wallets} categories={categories} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('จำนวนเงิน'), '12.345');
    await user.click(screen.getByRole('button', { name: 'บันทึก' }));

    expect(
      await screen.findByText('จำนวนเงินไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)'),
    ).toBeInTheDocument();
    expect(screen.getByText('กรุณาเลือกหมวดหมู่')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('switching to income shows only income categories and clears the selection', async () => {
    const user = userEvent.setup();
    renderForm(<QuickAddForm wallets={wallets} categories={categories} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'อาหาร' }));
    await user.click(screen.getByRole('radio', { name: 'รายรับ' }));

    expect(screen.getByRole('button', { name: 'เงินเดือน' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'อาหาร' })).not.toBeInTheDocument();
  });

  it('shows a server error from the API next to the field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError({
        code: 'CONFLICT',
        status: 409,
        message: 'กระเป๋า "กสิกร" ถูก archive แล้ว บันทึกรายการไม่ได้',
      }),
    );
    renderForm(<QuickAddForm wallets={wallets} categories={categories} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('จำนวนเงิน'), '10');
    await user.click(screen.getByRole('button', { name: 'อาหาร' }));
    await user.click(screen.getByRole('button', { name: 'บันทึก' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ถูก archive แล้ว');
  });
});
