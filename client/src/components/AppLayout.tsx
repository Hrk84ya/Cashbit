import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Receipt, TrendingUp, PiggyBank, Tags, Sun, Moon, ChevronLeft, ChevronRight, Menu, LogOut, Settings, RefreshCw } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/trends', label: 'Trends', icon: TrendingUp },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/recurring', label: 'Recurring', icon: RefreshCw },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('darkMode') === 'true');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('darkMode', String(dark));
  }, [dark]);
  return [dark, () => setDark((d) => !d)] as const;
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, toggleDark] = useDarkMode();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-background">
      {mobileOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar wrapper — relative so the edge toggle can be positioned */}
      <div className="relative hidden md:block shrink-0">
        <aside className={cn(
          "fixed md:static z-50 top-0 left-0 h-full flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          collapsed ? 'w-[68px]' : 'w-64'
        )}>
          {/* Logo */}
          <div className={cn("flex items-center h-16 border-b border-sidebar-border shrink-0", collapsed ? 'justify-center px-2' : 'px-5')}>
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0 shadow-sm">
              F
            </div>
            {!collapsed && <span className="ml-3 text-base font-bold text-sidebar-foreground tracking-tight">FinanceTracker</span>}
          </div>

          {/* Nav */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                  isActive
                    ? 'bg-sidebar-primary/10 text-sidebar-primary shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
                title={collapsed ? item.label : undefined}>
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Bottom */}
          <div className="border-t border-sidebar-border p-3 space-y-1">
            <Button variant="ghost" size={collapsed ? 'icon' : 'default'} onClick={toggleDark}
              className={cn("w-full text-sidebar-foreground/70 hover:text-sidebar-foreground", !collapsed && 'justify-start gap-3')}>
              {dark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
              {!collapsed && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
            </Button>

            {user && (
              <div className={cn("flex items-center gap-3 pt-3 border-t border-sidebar-border mt-2", collapsed ? 'justify-center' : 'px-1')}>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                    <button onClick={logout} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                      <LogOut className="h-3 w-3" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Edge collapse toggle — circular button on the sidebar border */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-1/2 -translate-y-1/2 -right-3.5 z-50 hidden md:flex h-7 w-7 items-center justify-center rounded-full border border-sidebar-border bg-sidebar shadow-md hover:bg-sidebar-accent transition-colors"
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4 text-sidebar-foreground/70" />
            : <ChevronLeft className="h-4 w-4 text-sidebar-foreground/70" />}
        </button>
      </div>

      {/* Mobile sidebar (no wrapper needed) */}
      {mobileOpen && (
        <aside className="fixed z-50 top-0 left-0 h-full flex flex-col bg-sidebar border-r border-sidebar-border w-64 md:hidden animate-fade-in">
          <div className="flex items-center h-16 border-b border-sidebar-border px-5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0 shadow-sm">
              F
            </div>
            <span className="ml-3 text-base font-bold text-sidebar-foreground tracking-tight">FinanceTracker</span>
          </div>
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-lg text-sm font-medium px-3 py-2.5 transition-all duration-200",
                  isActive
                    ? 'bg-sidebar-primary/10 text-sidebar-primary shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-sidebar-border p-3 space-y-1">
            <Button variant="ghost" size="default" onClick={toggleDark}
              className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground justify-start gap-3">
              {dark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
              <span>{dark ? 'Light mode' : 'Dark mode'}</span>
            </Button>
            {user && (
              <div className="flex items-center gap-3 pt-3 border-t border-sidebar-border mt-2 px-1">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                  <button onClick={logout} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                    <LogOut className="h-3 w-3" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center px-4 border-b bg-card md:hidden shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-3 font-bold">FinanceTracker</span>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
