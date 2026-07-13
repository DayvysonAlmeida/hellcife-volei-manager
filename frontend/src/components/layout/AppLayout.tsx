import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      {/* Main content */}
      <motion.div
        animate={{ marginLeft: sidebarCollapsed ? 72 : 256 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex-1 flex flex-col min-h-screen"
      >
        {/* Header */}
        <Header onMenuToggle={() => setSidebarCollapsed((c) => !c)} />

        {/* Page content */}
        <main className="flex-1 p-6 flex flex-col">
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
      </motion.div>
    </div>
  );
}
