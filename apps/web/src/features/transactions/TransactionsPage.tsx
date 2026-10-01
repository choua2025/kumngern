import type { TransactionDto } from '@income-expenses/shared';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Paperclip,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { flattenCategories, useCategories } from '../../api/categories';
import { errorMessage } from '../../api/errors';
import {
  useDeleteTransaction,
  useRestoreTransaction,
  useTransactions,
} from '../../api/transactions';
import { useTags } from '../../api/tags';
import { useWallets } from '../../api/wallets';
import { exportTransactionsCsv } from '../../api/transactions';
import { Button } from '../../components/Button';
import { InputField, SelectField } from '../../components/Field';
import { Money } from '../../components/Money';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { useToast } from '../../components/toast';
import { formatDateTime } from '../../lib/date';
import { useCurrentUser } from '../auth/auth-context';
import { TransactionFormModal } from './TransactionFormModal';
import { TransactionItem, transactionTitle } from './TransactionItem';
import { useTransactionFilters } from './use-transaction-filters';

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function Filters() {
  const { filters, update, clear } = useTransactionFilters();
  const wallets = useWallets(true);
  const categories = useCategories();
  const tags = useTags();
  const [search, setSearch] = useState(filters.q ?? '');
  const debouncedSearch = useDebounced(search, 300);

  useEffect(() => {
    if ((filters.q ?? '') !== debouncedSearch) update({ q: debouncedSearch || undefined });
    // Only react to the debounced text, not to every filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <InputField
            label="ค้นหาในบันทึก"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
          <Search
            className="pointer-events-none absolute bottom-3 left-3 size-4 text-slate-400"
            aria-hidden
          />
        </div>
        <InputField
          label="ตั้งแต่"
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => update({ from: e.target.value })}
        />
        <InputField
          label="ถึง"
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => update({ to: e.target.value })}
        />
        <SelectField
          label="ประเภท"
          value={filters.type ?? ''}
          onChange={(e) => update({ type: e.target.value })}
        >
          <option value="">ทั้งหมด</option>
          <option value="expense">รายจ่าย</option>
          <option value="income">รายรับ</option>
          <option value="transfer">โอน</option>
        </SelectField>
        <SelectField
          label="กระเป๋า"
          value={filters.walletId ?? ''}
          onChange={(e) => update({ walletId: e.target.value })}
        >
          <option value="">ทั้งหมด</option>
          {wallets.data?.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="หมวดหมู่"
          value={filters.categoryId ?? ''}
          onChange={(e) => update({ categoryId: e.target.value })}
        >
          <option value="">ทั้งหมด</option>
          {flattenCategories(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.depth ? '　└ ' : ''}
              {category.name}{' '}
              {category.depth ? '' : `(${category.type === 'income' ? 'รับ' : 'จ่าย'})`}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="แท็ก"
          value={filters.tagId ?? ''}
          onChange={(e) => update({ tagId: e.target.value })}
        >
          <option value="">ทั้งหมด</option>
          {tags.data?.map((tag) => (
            <option key={tag.id} value={tag.id}>
              #{tag.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="เรียงตาม"
          value={filters.sort ?? 'occurredAt:desc'}
          onChange={(e) => update({ sort: e.target.value })}
        >
          <option value="occurredAt:desc">ใหม่สุดก่อน</option>
          <option value="occurredAt:asc">เก่าสุดก่อน</option>
          <option value="amount:desc">จำนวนมากสุดก่อน</option>
          <option value="amount:asc">จำนวนน้อยสุดก่อน</option>
        </SelectField>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.deleted === true}
            onChange={(e) => update({ deleted: e.target.checked ? 'true' : undefined })}
            className="size-4 rounded"
          />
          ถังขยะ (รายการที่ลบแล้ว)
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('');
            clear();
          }}
        >
          ล้างตัวกรอง
        </Button>
      </div>
    </Card>
  );
}

export function TransactionsPage() {
  const user = useCurrentUser();
  const toast = useToast();
  const { filters, update } = useTransactionFilters();
  const list = useTransactions(filters);
  const deleteTransaction = useDeleteTransaction();
  const restoreTransaction = useRestoreTransaction();
  const [editing, setEditing] = useState<TransactionDto | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await exportTransactionsCsv(filters);
    } catch (error) {
      toast.show(errorMessage(error), { tone: 'error' });
    } finally {
      setExporting(false);
    }
  };
  const inTrash = filters.deleted === true;

  const restore = async (tx: TransactionDto) => {
    try {
      await restoreTransaction.mutateAsync(tx.id);
      toast.show('กู้คืนรายการแล้ว');
    } catch (error) {
      toast.show(errorMessage(error), { tone: 'error' });
    }
  };

  const remove = async (tx: TransactionDto) => {
    try {
      await deleteTransaction.mutateAsync(tx.id);
      // Soft delete is reversible, so offer Undo instead of an "Are you sure?" dialog.
      toast.show('ลบรายการแล้ว', { action: { label: 'เลิกทำ', onClick: () => void restore(tx) } });
    } catch (error) {
      toast.show(errorMessage(error), { tone: 'error' });
    }
  };

  const actionButtons = (tx: TransactionDto) =>
    inTrash ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void restore(tx)}
        aria-label={`กู้คืน ${transactionTitle(tx)}`}
      >
        <RotateCcw className="size-4" aria-hidden /> กู้คืน
      </Button>
    ) : (
      <div className="flex">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(tx)}
          aria-label={`แก้ไข ${transactionTitle(tx)}`}
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void remove(tx)}
          aria-label={`ลบ ${transactionTitle(tx)}`}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    );

  const meta = list.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{inTrash ? 'ถังขยะ' : 'รายการ'}</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            loading={exporting}
            onClick={() => void exportCsv()}
            title="ส่งออกตามตัวกรองปัจจุบัน (UTF-8, เปิดใน Excel ได้)"
          >
            <Download className="size-4" aria-hidden /> Export CSV
          </Button>
          <Button variant="secondary" onClick={() => setTransferOpen(true)}>
            โอนเงิน
          </Button>
        </div>
      </header>

      <Filters />

      <Card>
        {list.isPending ? (
          <LoadingRows rows={8} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.data.length === 0 ? (
          <EmptyState
            title={inTrash ? 'ถังขยะว่าง' : 'ไม่พบรายการ'}
            description={inTrash ? undefined : 'ลองเปลี่ยนตัวกรอง หรือกดคีย์ N เพื่อเพิ่มรายการ'}
          />
        ) : (
          <>
            {/* Phones: list rows */}
            <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
              {list.data.data.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  timezone={user.timezone}
                  actions={actionButtons(tx)}
                />
              ))}
            </ul>
            {/* Tablets and up: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      วันเวลา
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      รายการ
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      กระเป๋า
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      บันทึก
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">
                      จำนวน
                    </th>
                    <th scope="col" className="py-2">
                      <span className="sr-only">การกระทำ</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.data.data.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2.5 pr-4 whitespace-nowrap text-slate-500">
                        {formatDateTime(tx.occurredAt, user.timezone)}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{transactionTitle(tx)}</td>
                      <td className="py-2.5 pr-4">{tx.wallet.name}</td>
                      <td className="max-w-48 truncate py-2.5 pr-4 text-slate-500">
                        {tx.attachmentCount > 0 && (
                          <span
                            className="mr-1.5 inline-flex items-center gap-0.5 align-middle text-xs"
                            title={`ไฟล์แนบ ${tx.attachmentCount} ไฟล์`}
                          >
                            <Paperclip className="size-3.5" aria-hidden />
                            <span className="sr-only">ไฟล์แนบ</span>
                            {tx.attachmentCount}
                          </span>
                        )}
                        {tx.note}
                      </td>
                      <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                        <Money
                          amount={tx.amount}
                          currency={tx.wallet.currencyCode}
                          tone={
                            tx.type === 'income'
                              ? 'income'
                              : tx.type === 'expense'
                                ? 'expense'
                                : 'neutral'
                          }
                          className="font-semibold"
                        />
                      </td>
                      <td className="py-1 text-right">{actionButtons(tx)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {meta && (
              <nav
                aria-label="เลือกหน้า"
                className="mt-4 flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-slate-500">
                  หน้า {meta.page} / {totalPages} · ทั้งหมด {meta.total.toLocaleString('th-TH')}{' '}
                  รายการ
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={meta.page <= 1}
                    onClick={() => update({ page: String(meta.page - 1) })}
                  >
                    <ChevronLeft className="size-4" aria-hidden /> ก่อนหน้า
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={meta.page >= totalPages}
                    onClick={() => update({ page: String(meta.page + 1) })}
                  >
                    ถัดไป <ChevronRight className="size-4" aria-hidden />
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </Card>

      <TransactionFormModal
        key={editing?.id ?? (transferOpen ? 'transfer' : 'closed')}
        open={editing !== null || transferOpen}
        transaction={editing}
        onClose={() => {
          setEditing(null);
          setTransferOpen(false);
        }}
      />
    </div>
  );
}
