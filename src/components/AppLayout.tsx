import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ClipboardList, Container, Layers,
  Box, Users, Radar, ChevronLeft, ChevronRight, Shield, LogOut, StickyNote
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import adoLogo from '@/assets/ado-logo.png';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { isAdmin, signOut, user, role } = useAuth();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/consignments', label: 'Consignments', icon: Package },
    { path: '/loading-lists', label: 'Loading Lists', icon: ClipboardList },
    { path: '/containers', label: 'Containers', icon: Container },
    { path: '/lotwise', label: 'Lotwise Consignments', icon: Layers },
    { path: '/remaining-ctns', label: 'Remaining CTNs', icon: Box },
    { path: '/party-followup', label: 'Party Follow Up', icon: Users },
    { path: '/tracking', label: 'Tracking System', icon: Radar },
    { path: '/important-notes', label: 'Important Notes', icon: StickyNote },
    ...(isAdmin ? [{ path: '/admin', label: 'Admin Panel', icon: Shield }] : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={cn(
        "flex flex-col transition-all duration-300 border-r",
        collapsed ? "w-16" : "w-64"
      )} style={{ background: 'hsl(215 60% 95%)', borderColor: 'hsl(215 40% 85%)' }}>
        <div className={cn("flex flex-col items-center justify-center border-b px-2", collapsed ? "py-3" : "py-5")} style={{ borderColor: 'hsl(215 40% 85%)' }}>
          <img src={adoLogo} alt="ADO International" className={cn("object-contain", collapsed ? "h-16 w-16" : "h-36 w-full max-w-[280px]")} />
          {!collapsed && <span className="text-xs font-extrabold tracking-wide text-primary mt-2 text-center leading-tight">ADO International Transport Nepal</span>}
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors mx-1.5 rounded-md font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground/70 hover:bg-primary/10 hover:text-primary"
                )}
                title={item.label}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="border-t px-3 py-2" style={{ borderColor: 'hsl(215 40% 85%)' }}>
          {!collapsed && (
            <div className="text-xs mb-2 truncate">
              <span className="font-bold">{user?.email}</span>
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {role?.toUpperCase()}
              </span>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full p-2 text-sm rounded-md hover:bg-destructive/10 text-destructive transition-colors font-medium"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 border-t hover:bg-primary/10 transition-colors flex justify-center text-foreground/60"
          style={{ borderColor: 'hsl(215 40% 85%)' }}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
