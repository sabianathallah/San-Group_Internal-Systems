import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, Download, FileText, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import api from '@/lib/api';

interface ParsedRow {
  name: string; category: string; qty: string; unit: string; location: string; description: string;
  error: string | null;
}

interface ImportResult { created: number; failed: { row: number; name: string; error: string }[] }

const TEMPLATE_HEADERS = ['name', 'category', 'qty', 'unit', 'location', 'description'];
const TEMPLATE_EXAMPLE = ['Laptop Dell Latitude', 'Elektronik', '5', 'unit', 'Gudang IT', 'Contoh baris — hapus sebelum import'];

/** RFC4180-ish CSV parser — handles quoted fields with embedded commas/quotes/newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += ch; i += 1;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inventory-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportAssetsModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const table = parseCsv(text);
      if (table.length === 0) { toast.error(t('inventory.import.emptyFile')); return; }
      const header = table[0].map((h) => h.trim().toLowerCase());
      const idx = (name: string) => header.indexOf(name);
      const parsed: ParsedRow[] = table.slice(1).map((cells) => {
        const name = cells[idx('name')]?.trim() ?? '';
        const category = cells[idx('category')]?.trim() ?? '';
        const qty = cells[idx('qty')]?.trim() ?? '';
        const unit = cells[idx('unit')]?.trim() ?? '';
        const location = cells[idx('location')]?.trim() ?? '';
        const description = idx('description') >= 0 ? (cells[idx('description')]?.trim() ?? '') : '';
        let error: string | null = null;
        if (!name) error = t('inventory.import.errNameRequired');
        else if (!location) error = t('inventory.import.errLocationRequired');
        else if (qty === '' || Number.isNaN(Number(qty)) || Number(qty) < 0) error = t('inventory.import.errQtyInvalid');
        return { name, category, qty, unit, location, description, error };
      });
      setRows(parsed);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const validRows = rows.filter((r) => !r.error);
    if (validRows.length === 0) { toast.error(t('inventory.import.noValidRows')); return; }
    setImporting(true);
    try {
      const res = await api.post('/inventory/import', {
        rows: validRows.map((r) => ({
          name: r.name, category: r.category || undefined, qty: Number(r.qty),
          unit: r.unit || undefined, location: r.location, description: r.description || undefined,
        })),
      });
      setResult(res.data.data);
      if (res.data.data.created > 0) onImported();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('inventory.import.failed');
      toast.error(msg);
    } finally { setImporting(false); }
  }

  const validCount = rows.filter((r) => !r.error).length;
  const invalidCount = rows.length - validCount;
  const previewRows = rows.slice(0, 50);

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('inventory.import.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -m-1"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                <p className="text-sm text-emerald-800 font-medium">{t('inventory.import.createdSummary', { count: result.created })}</p>
              </div>
              {result.failed.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('inventory.import.failedSummary', { count: result.failed.length })}</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {result.failed.map((f) => (
                      <div key={f.row} className="flex items-start gap-2 text-xs p-2 bg-red-50 border border-red-100 rounded-lg">
                        <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="text-red-700">{t('inventory.import.rowLabel', { row: f.row })} "{f.name}" — {f.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <button type="button" onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline">
                <Download size={13} /> {t('inventory.import.downloadTemplate')}
              </button>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-navy/30 hover:bg-gray-50/50 transition-colors"
              >
                <Upload size={22} className="text-gray-300" />
                <p className="text-sm text-gray-500">{fileName || t('inventory.import.dropHint')}</p>
                <input
                  ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              {rows.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-2 text-xs">
                    <span className="flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle2 size={12} /> {t('inventory.import.validCount', { count: validCount })}</span>
                    {invalidCount > 0 && (
                      <span className="flex items-center gap-1 text-red-500 font-medium"><AlertTriangle size={12} /> {t('inventory.import.invalidCount', { count: invalidCount })}</span>
                    )}
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr className="text-left text-[10px] font-semibold text-gray-400 uppercase">
                            <th className="px-3 py-2">{t('inventory.form.name')}</th>
                            <th className="px-2 py-2">{t('inventory.form.category')}</th>
                            <th className="px-2 py-2 text-right">{t('inventory.form.qty')}</th>
                            <th className="px-2 py-2">{t('inventory.colLocation')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((r, i) => (
                            <tr key={i} className={cn('border-t border-gray-50', r.error && 'bg-red-50/50')}>
                              <td className="px-3 py-1.5">
                                <p className={cn('font-medium', r.error ? 'text-red-600' : 'text-gray-700')}>{r.name || '—'}</p>
                                {r.error && <p className="text-[10px] text-red-500">{r.error}</p>}
                              </td>
                              <td className="px-2 py-1.5 text-gray-500">{r.category || '—'}</td>
                              <td className="px-2 py-1.5 text-right text-gray-600 tabular-nums">{r.qty}</td>
                              <td className="px-2 py-1.5 text-gray-500">{r.location || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {rows.length > previewRows.length && (
                    <p className="text-[11px] text-gray-400 mt-1.5">{t('inventory.import.moreRows', { count: rows.length - previewRows.length })}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-3.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg">
            {result ? t('inventory.import.done') : t('inventory.form.cancel')}
          </button>
          {!result && (
            <button
              type="button" onClick={handleImport} disabled={importing || validCount === 0}
              className="px-4 py-2 text-sm font-medium bg-navy text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5 hover:bg-navy-light transition-colors"
            >
              {importing ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              {t('inventory.import.importN', { count: validCount })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
