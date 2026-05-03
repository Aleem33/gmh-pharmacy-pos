import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Pill, Users, Truck, BarChart3, Settings, LogOut, UserCog, History, Receipt, PackagePlus, RotateCcw } from 'lucide-react';
import { logout } from '../firebase';
import { cn } from '../lib/utils';
import logo from '../../public/icon-192.png';

const allNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'pharmacist'] },
  { to: '/billing', icon: ShoppingCart, label: 'Billing', roles: ['admin', 'cashier'] },
  { to: '/purchases', icon: PackagePlus, label: 'Purchases', roles: ['admin', 'pharmacist'] },
  { to: '/purchase-returns', icon: RotateCcw, label: 'Purchase Returns', roles: ['admin', 'pharmacist'] },
  { to: '/sales', icon: History, label: 'Sales History', roles: ['admin', 'cashier', 'pharmacist'] },
  { to: '/sale-returns', icon: RotateCcw, label: 'Sale Returns', roles: ['admin', 'cashier'] },
  { to: '/medicines', icon: Pill, label: 'Medicines', roles: ['admin', 'pharmacist'] },
  { to: '/customers', icon: Users, label: 'Customers', roles: ['admin'] },
  { to: '/suppliers', icon: Truck, label: 'Suppliers', roles: ['admin', 'pharmacist'] },
  { to: '/expenses', icon: Receipt, label: 'Expenses', roles: ['admin'] },
  { to: '/reports', icon: BarChart3, label: 'Reports', roles: ['admin'] },
  { to: '/users', icon: UserCog, label: 'Users', roles: ['admin'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
];

export function Layout({ role }: { role: string }) {
  const navItems = allNavItems.filter(item => item.roles.includes(role));

  return (
    <div className="min-h-screen bg-gray-50 flex print:bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col print:hidden">
        <div className="h-20 flex items-center px-4 border-b border-gray-200 bg-blue-600">
          <div className="flex items-center gap-3">
            <img src={logo} alt="GMH Pharmacy" className="w-10 h-10 rounded-full border-2 border-white shadow" />
            <div>
              <div className="text-white font-bold text-base leading-tight">GMH Pharmacy</div>
              <div className="text-blue-100 text-xs">POS System</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible">
        <div className="flex-1 overflow-auto p-6 print:p-0 print:overflow-visible">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
