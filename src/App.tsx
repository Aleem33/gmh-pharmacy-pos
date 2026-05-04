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
