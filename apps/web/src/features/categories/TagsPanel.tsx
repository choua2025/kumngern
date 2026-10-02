import { tagNameSchema, type TagRefDto } from '@income-expenses/shared';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { errorMessage } from '../../api/errors';
import { useCreateTag, useDeleteTag, useRenameTag, useTags } from '../../api/tags';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { InputField } from '../../components/Field';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { useToast } from '../../components/toast';

/** Validates with the same shared schema as the API; returns an error message or null. */
function validateName(name: string): string | null {
  const result = tagNameSchema.safeParse(name);
  return result.success ? null : (result.error.issues[0]?.message ?? 'validation.invalidName');
}

function TagRow({ tag, onDelete }: { tag: TagRefDto; onDelete: (tag: TagRefDto) => void }) {
  const { t } = useTranslation();
  const renameTag = useRenameTag();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateName(name);
    if (problem) {
      toast.show(problem, { tone: 'error' });
      return;
    }
    try {
      await renameTag.mutateAsync({ id: tag.id, name });
      setEditing(false);
    } catch (error) {
      toast.show(errorMessage(error), { tone: 'error' });
    }
  };

  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={(event) => void save(event)} className="flex items-end gap-2">
          <div className="flex-1">
            <InputField
              label={t('tags.renameLabel', { name: tag.name })}
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            loading={renameTag.isPending}
            aria-label={t('tags.saveName')}
          >
            <Check className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
            aria-label={t('common.cancel')}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-2.5">
      <Link
        to={`/transactions?tagId=${tag.id}`}
        className="flex-1 truncate font-medium hover:text-blue-600 dark:hover:text-blue-400"
      >
        #{tag.name}
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
        aria-label={t('tags.editItem', { name: tag.name })}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(tag)}
        aria-label={t('tags.deleteItem', { name: tag.name })}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  );
}

export function TagsPanel() {
  const { t } = useTranslation();
  const tags = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const toast = useToast();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TagRefDto | null>(null);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateName(name);
    setNameError(problem);
    if (problem) return;
    try {
      await createTag.mutateAsync(name);
      setName('');
      toast.show(t('tags.added'));
    } catch (error) {
      setNameError(errorMessage(error));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTag.mutateAsync(deleting.id);
      toast.show(t('tags.deleted', { name: deleting.name }));
    } catch (error) {
      toast.show(errorMessage(error), { tone: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card>
      <form onSubmit={(event) => void add(event)} noValidate className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <InputField
            label={t('tags.newTag')}
            placeholder={t('tags.placeholder')}
            value={name}
            error={nameError ?? undefined}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" loading={createTag.isPending}>
          <Plus className="size-4" aria-hidden /> {t('common.add')}
        </Button>
      </form>

      {tags.isPending ? (
        <LoadingRows rows={4} />
      ) : tags.isError ? (
        <ErrorState error={tags.error} onRetry={() => void tags.refetch()} />
      ) : tags.data.length === 0 ? (
        <EmptyState title={t('tags.empty')} description={t('tags.emptyHint')} />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {tags.data.map((tag) => (
            <TagRow key={tag.id} tag={tag} onDelete={setDeleting} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t('tags.deleteTitle')}
        message={t('tags.deleteMessage', { name: deleting?.name ?? '' })}
        loading={deleteTag.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  );
}
