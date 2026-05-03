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
  const [user, setUser] = useState<any>(undefined);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Bootstrap user in Firestore if they don't exist
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            // First user gets admin, others get cashier by default (for demo purposes)
            // In a real app, you'd have a more robust bootstrapping process
            const role = (currentUser.email === 'aleemfarrukh13@gmail.com' || currentUser.email === 'admin@gmhpharmacy.com') ? 'admin' : 'cashier';
            
            await setDoc(userRef, {
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown',
              email: currentUser.email,
              role: role,
              createdAt: new Date().toISOString()
            });
            setUserRole(role);
          } else {
            setUserRole(userSnap.data().role);
          }
        } catch (error) {
          console.error("Error bootstrapping user:", error);
        }
      } else {
        setUserRole(null);
      }
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  if (user === undefined || (user && !userRole)) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
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
