import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CategoryDto,
  idSchema,
  msg,
  optionalText,
  positiveMoneySchema,
  type TransactionDto,
  type WalletDto,
} from '@income-expenses/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { flattenCategories, useCategories } from '../../api/categories';
import { useCreateTransaction, useUpdateTransaction } from '../../api/transactions';
import { useTags } from '../../api/tags';
import { useWallets } from '../../api/wallets';
import { Button } from '../../components/Button';
import { InputField, SelectField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { ErrorState, LoadingRows } from '../../components/states';
import { useToast } from '../../components/toast';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '../../lib/date';
import { translateMessage } from '../../i18n/use-message';
import { categoryName } from '../../lib/category-name';
import { applyApiErrors } from '../../lib/form-errors';
import { useCurrentUser } from '../auth/auth-context';
import { AttachmentsSection } from './AttachmentsSection';

const formSchema = z
  .object({
    type: z.enum(['expense', 'income', 'transfer']),
    walletId: z.string().min(1, 'validation.selectWallet').pipe(idSchema),
    toWalletId: z.string(),
    categoryId: z.string(),
    amount: positiveMoneySchema,
    toAmount: z.string(),
    note: optionalText(255),
    occurredAtLocal: z.string().min(1, 'validation.enterDateTime'),
    tagIds: z.array(z.string()).max(10, msg('validation.maxTags', { max: 10 })),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'transfer') {
      if (!value.toWalletId)
        ctx.addIssue({
          code: 'custom',
          path: ['toWalletId'],
          message: 'validation.selectTargetWallet',
        });
      if (value.toWalletId && value.toWalletId === value.walletId) {
        ctx.addIssue({
          code: 'custom',
          path: ['toWalletId'],
          message: 'validation.sameWallet',
        });
      }
    } else if (!value.categoryId) {
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'validation.selectCategory' });
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
  const { t } = useTranslation();
  const user = useCurrentUser();
  const toast = useToast();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
      tagIds: transaction?.tags.map((tag) => tag.id) ?? [],
    },
  });

  const type = watch('type');
  const selectedTags = watch('tagIds');
  const tags = useTags();
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
      tagIds: parsed.tagIds,
    };
    try {
      if (transaction) {
        await updateTransaction.mutateAsync({ id: transaction.id, patch: payload });
        toast.show(t('transactions.saved'));
      } else if (payload.type === 'transfer') {
        await createTransaction.mutateAsync({
          ...payload,
          type: 'transfer',
          toWalletId: parsed.toWalletId,
        });
        toast.show(t('transactions.transferSaved'));
      } else {
        await createTransaction.mutateAsync({
          ...payload,
          type: payload.type,
          categoryId: parsed.categoryId,
        });
        toast.show(t('transactions.created'));
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
      <SelectField label={t('common.type')} {...register('type')}>
        <option value="expense">{t('common.expense')}</option>
        <option value="income">{t('common.income')}</option>
        <option value="transfer">{t('transactions.transferBetween')}</option>
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={type === 'transfer' ? t('transactions.fromWallet') : t('common.wallet')}
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
            label={t('transactions.toWallet')}
            error={errors.toWalletId?.message}
            {...register('toWalletId')}
          >
            <option value="">{t('common.select')}</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} ({wallet.currencyCode})
              </option>
            ))}
          </SelectField>
        ) : (
          <SelectField
            label={t('common.category')}
            error={errors.categoryId?.message}
            {...register('categoryId')}
          >
            <option value="">{t('common.select')}</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.depth ? '　└ ' : ''}
                {categoryName(category)}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label={
            crossCurrency
              ? t('transactions.amountOut', { currency: source?.currencyCode })
              : t('common.amount')
          }
          inputMode="decimal"
          error={errors.amount?.message}
          {...register('amount', { setValueAs: (v: string) => v.replace(/[,\s]/g, '') })}
        />
        {crossCurrency && (
          <InputField
            label={t('transactions.amountIn', { currency: target?.currencyCode })}
            inputMode="decimal"
            error={errors.toAmount?.message}
            {...register('toAmount', { setValueAs: (v: string) => v.replace(/[,\s]/g, '') })}
          />
        )}
      </div>
      <InputField
        label={t('transactions.dateTime', { timezone: user.timezone })}
        type="datetime-local"
        error={errors.occurredAtLocal?.message}
        {...register('occurredAtLocal')}
      />
      <InputField
        label={t('transactions.memo')}
        error={errors.note?.message}
        {...register('note')}
      />
      {(tags.data?.length ?? 0) > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('transactions.tag')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {tags.data?.map((tag) => {
              const selected = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setValue(
                      'tagIds',
                      selected
                        ? selectedTags.filter((id) => id !== tag.id)
                        : [...selectedTags, tag.id],
                      { shouldValidate: true },
                    )
                  }
                  className={
                    selected
                      ? 'rounded-full bg-blue-600 px-3 py-1 text-sm text-white'
                      : 'rounded-full px-3 py-1 text-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800'
                  }
                >
                  #{tag.name}
                </button>
              );
            })}
          </div>
          {errors.tagIds && (
            <p className="mt-1 text-sm text-red-600">
              {translateMessage(errors.tagIds.message ?? '')}
            </p>
          )}
        </fieldset>
      )}
      <Button type="submit" loading={isSubmitting} className="w-full">
        {t('common.save')}
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
  const { t } = useTranslation();
  const wallets = useWallets();
  const categories = useCategories();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? t('transactions.editTitle') : t('transactions.transferModalTitle')}
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
      {/* Files belong to a saved transaction, so they are managed when editing it. */}
      {transaction && <AttachmentsSection transactionId={transaction.id} />}
    </Modal>
  );
}
