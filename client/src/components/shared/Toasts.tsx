import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, Toast } from '@/stores/toastStore';
import { cn } from '@/lib/cn';

const ICONS = {
  success: <CheckCircle2 size={15} className="text-green-400 flex-shrink-0" />,
  error:   <AlertCircle size={15} className="text-red-400 flex-shrink-0" />,
  info:    <Info size={15} className="text-blue-400 flex-shrink-0" />,
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className={cn(
      'flex items-center gap-2.5 px-4 py-3 bg-gray-900 text-white text-sm rounded-xl shadow-2xl',
      'max-w-md pointer-events-auto',
    )}>
      {ICONS[t.type]}
      <span className="flex-1 min-w-0">{t.message}</span>
      {t.onUndo && (
        <button
          onClick={() => dismiss(t.id, true)}
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 px-2 py-1 rounded hover:bg-white/10 flex-shrink-0"
        >
          Undo
        </button>
      )}
      <button onClick={() => dismiss(t.id)} className="text-white/40 hover:text-white flex-shrink-0">
        <X size={13} />
      </button>
    </div>
  );
}

export default function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => <ToastItem key={t.id} t={t} />)}
    </div>
  );
}
