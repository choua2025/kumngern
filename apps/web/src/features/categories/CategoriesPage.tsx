import type { CategoryDto } from '@income-expenses/shared';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategories, useDeleteCategory } from '../../api/categories';
import { errorMessage } from '../../api/errors';
import { Button } from '../../components/Button';
import { CategoryIcon } from '../../components/CategoryIcon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { useToast } from '../../components/toast';
import { categoryName } from '../../lib/category-name';
import { cn } from '../../lib/cn';
import { CategoryFormModal } from './CategoryFormModal';
import { TagsPanel } from './TagsPanel';

type Tab = 'expense' | 'income' | 'tags';

function CategoryRow({
  category,
  depth,
  onEdit,
  onDelete,
}: {
  category: CategoryDto;
  depth: 0 | 1;
  onEdit: (category: CategoryDto) => void;
  onDelete: (category: CategoryDto) => void;
}) {
  const { t } = useTranslation();
  return (
    <li className={cn('flex items-center gap-3 py-2.5', depth === 1 && 'pl-10')}>
      <CategoryIcon icon={category.icon} color={category.color} size={depth ? 'sm' : 'md'} />
      <span className={cn('flex-1 truncate', depth === 0 && 'font-medium')}>
        {categoryName(category)}
      </span>
      {category.isSystem ? (
        // System categories are read-only (API answers 403): show why, not a dead button.
        <span
          className="flex items-center gap-1 text-xs text-slate-500"
          title={t('categories.systemTitle')}
        >
          <Lock className="size-3.5" aria-hidden /> {t('categories.system')}
        </span>
      ) : (
        <div className="flex">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(category)}
            aria-label={t('common.editItem', { name: categoryName(category) })}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(category)}
            aria-label={t('common.deleteItem', { name: categoryName(category) })}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

export function CategoriesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('expense');
  // The tags tab shows TagsPanel; keep the expense list cached meanwhile.
  const categoryType = tab === 'tags' ? 'expense' : tab;
  const categories = useCategories(categoryType);
  const deleteCategory = useDeleteCategory();
  const toast = useToast();
  const [editing, setEditing] = useState<CategoryDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CategoryDto | null>(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCategory.mutateAsync(deleting.id);
      toast.show(t('categories.deleted', { name: deleting.name }));
    } catch (error) {
      // 409 when used by transactions/budgets or when it has sub-categories.
      toast.show(errorMessage(error), { tone: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('categories.title')}</h1>
        {tab !== 'tags' && (
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden /> {t('categories.add')}
          </Button>
        )}
      </header>

      <div
        role="tablist"
        aria-label={t('categories.tabs')}
        className="inline-grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        {(
          [
            ['expense', 'common.expense'],
            ['income', 'common.income'],
            ['tags', 'categories.tags'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'rounded-lg px-6 py-1.5 text-sm font-medium',
              tab === value
                ? 'bg-white shadow-sm dark:bg-slate-950'
                : 'text-slate-600 dark:text-slate-400',
            )}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {tab === 'tags' ? (
        <TagsPanel />
      ) : (
        <Card>
          {categories.isPending ? (
            <LoadingRows rows={8} />
          ) : categories.isError ? (
            <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
          ) : categories.data.length === 0 ? (
            <EmptyState
              title={t('categories.empty')}
              action={<Button onClick={() => setEditing('new')}>{t('categories.addFirst')}</Button>}
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {categories.data.map((root) => (
                <li key={root.id}>
                  <ul>
                    <CategoryRow
                      category={root}
                      depth={0}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                    {root.children.map((child) => (
                      <CategoryRow
                        key={child.id}
                        category={child}
                        depth={1}
                        onEdit={setEditing}
                        onDelete={setDeleting}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <CategoryFormModal
        key={editing === 'new' ? `new-${categoryType}` : (editing?.id ?? 'closed')}
        open={editing !== null}
        category={editing === 'new' ? null : editing}
        type={categoryType}
        roots={categories.data ?? []}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t('categories.deleteTitle')}
        message={t('categories.deleteMessage', { name: deleting?.name ?? '' })}
        loading={deleteCategory.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
