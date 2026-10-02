import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState } from '../components/states';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-md p-6">
      <EmptyState
        title={t('errors.notFoundPage')}
        action={
          <Link to="/" className="text-sm font-medium text-blue-600 hover:underline">
            {t('errors.backHome')}
          </Link>
        }
      />
    </main>
  );
}
