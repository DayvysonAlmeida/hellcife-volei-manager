import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Fecha o menu mobile quando a rota muda
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out w-full",
          sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64"
        )}
      >
        {/* Header */}
        <Header onMenuToggle={() => setMobileMenuOpen(true)} />

        {/* Page content */}
        <main className="flex-1 p-2 sm:p-4 md:p-6 flex flex-col">
          <div className="max-w-[1600px] mx-auto w-full flex-1 animate-fade-in">
            <Outlet />
          </div>
          
          {/* Footer Discreto */}
          <footer className="mt-8 text-center">
            <p className="text-[10px] text-text-muted/30 uppercase tracking-widest font-medium select-none">
              Desenvolvido por DayFer
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
