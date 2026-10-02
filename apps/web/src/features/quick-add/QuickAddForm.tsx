import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CategoryDto,
  idSchema,
  optionalText,
  positiveMoneySchema,
  type TransactionInput,
  type WalletDto,
} from '@income-expenses/shared';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { flattenCategories } from '../../api/categories';
import { Button } from '../../components/Button';
import { CategoryIcon } from '../../components/CategoryIcon';
import { InputField, SelectField } from '../../components/Field';
import { categoryName } from '../../lib/category-name';
import { cn } from '../../lib/cn';
import { translateMessage } from '../../i18n/use-message';
import { applyApiErrors } from '../../lib/form-errors';

/** Built from the same shared primitives the API validates with. */
const quickAddSchema = z.object({
  type: z.enum(['expense', 'income']),
  amount: positiveMoneySchema,
  categoryId: z.string().min(1, 'validation.selectCategory').pipe(idSchema),
  walletId: z.string().min(1, 'validation.selectWallet').pipe(idSchema),
  note: optionalText(255),
});

type QuickAddValues = z.input<typeof quickAddSchema>;

interface QuickAddFormProps {
  wallets: WalletDto[];
  categories: CategoryDto[];
  defaultWalletId?: string | undefined;
  onSubmit: (input: TransactionInput) => Promise<void>;
  /** Injected for tests; defaults to "now". */
  now?: () => Date;
}

export function QuickAddForm({
  wallets,
  categories,
  defaultWalletId,
  onSubmit,
  now = () => new Date(),
}: QuickAddFormProps) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const initialWallet =
    wallets.find((wallet) => wallet.id === defaultWalletId)?.id ?? wallets[0]?.id ?? '';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      type: 'expense',
      amount: '',
      categoryId: '',
      walletId: initialWallet,
      note: '',
    },
  });

  const type = watch('type');
  const selectedCategory = watch('categoryId');
  const visibleCategories = flattenCategories(categories.filter((c) => c.type === type));

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const parsed = quickAddSchema.parse(values);
    try {
      await onSubmit({
        type: parsed.type,
        amount: parsed.amount,
        categoryId: parsed.categoryId,
        walletId: parsed.walletId,
        note: parsed.note ?? null,
        occurredAt: now().toISOString(),
      });
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['amount', 'categoryId', 'walletId', 'note']));
    }
  });

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-5">
      {formError && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {formError}
        </p>
      )}

      {/* 1. Type */}
      <div
        role="radiogroup"
        aria-label={t('common.type')}
        className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        {(
          [
            ['expense', 'common.expense'],
            ['income', 'common.income'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => {
              setValue('type', value);
              setValue('categoryId', ''); // categories differ per type
            }}
            className={cn(
              'rounded-lg py-2 text-sm font-medium transition-colors',
              type === value
                ? 'bg-white shadow-sm dark:bg-slate-950'
                : 'text-slate-600 dark:text-slate-400',
            )}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {/* 2. Amount — focused first, numeric keyboard on phones */}
      <InputField
        label={t('common.amount')}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        autoFocus
        className="text-2xl font-semibold tabular-nums sm:text-2xl"
        error={errors.amount?.message}
        {...register('amount', {
          // "1,250" and " 1250 " are accepted and cleaned before validation
          setValueAs: (value: string) => value.replace(/[,\s]/g, ''),
        })}
      />

      {/* 3. Category — one tap */}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('common.category')}
        </legend>
        <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={selectedCategory === category.id}
              onClick={() => {
                setValue('categoryId', category.id, { shouldValidate: true });
                // Amount → category → Enter: the next Enter saves instead of re-pressing the chip.
                saveButtonRef.current?.focus();
              }}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl p-2 text-xs ring-1 ring-inset transition-colors',
                selectedCategory === category.id
                  ? 'bg-blue-50 ring-2 ring-blue-600 dark:bg-blue-950/50 dark:ring-blue-500'
                  : 'ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800',
              )}
            >
              <CategoryIcon icon={category.icon} color={category.color} size="sm" />
              <span className="line-clamp-1">{categoryName(category)}</span>
            </button>
          ))}
        </div>
        {errors.categoryId && (
          <p role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {translateMessage(errors.categoryId.message ?? '')}
          </p>
        )}
      </fieldset>

      {/* 4. Wallet — remembered from last time */}
      <SelectField
        label={t('common.wallet')}
        error={errors.walletId?.message}
        {...register('walletId')}
      >
        {wallets.map((wallet) => (
          <option key={wallet.id} value={wallet.id}>
            {wallet.name} ({wallet.currencyCode})
          </option>
        ))}
      </SelectField>

      <InputField
        label={t('quickAdd.memoOptional')}
        autoComplete="off"
        error={errors.note?.message}
        {...register('note')}
      />

      <Button
        ref={saveButtonRef}
        type="submit"
        loading={isSubmitting}
        className="w-full py-3 text-base"
      >
        {t('common.save')}
      </Button>
    </form>
  );
}
