import { CheckCircle2, AlertCircle, Info, X, Bell } from 'lucide-react';
import { useToastStore, Toast } from '@/stores/toastStore';
import { NotifIcon } from '@/components/shared/Header';
import { cn } from '@/lib/cn';

const ICONS = {
  success: <CheckCircle2 size={15} className="text-green-400 flex-shrink-0" />,
  error:   <AlertCircle  size={15} className="text-red-400 flex-shrink-0" />,
  info:    <Info         size={15} className="text-blue-400 flex-shrink-0" />,
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);

  if (t.type === 'notif') {
    return (
      <div
        onClick={() => { t.onClick?.(); dismiss(t.id); }}
        className={cn(
          'flex items-start gap-3 px-4 py-3 bg-gray-900 text-white rounded-xl shadow-2xl',
          'max-w-sm w-full pointer-events-auto text-left transition-opacity hover:opacity-90 cursor-pointer',
        )}
      >
        <div className="mt-0.5">
          {t.notifType
            ? <NotifIcon type={t.notifType} />
            : <Bell size={14} className="text-blue-400 flex-shrink-0" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{t.title}</p>
          <p className="text-xs text-white/60 mt-0.5 leading-snug line-clamp-2">{t.message}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
          className="text-white/40 hover:text-white flex-shrink-0 mt-0.5"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-2.5 px-4 py-3 bg-gray-900 text-white text-sm rounded-xl shadow-2xl',
      'max-w-md pointer-events-auto',
    )}>
      {ICONS[t.type as keyof typeof ICONS]}
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
