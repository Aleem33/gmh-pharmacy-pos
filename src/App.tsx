import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateNotification } from './components/UpdateNotification';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Billing } from './pages/Billing';
import { Medicines } from './pages/Medicines';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { SalesHistory } from './pages/SalesHistory';
import { Expenses } from './pages/Expenses';
import { Settings } from './pages/Settings';
import { Purchases } from './pages/Purchases';
import { SalesReturns } from './pages/SalesReturns';
import { PurchaseReturns } from './pages/PurchaseReturns';

export default function App() {
  const [user, setUser]         = useState<any>(undefined);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [mainError, setMainError] = useState<string | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onMainError) return;
    api.onMainError((err: { message: string }) => {
      setMainError(err.message || 'An unexpected error occurred.');
    });
    return () => api.removeAllUpdateListeners?.();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userRef  = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            // New user — assign role based on email, default cashier
            const role =
              currentUser.email === 'aleemfarrukh13@gmail.com' ||
              currentUser.email === 'admin@gmhpharmacy.com'
                ? 'admin'
                : 'cashier';

            await setDoc(userRef, {
              name:      currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
              email:     currentUser.email,
              role,
              createdAt: new Date().toISOString(),
            });
            setUserRole(role);
          } else {
            // Use stored role — fallback to 'cashier' if field somehow missing
            setUserRole(userSnap.data().role || 'cashier');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          // IMPORTANT: never leave user stuck on loading screen
          // Fall back to cashier so they can at least use the app
          setUserRole('cashier');
        }
      } else {
        setUserRole(null);
      }
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // Loading screen — but with a safety timeout so it never hangs forever
  if (user === undefined || (user && !userRole)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ErrorBoundary>
      {mainError && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>Application error: {mainError}</span>
          </div>
          <button
            onClick={() => setMainError(null)}
            className="ml-4 text-white/80 hover:text-white text-lg leading-none"
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}
      <UpdateNotification />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout role={userRole!} />}>
            {(userRole === 'admin' || userRole === 'pharmacist') && <Route index element={<Dashboard />} />}
            {(userRole === 'admin' || userRole === 'cashier') && <Route path="billing" element={<Billing />} />}
            {(userRole === 'admin' || userRole === 'pharmacist') && <Route path="purchases" element={<Purchases />} />}
            <Route path="sales" element={<SalesHistory />} />
            {(userRole === 'admin' || userRole === 'cashier') && <Route path="sale-returns" element={<SalesReturns />} />}
            {(userRole === 'admin' || userRole === 'pharmacist') && <Route path="purchase-returns" element={<PurchaseReturns />} />}
            {(userRole === 'admin' || userRole === 'pharmacist') && <Route path="medicines" element={<Medicines />} />}
            {userRole === 'admin' && <Route path="customers" element={<Customers />} />}
            {(userRole === 'admin' || userRole === 'pharmacist') && <Route path="suppliers" element={<Suppliers />} />}
            {userRole === 'admin' && <Route path="expenses" element={<Expenses />} />}
            {userRole === 'admin' && <Route path="reports" element={<Reports />} />}
            {userRole === 'admin' && <Route path="users" element={<Users />} />}
            {userRole === 'admin' && <Route path="settings" element={<Settings />} />}

            {userRole === 'cashier' && <Route index element={<Navigate to="/billing" replace />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
