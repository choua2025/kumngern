import { zodResolver } from '@hookform/resolvers/zod';
import {
  type BudgetDto,
  type CreateBudgetInput,
  createBudgetSchema,
} from '@income-expenses/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCreateBudget, useUpdateBudget } from '../../api/budgets';
import { flattenCategories, useCategories } from '../../api/categories';
import { Button } from '../../components/Button';
import { InputField, SelectField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/toast';
import { formatMonthLong } from '../../lib/date';
import { categoryName } from '../../lib/category-name';
import { applyApiErrors } from '../../lib/form-errors';

function BudgetForm({
  budget,
  month,
  takenCategoryIds,
  onDone,
}: {
  budget: BudgetDto | null;
  month: string;
  takenCategoryIds: string[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const categories = useCategories('expense');
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateBudgetInput>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: {
      categoryId: budget?.category.id ?? '',
      month,
      limitAmount: budget?.limitAmount ?? '',
      alertPercent: budget?.alertPercent ?? 80,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (budget) {
        await updateBudget.mutateAsync({
          id: budget.id,
          patch: { limitAmount: values.limitAmount, alertPercent: Number(values.alertPercent) },
        });
        toast.show(t('budgets.saved'));
      } else {
        await createBudget.mutateAsync(values);
        toast.show(t('budgets.created'));
      }
      onDone();
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['categoryId', 'limitAmount', 'alertPercent']));
    }
  });

  // One budget per category per month: hide categories that already have one.
  const options = flattenCategories(categories.data ?? []).filter(
    (category) => category.id === budget?.category.id || !takenCategoryIds.includes(category.id),
  );

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
      <p className="text-sm text-slate-500">
        {t('common.month', { month: formatMonthLong(month) })}
      </p>
      <SelectField
        label={t('budgets.expenseCategory')}
        disabled={budget !== null}
        error={errors.categoryId?.message}
        {...register('categoryId')}
      >
        <option value="">{t('common.select')}</option>
        {options.map((category) => (
          <option key={category.id} value={category.id}>
            {category.depth ? '　└ ' : ''}
            {categoryName(category)}
            {category.depth === 0 && category.children.length > 0
              ? t('budgets.includesChildren')
              : ''}
          </option>
        ))}
      </SelectField>
      <InputField
        label={t('budgets.limit')}
        inputMode="decimal"
        autoFocus={budget !== null}
        error={errors.limitAmount?.message}
        {...register('limitAmount', { setValueAs: (v: string) => v.replace(/[,\s]/g, '') })}
      />
      <InputField
        label={t('budgets.alertAt')}
        type="number"
        min={1}
        max={100}
        hint={t('budgets.alertHint')}
        error={errors.alertPercent?.message}
        {...register('alertPercent')}
      />
      <Button type="submit" loading={isSubmitting} className="w-full">
        {budget ? t('common.save') : t('budgets.set')}
      </Button>
    </form>
  );
}

export function BudgetFormModal({
  open,
  budget,
  month,
  takenCategoryIds,
  onClose,
}: {
  open: boolean;
  budget: BudgetDto | null;
  month: string;
  takenCategoryIds: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        budget
          ? t('budgets.editTitle', { name: categoryName(budget.category) })
          : t('budgets.newTitle')
      }
    >
      <BudgetForm
        budget={budget}
        month={month}
        takenCategoryIds={takenCategoryIds}
        onDone={onClose}
      />
    </Modal>
  );
}
