'use client';

import React from 'react';
import { DesktopSidebar } from './desktop-sidebar';
import { MobileBottomNavigation } from './mobile-bottom-nav';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      {/* Desktop Enterprise Sidebar (Fixed, completely non-scrolling) */}
      <DesktopSidebar />

      {/* Main Viewport Container (Only this scrolls) */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto overflow-x-hidden bg-white pb-20 md:pb-0">
        {children}
      </main>

      {/* Native-App Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <MobileBottomNavigation />
    </div>
  );
}
