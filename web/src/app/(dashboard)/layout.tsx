'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { SidebarProvider } from '@/components/layout/sidebar-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppShell>
        {children}
      </AppShell>
    </SidebarProvider>
  );
}
