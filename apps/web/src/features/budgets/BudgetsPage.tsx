import type { BudgetDto } from '@income-expenses/shared';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useBudgets, useCopyBudgets, useDeleteBudget } from '../../api/budgets';
import { errorMessage } from '../../api/errors';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Money } from '../../components/Money';
import { MonthPicker } from '../../components/MonthPicker';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { useToast } from '../../components/toast';
import { currentMonthIn, formatMonthLong } from '../../lib/date';
import { sumMoney } from '../../lib/money';
import { useCurrentUser } from '../auth/auth-context';
import { BudgetFormModal } from './BudgetFormModal';
import { BudgetProgress } from './BudgetProgress';

export function BudgetsPage() {
  const user = useCurrentUser();
  const [month, setMonth] = useState(() => currentMonthIn(user.timezone));
  const budgets = useBudgets(month);
  const copyBudgets = useCopyBudgets();
  const deleteBudget = useDeleteBudget();
  const toast = useToast();
  const [editing, setEditing] = useState<BudgetDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<BudgetDto | null>(null);

  const copyFromLastMonth = async () => {
    try {
      const result = await copyBudgets.mutateAsync(month);
      toast.show(
        result.copied === 0 && result.skipped === 0
          ? 'เดือนก่อนไม่มีงบให้คัดลอก'
          : `คัดลอก ${result.copied} หมวด${result.skipped ? ` (ข้าม ${result.skipped} หมวดที่มีงบอยู่แล้ว)` : ''}`,
      );
    } catch (error) {
      toast.show(errorMessage(error), { tone: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteBudget.mutateAsync(deleting.id);
      toast.show(`ลบงบ${deleting.category.name}แล้ว`);
    } catch (error) {
      toast.show(errorMessage(error), { tone: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const list = budgets.data ?? [];
  const currency = list[0]?.currencyCode ?? user.defaultCurrency;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">งบประมาณ</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden /> ตั้งงบ
        </Button>
        <Button
          variant="secondary"
          loading={copyBudgets.isPending}
          onClick={() => void copyFromLastMonth()}
        >
          <Copy className="size-4" aria-hidden /> คัดลอกจากเดือนก่อน
        </Button>
      </div>

      {budgets.isPending ? (
        <Card>
          <LoadingRows rows={4} />
        </Card>
      ) : budgets.isError ? (
        <ErrorState error={budgets.error} onRetry={() => void budgets.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          title={`ยังไม่ได้ตั้งงบของ${formatMonthLong(month)}`}
          description="ตั้งงบรายหมวด หรือคัดลอกงบจากเดือนก่อนมาใช้ได้ในคลิกเดียว"
        />
      ) : (
        <>
          <Card>
            <div className="grid gap-4 text-center sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">ใช้ไปแล้ว</p>
                <p className="text-2xl font-bold">
                  <Money amount={sumMoney(list.map((b) => b.spent))} currency={currency} />
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">จากงบรวม</p>
                <p className="text-2xl font-bold">
                  <Money amount={sumMoney(list.map((b) => b.limitAmount))} currency={currency} />
                </p>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              นับเฉพาะรายจ่ายจากกระเป๋าสกุล {currency} · งบของหมวดหลักรวมหมวดย่อยด้วย
            </p>
          </Card>

          <Card>
            <ul className="space-y-6">
              {list.map((budget) => (
                <li key={budget.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <BudgetProgress budget={budget} />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(budget)}
                    aria-label={`แก้ไขงบ${budget.category.name}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleting(budget)}
                    aria-label={`ลบงบ${budget.category.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <BudgetFormModal
        key={editing === 'new' ? `new-${month}` : (editing?.id ?? 'closed')}
        open={editing !== null}
        budget={editing === 'new' ? null : editing}
        month={month}
        takenCategoryIds={list.map((b) => b.category.id)}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="ลบงบประมาณ"
        message={`ลบงบ${deleting?.category.name ?? ''} ของ${formatMonthLong(month)}? รายการที่บันทึกไว้จะไม่หายไป`}
        loading={deleteBudget.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
