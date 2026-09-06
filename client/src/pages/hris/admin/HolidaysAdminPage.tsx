import { useEffect, useState, useCallback } from 'react';
import { CalendarOff, Plus, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { toast } from '@/stores/toastStore';

interface Holiday { id: string; date: string; name: string }

/** Locale for date formatting — mirrors i18next's active language. */
function dateLocale(language: string): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}

function fmtDate(iso: string, language: string) {
  return new Date(iso).toLocaleDateString(dateLocale(language), { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function HolidaysAdminPage() {
  const { t, i18n } = useTranslation();
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ date: '', name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/hris/holidays', { params: { year } });
      setHolidays(res.data.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleAdd() {
    if (!form.date || !form.name.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/hris/holidays', { date: form.date, name: form.name.trim() });
      toast.success(t('hris.admin.holidays.toast.added'));
      setForm({ date: '', name: '' });
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('hris.admin.holidays.toast.addFailed'));
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/hris/holidays/${id}`);
      toast.success(t('hris.admin.holidays.toast.removed'));
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('hris.admin.holidays.toast.removeFailed'));
    } finally { setDeletingId(null); }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarOff size={20} className="text-navy" /> {t('hris.admin.holidays.header.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('hris.admin.holidays.header.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1">
          <button onClick={() => setYear((y) => y - 1)} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 px-2">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={t('hris.admin.holidays.form.namePlaceholder')}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
        <button onClick={handleAdd} disabled={submitting || !form.date || !form.name.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy/90 disabled:opacity-40 transition-colors">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {t('hris.admin.holidays.form.add')}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : holidays.length === 0 ? (
        <div className="text-center py-12">
          <CalendarOff size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{t('hris.admin.holidays.empty', { year })}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{h.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{fmtDate(h.date, i18n.language)}</p>
              </div>
              <button onClick={() => handleDelete(h.id)} disabled={deletingId === h.id}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                {deletingId === h.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
