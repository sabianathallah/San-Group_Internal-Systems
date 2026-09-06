import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export function PageSizeSelect({
  value, onChange, options = [10, 20, 50, 100], className,
}: {
  value: number; onChange: (n: number) => void; options?: number[]; className?: string;
}) {
  const { t } = useTranslation();
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        'text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-navy/20',
        className,
      )}
    >
      {options.map((n) => (
        <option key={n} value={n}>{t('shared.pageSizeSelect.perPage', { count: n })}</option>
      ))}
    </select>
  );
}
