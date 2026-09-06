import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore, Notification } from '@/stores/notificationStore';
import { NotifIcon } from '@/components/shared/Header';
import { cn } from '@/lib/cn';

/** Locale for date formatting — mirrors i18next's active language. */
function dateLocale(language: string): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}

function notifAge(iso: string, t: (key: string, opts?: Record<string, unknown>) => string, language: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)  return t('notifications.time.justNow');
  if (diff < 60) return t('notifications.time.minsAgo', { count: diff });
  const h = Math.floor(diff / 60);
  if (h < 24)   return t('notifications.time.hrsAgo', { count: h });
  return new Date(iso).toLocaleDateString(dateLocale(language), { day: 'numeric', month: 'short' });
}

function groupByDate(
  notifications: Notification[],
  t: (key: string, opts?: Record<string, unknown>) => string,
  language: string,
): { label: string; items: Notification[] }[] {
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, Notification[]> = {};

  for (const n of notifications) {
    const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime())     label = t('notifications.groups.today');
    else if (d.getTime() === yesterday.getTime()) label = t('notifications.groups.yesterday');
    else label = d.toLocaleDateString(dateLocale(language), { weekday: 'long', day: 'numeric', month: 'long' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const navigate    = useNavigate();
  const fetch       = useNotificationStore((s) => s.fetch);
  const loadMore    = useNotificationStore((s) => s.loadMore);
  const markRead    = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount   = useNotificationStore((s) => s.unreadCount);
  const loading       = useNotificationStore((s) => s.loading);
  const loadingMore   = useNotificationStore((s) => s.loadingMore);
  const meta          = useNotificationStore((s) => s.meta);

  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    fetch(50).finally(() => setInitialLoad(false));
  }, [fetch]);

  const groups = groupByDate(notifications, t, i18n.language);

  async function handleClick(n: Notification) {
    if (!n.isRead) await markRead(n.id);
    if (n.link && n.link !== '/notifications') navigate(n.link);
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">{t('notifications.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {unreadCount > 0 ? t('notifications.unread', { count: unreadCount }) : t('notifications.allCaughtUp')}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            <CheckCheck size={13} /> {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      {/* Content */}
      {initialLoad || loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Bell size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-600">{t('notifications.emptyState.title')}</p>
          <p className="text-xs text-gray-400 mt-1">{t('notifications.emptyState.subtitle')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {label}
              </p>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
                {items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full text-left flex items-start gap-3.5 px-5 py-4 hover:bg-gray-50 transition-colors',
                      !n.isRead && 'bg-info/[0.04]',
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                      n.type === 'BULLETIN_URGENT' ? 'bg-danger/10'  :
                      n.type === 'TASK_OVERDUE'    ? 'bg-danger/10'  :
                      n.type === 'BULLETIN_NEW'    ? 'bg-warning/10' :
                      n.type === 'TASK_DUE_SOON'   ? 'bg-warning/10' :
                      n.type === 'SYSTEM'          ? 'bg-navy/10'    :
                      n.type === 'TASK_CREATED'    ? 'bg-navy/10'    :
                      n.type === 'TASK_COMPLETED'  ? 'bg-success/10' :
                      'bg-info/10',
                    )}>
                      <NotifIcon type={n.type} />
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          'text-sm leading-snug',
                          !n.isRead ? 'font-semibold text-gray-800' : 'font-medium text-gray-700',
                        )}>
                          {n.title}
                        </p>
                        <span className="flex items-center gap-1 text-[11px] text-gray-400 flex-shrink-0 mt-0.5">
                          <Clock size={10} /> {notifAge(n.createdAt, t, i18n.language)}
                        </span>
                      </div>

                      {/* Full message — no truncation */}
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed whitespace-pre-wrap">
                        {n.message}
                      </p>

                      {n.actor && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-semibold text-gray-500">
                            {n.actor.fullName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-gray-400">{n.actor.fullName}</span>
                        </div>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-info flex-shrink-0 mt-2" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {meta && meta.page < meta.totalPages && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => loadMore()}
                disabled={loadingMore}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-navy px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore ? <Loader2 size={12} className="animate-spin" /> : null}
                {t('notifications.loadMore')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
