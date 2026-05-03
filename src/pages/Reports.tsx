import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatCurrency } from '../lib/utils';
import { format, isBefore, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, X } from 'lucide-react';

type PeriodFilter = 'daily' | 'weekly' | 'monthly' | 'custom' | 'all';

export function Reports() {
  const [sales, setSales] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]); // still used for low-stock & expiry alerts
  const [expenses, setExpenses] = useState<any[]>([]);

  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'sales'));

    const unsubMedicines = onSnapshot(collection(db, 'medicines'), (snapshot) => {
      setMedicines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'medicines'));

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'expenses'));

    return () => { unsubSales(); unsubMedicines(); unsubExpenses(); };
  }, []);

  // Build date range from period
  const getDateRange = (): { start: Date; end: Date } | null => {
    const now = new Date();
    if (period === 'daily') return { start: startOfDay(now), end: endOfDay(now) };
    if (period === 'weekly') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    if (period === 'monthly') return { start: startOfMonth(now), end: endOfMonth(now) };
    if (period === 'custom' && dateFrom && dateTo) {
      return { start: startOfDay(parseISO(dateFrom)), end: endOfDay(parseISO(dateTo)) };
    }
    if (period === 'custom' && dateFrom) return { start: startOfDay(parseISO(dateFrom)), end: endOfDay(now) };
    if (period === 'custom' && dateTo) return { start: new Date(0), end: endOfDay(parseISO(dateTo)) };
    return null;
  };

  const dateRange = getDateRange();

  const filteredSales = dateRange
    ? sales.filter(s => {
        const d = s.date ? new Date(s.date) : null;
        return d ? isWithinInterval(d, dateRange) : false;
      })
    : sales;

  const filteredExpenses = dateRange
    ? expenses.filter(e => {
        const d = e.date ? new Date(e.date) : null;
        return d ? isWithinInterval(d, dateRange) : false;
      })
    : expenses;

  // Calculate totals
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0);

  let totalCost = 0;
  filteredSales.forEach(sale => {
    sale.items?.forEach((item: any) => {
      // Use the costPrice and unitsPerBox saved on the sale item at time of sale,
      // not the current medicine data (which may have changed or been deleted).
      const costPrice = item.costPrice || 0;
      const unitsPerBox = item.unitsPerBox || 1;
      const costPerUnit = costPrice / unitsPerBox;
      const unitsSold = item.quantity * (item.sellType === 'box' ? unitsPerBox : 1);
      totalCost += costPerUnit * unitsSold;
    });
  });

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalProfit = totalRevenue - totalCost - totalExpenses;

  const nextMonth = addDays(new Date(), 30);
  const expiringMedicines = medicines.filter(m => m.expiryDate && isBefore(new Date(m.expiryDate), nextMonth));
  const lowStockMedicines = medicines.filter(m => m.stock <= (m.unitsPerBox || 1) * 2);

  const customerSales = filteredSales.filter(s => s.customerType === 'customer' || !s.customerType);
  const hospitalSales = filteredSales.filter(s => s.customerType === 'hospital');
  const customerTotal = customerSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
  const hospitalTotal = hospitalSales.reduce((sum, sale) => sum + (sale.total || 0), 0);

  const salesByDate = filteredSales.reduce((acc: any, sale) => {
    const date = sale.date ? format(new Date(sale.date), 'MMM dd') : 'Unknown';
    if (!acc[date]) acc[date] = 0;
    acc[date] += sale.total || 0;
    return acc;
  }, {});
  const chartData = Object.keys(salesByDate).map(date => ({ date, total: salesByDate[date] }));

  const periodLabels: Record<PeriodFilter, string> = {
    daily: 'Today',
    weekly: 'This Week',
    monthly: 'This Month',
    custom: 'Custom Range',
    all: 'All Time',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>

        {/* Period Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['daily', 'weekly', 'monthly', 'all'] as PeriodFilter[]).map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setDateFrom(''); setDateTo(''); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                  period === p ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p === 'all' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
            <button
              onClick={() => setPeriod('custom')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                period === 'custom' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Custom
            </button>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-sm">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Period badge */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium text-xs">
          {periodLabels[period]}
          {period === 'custom' && dateFrom && dateTo ? `: ${format(parseISO(dateFrom), 'MMM dd, yyyy')} – ${format(parseISO(dateTo), 'MMM dd, yyyy')}` : ''}
        </span>
        <span>{filteredSales.length} transactions</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Revenue</h3>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expenses</h3>
          <p className="text-3xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Estimated Profit</h3>
          <p className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalProfit)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Sales</h3>
          <p className="text-3xl font-bold text-blue-600">{filteredSales.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Customer Type */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Sales by Customer Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-blue-100 bg-blue-50 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">Walk-in Customers</p>
                <p className="text-2xl font-bold text-blue-900">{formatCurrency(customerTotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-300">{customerSales.length}</p>
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Transactions</p>
              </div>
            </div>
            <div className="p-4 rounded-lg border border-purple-100 bg-purple-50 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-purple-800 mb-1">Hospitals</p>
                <p className="text-2xl font-bold text-purple-900">{formatCurrency(hospitalTotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-purple-300">{hospitalSales.length}</p>
                <p className="text-xs font-medium text-purple-600 uppercase tracking-wider">Transactions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Revenue Trend</h2>
          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              No sales data for selected period.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} tickFormatter={val => `Rs. ${val}`} />
                  <Tooltip cursor={{ fill: '#F3F4F6' }} formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                  <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Low Stock Alerts ({lowStockMedicines.length})
            </h2>
            <div className="space-y-3 max-h-32 overflow-auto">
              {lowStockMedicines.map(m => (
                <div key={m.id} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700">{m.name}</span>
                  <span className="text-red-600 font-bold">{m.stock} left</span>
                </div>
              ))}
              {lowStockMedicines.length === 0 && <p className="text-sm text-gray-500">All stock levels are good.</p>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              Expiring Soon ({expiringMedicines.length})
            </h2>
            <div className="space-y-3 max-h-32 overflow-auto">
              {expiringMedicines.map(m => (
                <div key={m.id} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700">{m.name}</span>
                  <span className="text-orange-600 font-medium">
                    {m.expiryDate ? format(new Date(m.expiryDate), 'MMM dd, yyyy') : 'N/A'}
                  </span>
                </div>
              ))}
              {expiringMedicines.length === 0 && <p className="text-sm text-gray-500">No medicines expiring soon.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
