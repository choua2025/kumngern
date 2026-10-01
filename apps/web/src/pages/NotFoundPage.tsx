import { Link } from 'react-router';
import { EmptyState } from '../components/states';

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <EmptyState
        title="ไม่พบหน้านี้"
        action={
          <Link to="/" className="text-sm font-medium text-blue-600 hover:underline">
            กลับหน้าแรก
          </Link>
        }
      />
    </main>
  );
}
