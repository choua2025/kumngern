import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreateRecurringInput,
  idSchema,
  localDateSchema,
  msg,
  positiveMoneySchema,
  RECURRING_FREQUENCIES,
  type RecurringDto,
  recurringRuleIssues,
} from '@income-expenses/shared';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { flattenCategories, useCategories } from '../../api/categories';
import { useCreateRecurring, useUpdateRecurring } from '../../api/recurring';
import { useWallets } from '../../api/wallets';
import { Button } from '../../components/Button';
import { InputField, SelectField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/toast';
import { todayIn } from '../../lib/date';
import { applyApiErrors } from '../../lib/form-errors';
import { useCurrentUser } from '../auth/auth-context';
import { frequencyLabel } from './labels';

/**
 * The API schema with form-friendly types: empty inputs are '' (not null) and the
 * cross-field rules come from the SAME function the API uses (recurringRuleIssues).
 */
const formSchema = z
  .object({
    type: z.enum(['expense', 'income']),
    walletId: z.string().min(1, 'validation.selectWallet').pipe(idSchema),
    categoryId: z.string().min(1, 'validation.selectCategory').pipe(idSchema),
    amount: positiveMoneySchema,
    note: z
      .string()
      .trim()
      .max(255, msg('validation.tooLong', { max: 255 })),
    frequency: z.enum(RECURRING_FREQUENCIES),
    nextRunDate: localDateSchema,
    endDate: z.union([z.literal(''), localDateSchema]),
  })
  .superRefine((value, ctx) => {
    for (const issue of recurringRuleIssues({ ...value, endDate: value.endDate || null })) {
      ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
    }
  });
type FormValues = z.infer<typeof formSchema>;

const FIELDS = [
  'type',
  'walletId',
  'categoryId',
  'amount',
  'note',
  'frequency',
  'nextRunDate',
  'endDate',
] as const;

function toPayload(values: FormValues): CreateRecurringInput {
  return { ...values, note: values.note || null, endDate: values.endDate || null };
}

function RecurringForm({
  recurring,
  onDone,
}: {
  recurring: RecurringDto | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  // Archived wallets are listed only to keep the CURRENT one selectable when editing.
  const wallets = useWallets(true);
  const categories = useCategories();
  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const today = todayIn(user.timezone);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: recurring?.type ?? 'expense',
      walletId: recurring?.wallet.id ?? '',
      categoryId: recurring?.category.id ?? '',
      amount: recurring?.amount ?? '',
      note: recurring?.note ?? '',
      frequency: recurring?.frequency ?? 'monthly',
      nextRunDate: recurring?.nextRunDate ?? today,
      endDate: recurring?.endDate ?? '',
    },
  });
  const type = useWatch({ control, name: 'type' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (recurring) {
        await updateRecurring.mutateAsync({ id: recurring.id, patch: toPayload(values) });
        toast.show(t('recurring.saved'));
      } else {
        await createRecurring.mutateAsync(toPayload(values));
        toast.show(t('recurring.created'));
      }
      onDone();
    } catch (error) {
      setFormError(applyApiErrors(error, setError, FIELDS));
    }
  });

  const walletOptions = (wallets.data ?? []).filter(
    (wallet) => !wallet.isArchived || wallet.id === recurring?.wallet.id,
  );
  const categoryOptions = flattenCategories((categories.data ?? []).filter((c) => c.type === type));

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
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('common.type')}
          {...register('type', { onChange: () => setValue('categoryId', '') })}
        >
          <option value="expense">{t('common.expense')}</option>
          <option value="income">{t('common.income')}</option>
        </SelectField>
        <SelectField
          label={t('recurring.frequency')}
          error={errors.frequency?.message}
          {...register('frequency')}
        >
          {RECURRING_FREQUENCIES.map((frequency) => (
            <option key={frequency} value={frequency}>
              {frequencyLabel(frequency)}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('common.wallet')}
          error={errors.walletId?.message}
          {...register('walletId')}
        >
          <option value="">{t('common.select')}</option>
          {walletOptions.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.name} ({wallet.currencyCode}){wallet.isArchived ? ' · archived' : ''}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('common.category')}
          error={errors.categoryId?.message}
          {...register('categoryId')}
        >
          <option value="">{t('common.select')}</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.depth ? '　└ ' : ''}
              {category.name}
            </option>
          ))}
        </SelectField>
      </div>
      <InputField
        label={t('common.amount')}
        inputMode="decimal"
        error={errors.amount?.message}
        {...register('amount', { setValueAs: (v: string) => v.replace(/[,\s]/g, '') })}
      />
      <InputField label={t('common.note')} error={errors.note?.message} {...register('note')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label={recurring ? t('recurring.nextRunLabel') : t('recurring.startDate')}
          type="date"
          min={today}
          hint={t('recurring.startHint')}
          error={errors.nextRunDate?.message}
          {...register('nextRunDate')}
        />
        <InputField
          label={t('recurring.endDate')}
          type="date"
          error={errors.endDate?.message}
          {...register('endDate')}
        />
      </div>
      <Button type="submit" loading={isSubmitting} className="w-full">
        {recurring ? t('common.save') : t('recurring.create')}
      </Button>
    </form>
  );
}

export function RecurringFormModal({
  open,
  recurring,
  onClose,
}: {
  open: boolean;
  recurring: RecurringDto | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={recurring ? t('recurring.editTitle') : t('recurring.newTitle')}
    >
      <RecurringForm recurring={recurring} onDone={onClose} />
    </Modal>
  );
}
