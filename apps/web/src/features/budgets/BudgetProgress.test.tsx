import type { BudgetDto } from '@income-expenses/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BudgetProgress } from './BudgetProgress';

function budget(overrides: Partial<BudgetDto>): BudgetDto {
  return {
    id: '1',
    month: '2026-09',
    // A system category: the name shown comes from systemKey in the UI language.
    category: {
      id: '10',
      name: 'อาหาร',
      systemKey: 'food',
      icon: 'utensils',
      color: '#F97316',
      parentId: null,
    },
    limitAmount: '6000.00',
    alertPercent: 80,
    spent: '0.00',
    remaining: '6000.00',
    usedPercent: 0,
    status: 'ok',
    currencyCode: 'THB',
    ...overrides,
  };
}

function renderBudget(value: BudgetDto) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <BudgetProgress budget={value} />
    </QueryClientProvider>,
  );
}

describe('<BudgetProgress>', () => {
  it('ok: shows spent / limit, remaining and an accessible progress bar', () => {
    renderBudget(budget({ spent: '1500.00', remaining: '4500.00', usedPercent: 25 }));

    expect(screen.getByText('อยู่ในงบ')).toBeInTheDocument();
    expect(screen.getByText('฿1,500.00 / ฿6,000.00')).toBeInTheDocument();
    expect(screen.getByText('เหลือ ฿4,500.00')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'งบอาหาร' });
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuetext', 'ใช้ไป 25% อยู่ในงบ');
  });

  it('warning: labels the state in text, not only by colour', () => {
    renderBudget(
      budget({ spent: '5100.00', remaining: '900.00', usedPercent: 85, status: 'warning' }),
    );

    expect(screen.getByText('ใกล้เกินงบ')).toBeInTheDocument();
    expect(screen.getByText('ใช้ไป 85%')).toBeInTheDocument();
  });

  it('over: caps the bar at 100% and says by how much the budget is exceeded', () => {
    renderBudget(
      budget({ spent: '7500.00', remaining: '-1500.00', usedPercent: 125, status: 'over' }),
    );

    expect(screen.getAllByText(/เกินงบ/)[0]).toBeInTheDocument();
    expect(screen.getByText('เกินงบ ฿1,500.00')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' });
  });
});
