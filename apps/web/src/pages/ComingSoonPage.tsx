import { EmptyState } from '../components/states';

/** Placeholder for pages built in Phase 8 (wallets, categories, budgets, reports, settings). */
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <EmptyState title="กำลังพัฒนา" description="หน้านี้จะพร้อมใช้งานใน Phase 8" />
    </div>
  );
}
