import { zodResolver } from '@hookform/resolvers/zod';
import { type CategoryDto, colorSchema, createCategorySchema } from '@income-expenses/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCreateCategory, useUpdateCategory } from '../../api/categories';
import { Button } from '../../components/Button';
import { CATEGORY_ICON_NAMES, CategoryIcon } from '../../components/CategoryIcon';
import { InputField, SelectField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/toast';
import { cn } from '../../lib/cn';
import { translateMessage } from '../../i18n/use-message';
import { applyApiErrors } from '../../lib/form-errors';

/** A small, readable set; users can still enter any #RRGGBB via the picker. */
const SWATCHES = [
  '#2A78D6',
  '#EB6834',
  '#1BAF7A',
  '#EDA100',
  '#E87BA4',
  '#4A3AA7',
  '#E34948',
  '#64748B',
];

/** Form shape: selects use "" for "none". Name/type/color rules come from the shared schema. */
const formSchema = z.object({
  name: createCategorySchema.shape.name,
  type: createCategorySchema.shape.type,
  parentId: z.string(),
  icon: z.string(),
  color: colorSchema,
});
type FormValues = z.input<typeof formSchema>;

function CategoryForm({
  category,
  type,
  roots,
  onDone,
}: {
  category: CategoryDto | null;
  type: 'income' | 'expense';
  roots: CategoryDto[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const toast = useToast();
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
      name: category?.name ?? '',
      type: category?.type ?? type,
      parentId: category?.parentId ?? '',
      icon: category?.icon ?? 'utensils',
      color: category?.color ?? SWATCHES[0],
    },
  });

  const icon = watch('icon');
  const color = watch('color');
  // A category that has children cannot itself become a child (one level only).
  const parentOptions = roots.filter((root) => root.id !== category?.id);
  const canHaveParent = !category || category.children.length === 0;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const body = {
      name: values.name,
      parentId: values.parentId || null,
      icon: values.icon || null,
      color: values.color || null,
    };
    try {
      if (category) {
        await updateCategory.mutateAsync({ id: category.id, patch: body });
        toast.show(t('categories.saved'));
      } else {
        await createCategory.mutateAsync({ ...body, type: values.type });
        toast.show(t('categories.created'));
      }
      onDone();
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['name', 'parentId', 'icon', 'color']));
    }
  });

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
      <div className="flex items-end gap-3">
        <CategoryIcon icon={icon} color={color} />
        <div className="flex-1">
          <InputField
            label={t('categories.name')}
            autoFocus
            error={errors.name?.message}
            {...register('name')}
          />
        </div>
      </div>
      {canHaveParent && (
        <SelectField
          label={t('categories.parent')}
          error={errors.parentId?.message}
          {...register('parentId')}
        >
          <option value="">{t('categories.topLevel')}</option>
          {parentOptions.map((root) => (
            <option key={root.id} value={root.id}>
              {root.name}
            </option>
          ))}
        </SelectField>
      )}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('categories.icon')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_ICON_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={icon === name}
              onClick={() => setValue('icon', name)}
              className={cn(
                'rounded-full p-0.5 ring-2',
                icon === name ? 'ring-blue-600' : 'ring-transparent',
              )}
            >
              <CategoryIcon icon={name} color={color} size="sm" />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('categories.color')}
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={t('categories.colorItem', { color: swatch })}
              aria-pressed={color.toUpperCase() === swatch}
              onClick={() => setValue('color', swatch)}
              className={cn(
                'size-7 rounded-full ring-2 ring-offset-2 dark:ring-offset-slate-900',
                color.toUpperCase() === swatch ? 'ring-blue-600' : 'ring-transparent',
              )}
              style={{ backgroundColor: swatch }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(event) => setValue('color', event.target.value.toUpperCase())}
            aria-label={t('categories.customColor')}
            className="size-8 cursor-pointer rounded border-0 bg-transparent"
          />
        </div>
        {errors.color && (
          <p className="mt-1 text-sm text-red-600">
            {translateMessage(errors.color.message ?? '')}
          </p>
        )}
      </fieldset>
      <Button type="submit" loading={isSubmitting} className="w-full">
        {category ? t('common.save') : t('categories.create')}
      </Button>
    </form>
  );
}

export function CategoryFormModal({
  open,
  category,
  type,
  roots,
  onClose,
}: {
  open: boolean;
  category: CategoryDto | null;
  type: 'income' | 'expense';
  roots: CategoryDto[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        category
          ? t('categories.editTitle')
          : type === 'expense'
            ? t('categories.addExpense')
            : t('categories.addIncome')
      }
    >
      <CategoryForm category={category} type={type} roots={roots} onDone={onClose} />
    </Modal>
  );
}
