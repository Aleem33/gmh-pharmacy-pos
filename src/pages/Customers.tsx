import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatCurrency } from '../lib/utils';
import { Plus, Edit2, Trash2, Search, ChevronDown, ChevronUp, Eye, X } from 'lucide-react';
import { format } from 'date-fns';

export function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [sales, setSales]         = useState<any[]>([]);
  const [search, setSearch]       = useState('');
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    creditBalance: '0',
  });

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'customers'), snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.GET, 'customers'));

    const unsub2 = onSnapshot(collection(db, 'sales'), snap => {
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.GET, 'sales'));

    return () => { unsub1(); unsub2(); };
  }, []);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  /** All sales belonging to a customer, newest first */
  const customerSales = (customerId: string) =>
    sales
      .filter(s => s.customerId === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPending = filteredCustomers.reduce((sum, c) => sum + (c.creditBalance || 0), 0);

  // ── Form submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name:          formData.name,
        phone:         formData.phone,
        creditBalance: Number(formData.creditBalance),
      };
      if (editingId) {
        await updateDoc(doc(db, 'customers', editingId), data);
      } else {
        await addDoc(collection(db, 'customers'), { ...data, createdAt: new Date().toISOString() });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', phone: '', creditBalance: '0' });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'customers');
    }
  };

  const handleEdit = (cust: any) => {
    setFormData({ name: cust.name, phone: cust.phone, creditBalance: String(cust.creditBalance || 0) });
    setEditingId(cust.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await deleteDoc(doc(db, 'customers', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          {totalPending > 0 && (
            <p className="text-sm text-red-600 mt-0.5 font-medium">
              Total outstanding balance: {formatCurrency(totalPending)}
            </p>
          )}
        </div>
        <button
          onClick={() => { setEditingId(null); setFormData({ name: '', phone: '', creditBalance: '0' }); setIsModalOpen(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredCustomers.map(cust => {
            const custSales  = customerSales(cust.id);
            const isExpanded = expandedId === cust.id;

            return (
              <div key={cust.id}>
                {/* Customer row */}
                <div className="p-4 hover:bg-gray-50 flex items-center gap-3 flex-wrap">
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : cust.id)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0"
                    title={isExpanded ? 'Collapse' : 'View sale history'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                    <div>
                      <p className="font-semibold text-gray-900">{cust.name}</p>
                      <p className="text-sm text-gray-500">{cust.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Outstanding Balance</p>
                      <span className={`font-semibold text-sm ${cust.creditBalance > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {formatCurrency(cust.creditBalance || 0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Total Sales</p>
                      <span className="text-sm font-medium text-gray-700">
                        {custSales.length} sale{custSales.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Added On</p>
                      <span className="text-sm text-gray-600">
                        {cust.createdAt ? format(new Date(cust.createdAt), 'MMM dd, yyyy') : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleEdit(cust)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(cust.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable sales history */}
                {isExpanded && (
                  <div className="bg-blue-50 border-t border-blue-100 px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-blue-800">
                        Sale History for {cust.name}
                      </h3>
                      {cust.creditBalance > 0 && (
                        <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                          Outstanding: {formatCurrency(cust.creditBalance)}
                        </span>
                      )}
                    </div>

                    {custSales.length === 0 ? (
                      <p className="text-sm text-blue-400 italic">No sales recorded for this customer yet.</p>
                    ) : (
                      <div className="rounded-lg overflow-hidden border border-blue-200 bg-white">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider">
                              <th className="p-3">Date</th>
                              <th className="p-3">Items</th>
                              <th className="p-3 text-right">Total</th>
                              <th className="p-3 text-right">Paid</th>
                              <th className="p-3 text-right">Pending</th>
                              <th className="p-3 text-right">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {custSales.map(sale => (
                              <tr key={sale.id} className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 text-gray-700 whitespace-nowrap">
                                  {sale.date ? format(new Date(sale.date), 'MMM dd, yyyy HH:mm') : 'N/A'}
                                </td>
                                <td className="p-3 text-gray-600">
                                  {sale.items?.length || 0} item{(sale.items?.length || 0) !== 1 ? 's' : ''}
                                </td>
                                <td className="p-3 text-right font-semibold text-gray-900">
                                  {formatCurrency(sale.total)}
                                </td>
                                <td className="p-3 text-right text-green-700 font-medium">
                                  {formatCurrency(sale.amountPaid ?? sale.total)}
                                </td>
                                <td className="p-3 text-right">
                                  {(sale.pendingAmount || 0) > 0 ? (
                                    <span className="font-bold text-red-600">
                                      {formatCurrency(sale.pendingAmount)}
                                    </span>
                                  ) : (
                                    <span className="text-green-600 text-xs font-medium">✓ Paid</span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={() => setSelectedSale(sale)}
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-blue-50 border-t-2 border-blue-200 text-xs font-bold">
                              <td className="p-3 text-blue-800" colSpan={2}>
                                TOTAL — {custSales.length} sale{custSales.length !== 1 ? 's' : ''}
                              </td>
                              <td className="p-3 text-right text-blue-900">
                                {formatCurrency(custSales.reduce((s, r) => s + (r.total || 0), 0))}
                              </td>
                              <td className="p-3 text-right text-green-700">
                                {formatCurrency(custSales.reduce((s, r) => s + (r.amountPaid ?? r.total ?? 0), 0))}
                              </td>
                              <td className="p-3 text-right text-red-600">
                                {formatCurrency(custSales.reduce((s, r) => s + (r.pendingAmount || 0), 0))}
                              </td>
                              <td className="p-3"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredCustomers.length === 0 && (
            <div className="p-8 text-center text-gray-500">No customers found.</div>
          )}
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Customer' : 'Add Customer'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required type="text" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input required type="text" value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Outstanding Balance (Amount Owed)
                </label>
                <input required type="number" step="0.01" min="0" value={formData.creditBalance}
                  onChange={e => setFormData({ ...formData, creditBalance: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md font-medium">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700">
                  {editingId ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Sale Details</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedSale.date ? format(new Date(selectedSale.date), 'MMM dd, yyyy HH:mm') : 'N/A'}
                  {' '}• ID: {selectedSale.id.slice(0, 10)}…
                </p>
              </div>
              <button onClick={() => setSelectedSale(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-200">
                      <th className="p-3 font-medium">Item</th>
                      <th className="p-3 font-medium text-center">Qty</th>
                      <th className="p-3 font-medium text-right">Price</th>
                      <th className="p-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedSale.items?.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${item.sellType === 'box' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {item.sellType}
                          </span>
                          {item.itemDiscount > 0 && (
                            <p className="text-xs text-orange-600 mt-0.5">Disc: -{formatCurrency(item.itemDiscount)}</p>
                          )}
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

            <div className="p-5 border-t border-gray-100 bg-gray-50 space-y-2">
              <div className="w-64 ml-auto space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Gross Subtotal</span>
                  <span>{formatCurrency(selectedSale.grossSubtotal || selectedSale.subtotal || 0)}</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Discount</span><span>-{formatCurrency(selectedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-blue-600 text-lg">{formatCurrency(selectedSale.total)}</span>
                </div>
                {(selectedSale.pendingAmount || 0) > 0 ? (
                  <>
                    <div className="flex justify-between text-sm text-green-700">
                      <span>Amount Paid</span>
                      <span>{formatCurrency(selectedSale.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-red-700 bg-red-50 px-3 py-2 rounded-lg">
                      <span>Pending</span>
                      <span>{formatCurrency(selectedSale.pendingAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">✓ Fully Paid</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
