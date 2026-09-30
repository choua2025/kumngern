import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CategoryDto,
  idSchema,
  optionalText,
  positiveMoneySchema,
  type TransactionDto,
  type WalletDto,
} from '@income-expenses/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { flattenCategories, useCategories } from '../../api/categories';
import { useCreateTransaction, useUpdateTransaction } from '../../api/transactions';
import { useWallets } from '../../api/wallets';
import { Button } from '../../components/Button';
import { InputField, SelectField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { ErrorState, LoadingRows } from '../../components/states';
import { useToast } from '../../components/toast';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '../../lib/date';
import { applyApiErrors } from '../../lib/form-errors';
import { useCurrentUser } from '../auth/auth-context';

const formSchema = z
  .object({
    type: z.enum(['expense', 'income', 'transfer']),
    walletId: z.string().min(1, 'กรุณาเลือกกระเป๋า').pipe(idSchema),
    toWalletId: z.string(),
    categoryId: z.string(),
    amount: positiveMoneySchema,
    toAmount: z.string(),
    note: optionalText(255),
    occurredAtLocal: z.string().min(1, 'กรุณาระบุวันเวลา'),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'transfer') {
      if (!value.toWalletId)
        ctx.addIssue({ code: 'custom', path: ['toWalletId'], message: 'กรุณาเลือกกระเป๋าปลายทาง' });
      if (value.toWalletId && value.toWalletId === value.walletId) {
        ctx.addIssue({
          code: 'custom',
          path: ['toWalletId'],
          message: 'ต้องไม่ใช่กระเป๋าเดียวกับต้นทาง',
        });
      }
    } else if (!value.categoryId) {
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'กรุณาเลือกหมวดหมู่' });
    }
  });

type FormValues = z.input<typeof formSchema>;

function Body({
  transaction,
  wallets,
  categories,
  onDone,
}: {
  transaction: TransactionDto | null;
  wallets: WalletDto[];
  categories: CategoryDto[];
  onDone: () => void;
}) {
  const user = useCurrentUser();
  const toast = useToast();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: transaction?.type ?? 'transfer',
      walletId: transaction?.wallet.id ?? wallets[0]?.id ?? '',
      toWalletId: transaction?.toWallet?.id ?? '',
      categoryId: transaction?.category?.id ?? '',
      amount: transaction?.amount ?? '',
      toAmount: transaction?.toAmount ?? '',
      note: transaction?.note ?? '',
      occurredAtLocal: toDateTimeLocalValue(
        transaction?.occurredAt ?? new Date().toISOString(),
        user.timezone,
      ),
    },
  });

  const type = watch('type');
  const source = wallets.find((w) => w.id === watch('walletId'));
  const target = wallets.find((w) => w.id === watch('toWalletId'));
  const crossCurrency =
    type === 'transfer' && !!source && !!target && source.currencyCode !== target.currencyCode;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const parsed = formSchema.parse(values);
    const isTransfer = parsed.type === 'transfer';
    // Send every field explicitly so a type change clears the fields that no longer apply.
    const payload = {
      type: parsed.type,
      walletId: parsed.walletId,
      toWalletId: isTransfer ? parsed.toWalletId : null,
      categoryId: isTransfer ? null : parsed.categoryId,
      amount: parsed.amount,
      toAmount: isTransfer && crossCurrency ? parsed.toAmount || null : null,
      note: parsed.note ?? null,
      occurredAt: fromDateTimeLocalValue(parsed.occurredAtLocal, user.timezone),
    };
    try {
      if (transaction) {
        await updateTransaction.mutateAsync({ id: transaction.id, patch: payload });
        toast.show('บันทึกการแก้ไขแล้ว');
      } else if (payload.type === 'transfer') {
        await createTransaction.mutateAsync({
          ...payload,
          type: 'transfer',
          toWalletId: parsed.toWalletId,
        });
        toast.show('บันทึกการโอนแล้ว');
      } else {
        await createTransaction.mutateAsync({
          ...payload,
          type: payload.type,
          categoryId: parsed.categoryId,
        });
        toast.show('บันทึกรายการแล้ว');
      }
      onDone();
    } catch (error) {
      setFormError(
        applyApiErrors(error, setError, [
          'walletId',
          'toWalletId',
          'categoryId',
          'amount',
          'toAmount',
          'note',
        ]),
      );
    }
  });

  const categoryOptions = flattenCategories(categories.filter((c) => c.type === type));

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
      {formError && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {formError}
        </p>
      )}
      <SelectField label="ประเภท" {...register('type')}>
        <option value="expense">รายจ่าย</option>
        <option value="income">รายรับ</option>
        <option value="transfer">โอนระหว่างกระเป๋า</option>
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={type === 'transfer' ? 'จากกระเป๋า' : 'กระเป๋า'}
          error={errors.walletId?.message}
          {...register('walletId')}
        >
          {wallets.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.name} ({wallet.currencyCode})
            </option>
          ))}
        </SelectField>
        {type === 'transfer' ? (
          <SelectField
            label="ไปกระเป๋า"
            error={errors.toWalletId?.message}
            {...register('toWalletId')}
          >
            <option value="">— เลือก —</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} ({wallet.currencyCode})
              </option>
            ))}
          </SelectField>
        ) : (
          <SelectField
            label="หมวดหมู่"
            error={errors.categoryId?.message}
            {...register('categoryId')}
          >
            <option value="">— เลือก —</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.depth ? '　└ ' : ''}
                {category.name}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label={crossCurrency ? `จำนวนที่โอนออก (${source?.currencyCode})` : 'จำนวนเงิน'}
          inputMode="decimal"
          error={errors.amount?.message}
          {...register('amount', { setValueAs: (v: string) => v.replace(/[,\s]/g, '') })}
        />
        {crossCurrency && (
          <InputField
            label={`จำนวนที่เข้าปลายทาง (${target?.currencyCode})`}
            inputMode="decimal"
            error={errors.toAmount?.message}
            {...register('toAmount', { setValueAs: (v: string) => v.replace(/[,\s]/g, '') })}
          />
        )}
      </div>
      <InputField
        label={`วันเวลา (${user.timezone})`}
        type="datetime-local"
        error={errors.occurredAtLocal?.message}
        {...register('occurredAtLocal')}
      />
      <InputField label="บันทึกช่วยจำ" error={errors.note?.message} {...register('note')} />
      <Button type="submit" loading={isSubmitting} className="w-full">
        บันทึก
      </Button>
    </form>
  );
}

/** Create (defaults to a transfer — Quick Add covers income/expense) or edit any transaction. */
export function TransactionFormModal({
  open,
  onClose,
  transaction,
}: {
  open: boolean;
  onClose: () => void;
  transaction: TransactionDto | null;
}) {
  const wallets = useWallets();
  const categories = useCategories();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? 'แก้ไขรายการ' : 'โอนเงินระหว่างกระเป๋า'}
    >
      {wallets.isPending || categories.isPending ? (
        <LoadingRows rows={5} />
      ) : wallets.isError || categories.isError ? (
        <ErrorState error={wallets.error ?? categories.error} />
      ) : (
        <Body
          transaction={transaction}
          wallets={wallets.data}
          categories={categories.data}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}
