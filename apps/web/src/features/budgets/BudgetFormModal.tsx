import { zodResolver } from '@hookform/resolvers/zod';
import {
  type BudgetDto,
  type CreateBudgetInput,
  createBudgetSchema,
} from '@income-expenses/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateBudget, useUpdateBudget } from '../../api/budgets';
import { flattenCategories, useCategories } from '../../api/categories';
import { Button } from '../../components/Button';
import { InputField, SelectField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/toast';
import { formatMonthLong } from '../../lib/date';
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
        toast.show('บันทึกงบแล้ว');
      } else {
        await createBudget.mutateAsync(values);
        toast.show('ตั้งงบแล้ว');
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
      <p className="text-sm text-slate-500">เดือน {formatMonthLong(month)}</p>
      <SelectField
        label="หมวดรายจ่าย"
        disabled={budget !== null}
        error={errors.categoryId?.message}
        {...register('categoryId')}
      >
        <option value="">— เลือก —</option>
        {options.map((category) => (
          <option key={category.id} value={category.id}>
            {category.depth ? '　└ ' : ''}
            {category.name}
            {category.depth === 0 && category.children.length > 0 ? ' (รวมหมวดย่อย)' : ''}
          </option>
        ))}
      </SelectField>
      <InputField
        label="วงเงิน"
        inputMode="decimal"
        autoFocus={budget !== null}
        error={errors.limitAmount?.message}
        {...register('limitAmount', { setValueAs: (v: string) => v.replace(/[,\s]/g, '') })}
      />
      <InputField
        label="แจ้งเตือนเมื่อใช้ไปถึง (%)"
        type="number"
        min={1}
        max={100}
        hint="แถบจะเปลี่ยนเป็นสีเหลืองเมื่อถึงเปอร์เซ็นต์นี้"
        error={errors.alertPercent?.message}
        {...register('alertPercent')}
      />
      <Button type="submit" loading={isSubmitting} className="w-full">
        {budget ? 'บันทึก' : 'ตั้งงบ'}
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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={budget ? `แก้ไขงบ${budget.category.name}` : 'ตั้งงบประมาณ'}
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
