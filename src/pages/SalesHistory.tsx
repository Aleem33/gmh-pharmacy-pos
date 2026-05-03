import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatCurrency } from '../lib/utils';
import {
  Search, FileText, Eye, X, Printer, Download,
  Users, Building2, LayoutList, Table2,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';

type ExportType   = 'all' | 'customer' | 'hospital';
type ViewMode     = 'summary' | 'excel';
type SortDir      = 'asc' | 'desc' | null;

type SummaryCol = 'date' | 'type' | 'items' | 'subtotal' | 'discount' | 'total';
type ExcelCol   = 'date' | 'type' | 'itemName' | 'sellType' | 'quantity' | 'unitPrice' | 'itemTotal' | 'subtotal' | 'discount' | 'saleTotal';

interface SortState<T extends string> { col: T | null; dir: SortDir }

function SortIcon({ col, sort }: { col: string; sort: SortState<any> }) {
  if (sort.col !== col) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-30" />;
  return sort.dir === 'asc'
    ? <ArrowUp   className="w-3.5 h-3.5 ml-1 text-blue-500" />
    : <ArrowDown className="w-3.5 h-3.5 ml-1 text-blue-500" />;
}

function thClass(active: boolean) {
  return `p-4 font-medium select-none cursor-pointer whitespace-nowrap ${active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`;
}

/**
 * Returns the GROSS subtotal (before any discounts) for a sale record so that:
 *   grossSubtotal − totalDiscount = finalTotal  ✓
 *
 * Old records only have `subtotal` (which is post-item-discount); for those we
 * reconstruct:  gross = subtotal + totalItemDiscounts
 */
function getGross(sale: any): number {
  if (sale.grossSubtotal != null) return sale.grossSubtotal;
  return (sale.subtotal || 0) + (sale.totalItemDiscounts || 0);
}

export function SalesHistory() {
  const [sales, setSales]               = useState<any[]>([]);
  const [search, setSearch]             = useState('');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [showPrintAlert, setShowPrintAlert] = useState(false);
  const [viewMode, setViewMode]         = useState<ViewMode>('summary');

  const [typeFilter, setTypeFilter]     = useState<'all' | 'customer' | 'hospital'>('all');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  const [summarySort, setSummarySort]   = useState<SortState<SummaryCol>>({ col: 'date', dir: 'desc' });
  const [excelSort,   setExcelSort]     = useState<SortState<ExcelCol>  >({ col: 'date', dir: 'desc' });

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType,      setExportType]      = useState<ExportType>('all');
  const [exportDateFrom,  setExportDateFrom]  = useState('');
  const [exportDateTo,    setExportDateTo]    = useState('');

  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.GET, 'sales'));
    return () => unsub();
  }, []);

  const applyFilters = (list: any[], tf: typeof typeFilter, df: string, dt: string, q: string) =>
    list.filter(s => {
      const matchSearch =
        s.id.toLowerCase().includes(q.toLowerCase()) ||
        (s.date && format(new Date(s.date), 'MMM dd, yyyy').toLowerCase().includes(q.toLowerCase())) ||
        (s.customerName && s.customerName.toLowerCase().includes(q.toLowerCase())) ||
        (s.hospitalName  && s.hospitalName.toLowerCase().includes(q.toLowerCase())) ||
        (s.items?.some((it: any) => it.name?.toLowerCase().includes(q.toLowerCase())));

      const matchType =
        tf === 'all' ||
        (tf === 'hospital' ? s.customerType === 'hospital' : s.customerType !== 'hospital');

      let matchDate = true;
      if (df || dt) {
        const d = s.date ? new Date(s.date) : null;
        if (d) {
          if (df && dt) matchDate = isWithinInterval(d, { start: startOfDay(parseISO(df)), end: endOfDay(parseISO(dt)) });
          else if (df)  matchDate = d >= startOfDay(parseISO(df));
          else if (dt)  matchDate = d <= endOfDay(parseISO(dt));
        } else matchDate = false;
      }
      return matchSearch && matchType && matchDate;
    });

  const filteredSales = useMemo(
    () => applyFilters(sales, typeFilter, dateFrom, dateTo, search),
    [sales, typeFilter, dateFrom, dateTo, search]
  );

  const sortedSummary = useMemo(() => {
    const arr = [...filteredSales];
    const { col, dir } = summarySort;
    if (!col || !dir) return arr;
    arr.sort((a, b) => {
      let av: any, bv: any;
      if (col === 'date')     { av = new Date(a.date || 0).getTime(); bv = new Date(b.date || 0).getTime(); }
      if (col === 'type')     { av = a.customerType || 'customer';    bv = b.customerType || 'customer'; }
      if (col === 'items')    { av = a.items?.length || 0;            bv = b.items?.length || 0; }
      if (col === 'subtotal') { av = getGross(a);                     bv = getGross(b); }
      if (col === 'discount') { av = a.discount || 0;                 bv = b.discount || 0; }
      if (col === 'total')    { av = a.total || 0;                    bv = b.total || 0; }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ?  1 : -1;
      return 0;
    });
    return arr;
  }, [filteredSales, summarySort]);

  const flatRows = useMemo(() => {
    const rows: any[] = [];
    filteredSales.forEach(sale => {
      if (sale.items?.length) {
        sale.items.forEach((item: any) => { rows.push({ sale, item }); });
      } else {
        rows.push({ sale, item: null });
      }
    });
    return rows;
  }, [filteredSales]);

  const sortedExcel = useMemo(() => {
    const arr = [...flatRows];
    const { col, dir } = excelSort;
    if (!col || !dir) return arr;
    arr.sort(({ sale: a, item: ai }, { sale: b, item: bi }) => {
      let av: any, bv: any;
      if (col === 'date')      { av = new Date(a.date || 0).getTime();   bv = new Date(b.date || 0).getTime(); }
      if (col === 'type')      { av = a.customerType || 'customer';       bv = b.customerType || 'customer'; }
      if (col === 'itemName')  { av = ai?.name  || '';                    bv = bi?.name  || ''; }
      if (col === 'sellType')  { av = ai?.sellType || '';                 bv = bi?.sellType || ''; }
      if (col === 'quantity')  { av = ai?.quantity || 0;                  bv = bi?.quantity || 0; }
      if (col === 'unitPrice') { av = ai?.price || 0;                     bv = bi?.price || 0; }
      if (col === 'itemTotal') { av = ai?.total || 0;                     bv = bi?.total || 0; }
      if (col === 'subtotal')  { av = getGross(a);                        bv = getGross(b); }
      if (col === 'discount')  { av = a.discount || 0;                    bv = b.discount || 0; }
      if (col === 'saleTotal') { av = a.total || 0;                       bv = b.total || 0; }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ?  1 : -1;
      return 0;
    });
    return arr;
  }, [flatRows, excelSort]);

  const toggleSummarySort = (col: SummaryCol) =>
    setSummarySort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : prev.dir === 'desc' ? null : 'asc' }
        : { col, dir: 'asc' }
    );

  const toggleExcelSort = (col: ExcelCol) =>
    setExcelSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : prev.dir === 'desc' ? null : 'asc' }
        : { col, dir: 'asc' }
    );

  // ── totals: use grossSubtotal so that Subtotal − Discount = Total ─────────
  const totals = useMemo(() => ({
    subtotal: filteredSales.reduce((s, r) => s + getGross(r), 0),
    discount: filteredSales.reduce((s, r) => s + (r.discount || 0), 0),
    total:    filteredSales.reduce((s, r) => s + (r.total    || 0), 0),
    pending:  filteredSales.reduce((s, r) => s + (r.pendingAmount || 0), 0),
  }), [filteredSales]);

  const handlePrint = () => {
    if (window !== window.top) { setShowPrintAlert(true); setTimeout(() => setShowPrintAlert(false), 5000); }
    else window.print();
  };

  const doExport = () => {
    const exportSales = applyFilters(sales, exportType, exportDateFrom, exportDateTo, '');
    const rows: string[][] = [
      ['Date & Time','Sale ID','Sale Type','Customer','Item Name','Sell Type','Quantity','Unit Price','Item Total','Gross Subtotal','Sale Discount','Sale Total','Amount Paid','Pending Amount'],
    ];
    exportSales.forEach(sale => {
      const dateStr  = sale.date ? format(new Date(sale.date), 'dd/MM/yyyy HH:mm') : 'N/A';
      const saleType = sale.customerType === 'hospital' ? 'Hospital' : 'Customer';
      const custName = sale.customerName || '';
      const gross    = getGross(sale);
      const paid     = sale.amountPaid ?? sale.total ?? 0;
      const pending  = sale.pendingAmount || 0;
      if (sale.items?.length) {
        sale.items.forEach((item: any, idx: number) => {
          rows.push([
            dateStr, sale.id, saleType, custName,
            item.name || '', item.sellType || '',
            String(item.quantity || 0), String(item.price || 0), String(item.total || 0),
            idx === 0 ? String(gross)              : '',
            idx === 0 ? String(sale.discount || 0) : '',
            idx === 0 ? String(sale.total    || 0) : '',
            idx === 0 ? String(paid)               : '',
            idx === 0 ? String(pending)            : '',
          ]);
        });
      } else {
        rows.push([dateStr, sale.id, saleType, custName, '(no items)', '', '', '', '',
          String(gross), String(sale.discount || 0), String(sale.total || 0), String(paid), String(pending)]);
      }
    });
    const gSub = exportSales.reduce((s, r) => s + getGross(r), 0);
    const gDis = exportSales.reduce((s, r) => s + (r.discount || 0), 0);
    const gTot = exportSales.reduce((s, r) => s + (r.total    || 0), 0);
    const gPen = exportSales.reduce((s, r) => s + (r.pendingAmount || 0), 0);
    const gQty = exportSales.reduce((s, r) => s + (r.items?.reduce((q: number, it: any) => q + (it.quantity || 0), 0) || 0), 0);
    rows.push([]);
    rows.push(['TOTAL', `${exportSales.length} sales`, '', '', '', '', String(gQty), '', '', String(gSub), String(gDis), String(gTot), '', String(gPen)]);

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const typeLabel  = exportType === 'all' ? 'all' : exportType === 'hospital' ? 'hospitals' : 'customers';
    const rangeLabel = exportDateFrom && exportDateTo ? `${exportDateFrom}_to_${exportDateTo}` : exportDateFrom ? `from_${exportDateFrom}` : exportDateTo ? `to_${exportDateTo}` : 'all_dates';
    link.href = url; link.download = `sales_${typeLabel}_${rangeLabel}.csv`;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const clearFilters = () => { setTypeFilter('all'); setDateFrom(''); setDateTo(''); setSearch(''); };
  const hasActiveFilters = typeFilter !== 'all' || dateFrom !== '' || dateTo !== '' || search !== '';

  const exportPreviewCount = useMemo(
    () => applyFilters(sales, exportType, exportDateFrom, exportDateTo, '').length,
    [sales, exportType, exportDateFrom, exportDateTo]
  );

  return (
    <>
      {showPrintAlert && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <p className="font-medium">Printing is blocked in this preview.</p>
          <p className="text-sm opacity-90">Please open the app in a new tab to print, or press Ctrl+P / Cmd+P.</p>
        </div>
      )}

      {/* Printable receipt */}
      {selectedSale && (
        <div className="hidden print:block w-[80mm] mx-auto bg-white text-black text-sm font-mono p-4">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold">GMH Pharmacy</h2>
            <p>Receipt (Reprint)</p>
            <p>{selectedSale.date ? format(new Date(selectedSale.date), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
            <p className="text-xs mt-1">ID: {selectedSale.id.slice(0, 8)}</p>
            {selectedSale.customerName && <p className="text-xs mt-1">Customer: {selectedSale.customerName}</p>}
          </div>
          <table className="w-full mb-4">
            <thead><tr className="border-b border-black border-dashed"><th className="text-left pb-1">Item</th><th className="text-center pb-1">Qty</th><th className="text-right pb-1">Total</th></tr></thead>
            <tbody className="divide-y divide-gray-100 divide-dashed">
              {selectedSale.items?.map((item: any) => (
                <tr key={item.cartItemId}>
                  <td className="py-1"><div className="line-clamp-1">{item.name}</div><div className="text-xs text-gray-500">{item.sellType === 'box' ? '(Box)' : '(Unit)'} @ {formatCurrency(item.price)}</div></td>
                  <td className="text-center py-1">{item.quantity}</td>
                  <td className="text-right py-1">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-black border-dashed pt-2 space-y-1">
            <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(getGross(selectedSale))}</span></div>
            {selectedSale.discount > 0 && <div className="flex justify-between"><span>Discount:</span><span>-{formatCurrency(selectedSale.discount)}</span></div>}
            <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-black"><span>Total:</span><span>{formatCurrency(selectedSale.total)}</span></div>
            {selectedSale.pendingAmount > 0 && (
              <>
                <div className="flex justify-between"><span>Paid:</span><span>{formatCurrency(selectedSale.amountPaid)}</span></div>
                <div className="flex justify-between font-bold"><span>Pending:</span><span>{formatCurrency(selectedSale.pendingAmount)}</span></div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6 print:hidden">
        {/* Header */}
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
              <button onClick={() => setViewMode('summary')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <LayoutList className="w-4 h-4" /> Summary
              </button>
              <button onClick={() => setViewMode('excel')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'excel' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Table2 className="w-4 h-4" /> Excel View
              </button>
            </div>
            <button onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm">
              <Download className="w-4 h-4" /> Export to Excel
            </button>
          </div>
        </div>

        {/* Totals banner */}
        {filteredSales.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Gross Subtotal', value: totals.subtotal, color: 'text-gray-900' },
              { label: 'Total Discounts', value: totals.discount, color: 'text-red-600', prefix: '-' },
              { label: 'Net Revenue', value: totals.total, color: 'text-blue-700' },
              { label: 'Pending Amounts', value: totals.pending, color: totals.pending > 0 ? 'text-orange-600' : 'text-gray-400' },
            ].map(({ label, value, color, prefix }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{prefix}{formatCurrency(value)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search by ID, date, customer, item name…" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {(['all', 'customer', 'hospital'] as const).map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      typeFilter === t
                        ? t === 'hospital' ? 'bg-purple-600 text-white shadow-sm'
                          : t === 'customer' ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {t === 'all' ? 'All' : t === 'customer' ? 'Customers' : 'Hospitals'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">From:</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">To:</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg hover:border-red-200 transition-colors">
                  <X className="w-4 h-4" /> Clear
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 flex-wrap gap-2">
              <span>
                {viewMode === 'summary'
                  ? <><span className="font-semibold text-gray-700">{sortedSummary.length}</span> of <span className="font-semibold text-gray-700">{sales.length}</span> sales</>
                  : <><span className="font-semibold text-gray-700">{sortedExcel.length}</span> item rows from <span className="font-semibold text-gray-700">{filteredSales.length}</span> sales</>
                }
              </span>
              {(dateFrom || dateTo) && <span className="text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded font-medium">Custom date range active</span>}
            </div>
          </div>

          {/* ── SUMMARY VIEW ── */}
          {viewMode === 'summary' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-sm">
                    <th className={thClass(summarySort.col === 'date')}     onClick={() => toggleSummarySort('date')}><span className="flex items-center">Date & Time <SortIcon col="date" sort={summarySort} /></span></th>
                    <th className="p-4 font-medium text-gray-500">Sale ID</th>
                    <th className="p-4 font-medium text-gray-500">Customer</th>
                    <th className={thClass(summarySort.col === 'type')}     onClick={() => toggleSummarySort('type')}><span className="flex items-center">Type <SortIcon col="type" sort={summarySort} /></span></th>
                    <th className={thClass(summarySort.col === 'items')}    onClick={() => toggleSummarySort('items')}><span className="flex items-center">Items <SortIcon col="items" sort={summarySort} /></span></th>
                    <th className={thClass(summarySort.col === 'subtotal')} onClick={() => toggleSummarySort('subtotal')}><span className="flex items-center">Subtotal <SortIcon col="subtotal" sort={summarySort} /></span></th>
                    <th className={thClass(summarySort.col === 'discount')} onClick={() => toggleSummarySort('discount')}><span className="flex items-center">Discount <SortIcon col="discount" sort={summarySort} /></span></th>
                    <th className={thClass(summarySort.col === 'total')}    onClick={() => toggleSummarySort('total')}><span className="flex items-center">Total <SortIcon col="total" sort={summarySort} /></span></th>
                    <th className="p-4 font-medium text-gray-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedSummary.map(sale => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="p-4 text-gray-900 font-medium">{sale.date ? format(new Date(sale.date), 'MMM dd, yyyy HH:mm') : 'N/A'}</td>
                      <td className="p-4 text-gray-500 font-mono text-sm">{sale.id.slice(0, 8)}…</td>
                      <td className="p-4 text-sm">
                        {sale.customerName
                          ? <span className="font-medium text-gray-800">{sale.customerName}</span>
                          : <span className="text-gray-300 italic text-xs">—</span>
                        }
                        {sale.pendingAmount > 0 && (
                          <span className="ml-1.5 inline-block px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold whitespace-nowrap">
                            Due {formatCurrency(sale.pendingAmount)}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${sale.customerType === 'hospital' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {sale.customerType || 'customer'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600">{sale.items?.length || 0} items</td>
                      <td className="p-4 text-gray-600">{formatCurrency(getGross(sale))}</td>
                      <td className="p-4 text-red-600">{sale.discount > 0 ? `-${formatCurrency(sale.discount)}` : '—'}</td>
                      <td className="p-4 font-bold text-gray-900">{formatCurrency(sale.total)}</td>
                      <td className="p-4 flex justify-end">
                        <button onClick={() => setSelectedSale(sale)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1 text-sm font-medium">
                          <Eye className="w-4 h-4" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedSummary.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-gray-500">
                      <div className="flex flex-col items-center"><FileText className="w-12 h-12 text-gray-300 mb-2" /><p>No sales records found.</p>
                        {hasActiveFilters && <button onClick={clearFilters} className="mt-2 text-blue-600 text-sm hover:underline">Clear filters</button>}
                      </div>
                    </td></tr>
                  )}
                </tbody>
                {sortedSummary.length > 0 && (
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold text-sm">
                      <td className="p-4 text-blue-800" colSpan={5}>TOTAL — {filteredSales.length} sales</td>
                      <td className="p-4 text-blue-800">{formatCurrency(totals.subtotal)}</td>
                      <td className="p-4 text-red-600">-{formatCurrency(totals.discount)}</td>
                      <td className="p-4 text-blue-900 text-base">{formatCurrency(totals.total)}</td>
                      <td className="p-4"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* ── EXCEL VIEW ── */}
          {viewMode === 'excel' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className={thClass(excelSort.col === 'date')}      onClick={() => toggleExcelSort('date')}><span className="flex items-center">Date & Time <SortIcon col="date" sort={excelSort} /></span></th>
                    <th className="p-4 font-medium text-gray-500 whitespace-nowrap">Sale ID</th>
                    <th className={thClass(excelSort.col === 'type')}      onClick={() => toggleExcelSort('type')}><span className="flex items-center">Type <SortIcon col="type" sort={excelSort} /></span></th>
                    <th className={thClass(excelSort.col === 'itemName')}  onClick={() => toggleExcelSort('itemName')}><span className="flex items-center">Item Name <SortIcon col="itemName" sort={excelSort} /></span></th>
                    <th className={thClass(excelSort.col === 'sellType')}  onClick={() => toggleExcelSort('sellType')}><span className="flex items-center">Sell Type <SortIcon col="sellType" sort={excelSort} /></span></th>
                    <th className={thClass(excelSort.col === 'quantity')}  onClick={() => toggleExcelSort('quantity')}><span className="flex items-center">Qty <SortIcon col="quantity" sort={excelSort} /></span></th>
                    <th className={thClass(excelSort.col === 'unitPrice')} onClick={() => toggleExcelSort('unitPrice')}><span className="flex items-center">Unit Price <SortIcon col="unitPrice" sort={excelSort} /></span></th>
                    <th className={thClass(excelSort.col === 'itemTotal')} onClick={() => toggleExcelSort('itemTotal')}><span className="flex items-center">Item Total <SortIcon col="itemTotal" sort={excelSort} /></span></th>
                    <th className={thClass(excelSort.col === 'subtotal')}  onClick={() => toggleExcelSort('subtotal')}><span className="flex items-center">Gross Subtotal <SortIcon col="subtotal" sort={excelSort} /></span></th>
                    <th className={thClass(excelSort.col === 'discount')}  onClick={() => toggleExcelSort('discount')}><span className="flex items-center">Discount <SortIcon col="discount" sort={excelSort} /></span></th>
                    <th className={thClass(excelSort.col === 'saleTotal')} onClick={() => toggleExcelSort('saleTotal')}><span className="flex items-center">Sale Total <SortIcon col="saleTotal" sort={excelSort} /></span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedExcel.map(({ sale, item }, idx) => (
                    <tr key={`${sale.id}-${idx}`} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-700 whitespace-nowrap">{sale.date ? format(new Date(sale.date), 'MMM dd, yyyy HH:mm') : 'N/A'}</td>
                      <td className="p-3 text-gray-400 font-mono text-xs">{sale.id.slice(0, 8)}…</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${sale.customerType === 'hospital' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {sale.customerType || 'customer'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-900 font-medium">{item?.name || <span className="text-gray-400 italic">—</span>}</td>
                      <td className="p-3">
                        {item ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${item.sellType === 'box' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {item.sellType}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-3 text-gray-700 text-center">{item?.quantity ?? '—'}</td>
                      <td className="p-3 text-gray-600">{item ? formatCurrency(item.price) : '—'}</td>
                      <td className="p-3 text-gray-800 font-medium">{item ? formatCurrency(item.total) : '—'}</td>
                      <td className="p-3 text-gray-600">{formatCurrency(getGross(sale))}</td>
                      <td className="p-3 text-red-500">{sale.discount > 0 ? `-${formatCurrency(sale.discount)}` : '—'}</td>
                      <td className="p-3 font-bold text-gray-900">{formatCurrency(sale.total)}</td>
                    </tr>
                  ))}
                  {sortedExcel.length === 0 && (
                    <tr><td colSpan={11} className="p-8 text-center text-gray-500">
                      <div className="flex flex-col items-center"><FileText className="w-12 h-12 text-gray-300 mb-2" /><p>No records found.</p>
                        {hasActiveFilters && <button onClick={clearFilters} className="mt-2 text-blue-600 text-sm hover:underline">Clear filters</button>}
                      </div>
                    </td></tr>
                  )}
                </tbody>
                {sortedExcel.length > 0 && (
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold text-sm">
                      <td className="p-4 text-blue-800" colSpan={5}>TOTAL — {filteredSales.length} sales / {sortedExcel.length} item rows</td>
                      <td className="p-4 text-blue-800 text-center">{sortedExcel.reduce((s, { item }) => s + (item?.quantity || 0), 0)}</td>
                      <td className="p-4"></td>
                      <td className="p-4 text-blue-800">{formatCurrency(sortedExcel.reduce((s, { item }) => s + (item?.total || 0), 0))}</td>
                      <td className="p-4 text-blue-800">{formatCurrency(totals.subtotal)}</td>
                      <td className="p-4 text-red-600">-{formatCurrency(totals.discount)}</td>
                      <td className="p-4 text-blue-900 text-base">{formatCurrency(totals.total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Sale Details Modal */}
        {selectedSale && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Sale Details</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedSale.date ? format(new Date(selectedSale.date), 'MMM dd, yyyy HH:mm') : 'N/A'} • ID: {selectedSale.id}
                    <span className={`ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${selectedSale.customerType === 'hospital' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {selectedSale.customerType || 'customer'}
                    </span>
                  </p>
                  {selectedSale.customerName && (
                    <p className="text-sm text-gray-800 mt-1 font-medium">
                      👤 {selectedSale.customerName}
                      {selectedSale.customerPhone && <span className="text-gray-400 font-normal"> • {selectedSale.customerPhone}</span>}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePrint} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Print Receipt"><Printer className="w-5 h-5" /></button>
                  <button onClick={() => setSelectedSale(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <h3 className="font-bold text-gray-900 mb-4">Items Purchased</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                        <th className="p-3 font-medium">Item</th><th className="p-3 font-medium text-center">Qty</th><th className="p-3 font-medium text-right">Price</th><th className="p-3 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedSale.items?.map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.sellType === 'box' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{item.sellType}</span>
                          </td>
                          <td className="p-3 text-center text-gray-600">{item.quantity}</td>
                          <td className="p-3 text-right text-gray-600">{formatCurrency(item.price)}</td>
                          <td className="p-3 text-right font-medium text-gray-900">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <div className="w-72 ml-auto space-y-2">
                  <div className="flex justify-between text-sm text-gray-600"><span>Gross Subtotal</span><span>{formatCurrency(getGross(selectedSale))}</span></div>
                  {(selectedSale.totalItemDiscounts || 0) > 0 && (
                    <div className="flex justify-between text-sm text-orange-600"><span>Item Discounts</span><span>-{formatCurrency(selectedSale.totalItemDiscounts)}</span></div>
                  )}
                  {(selectedSale.orderDiscount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-red-500"><span>Order Discount</span><span>-{formatCurrency(selectedSale.orderDiscount)}</span></div>
                  )}
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-blue-600">{formatCurrency(selectedSale.total)}</span>
                  </div>
                  {selectedSale.pendingAmount > 0 ? (
                    <>
                      <div className="flex justify-between text-sm text-green-700"><span>Amount Paid</span><span>{formatCurrency(selectedSale.amountPaid)}</span></div>
                      <div className="flex justify-between text-sm font-bold text-red-700 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                        <span>Pending Amount</span><span>{formatCurrency(selectedSale.pendingAmount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                      <span>✓ Fully Paid</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Export Sales to Excel</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Each item sold will be a separate row</p>
                </div>
                <button onClick={() => setShowExportModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Sale Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'all',      label: 'All Sales',       icon: Download,  color: 'gray' },
                      { value: 'customer', label: 'Customers Only',  icon: Users,     color: 'blue' },
                      { value: 'hospital', label: 'Hospitals Only',  icon: Building2, color: 'purple' },
                    ] as const).map(opt => (
                      <button key={opt.value} onClick={() => setExportType(opt.value)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-center ${
                          exportType === opt.value
                            ? opt.color === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : opt.color === 'purple' ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-500 bg-gray-50 text-gray-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        <opt.icon className="w-5 h-5" />
                        <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date Range <span className="text-gray-400 font-normal">(optional)</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs text-gray-500 mb-1">From</label>
                      <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">To</label>
                      <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  </div>
                  {(exportDateFrom || exportDateTo) && (
                    <button onClick={() => { setExportDateFrom(''); setExportDateTo(''); }} className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1">
                      <X className="w-3 h-3" /> Clear dates
                    </button>
                  )}
                </div>
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-700">
                  Will export <span className="font-bold">{exportPreviewCount}</span> sales with all individual items
                </div>
              </div>
              <div className="p-6 pt-0 flex gap-3">
                <button onClick={() => setShowExportModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">Cancel</button>
                <button onClick={doExport} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors">
                  <Download className="w-4 h-4" /> Download CSV
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
