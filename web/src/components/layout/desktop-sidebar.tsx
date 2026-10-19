'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LuGraduationCap } from '@/components/icons';
import { ALL_NAV_ITEMS } from './nav-items';
import { useAuthUser } from '@/lib/auth/use-role';

export function DesktopSidebar() {
  const pathname = usePathname();
  const { role } = useAuthUser();

  const authorizedItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (role === 'SUPER_ADMIN' || role === 'ACADEMY_ADMIN') return true;
    return item.roles.includes(role);
  });

  return (
    <aside className="hidden md:flex w-[260px] shrink-0 bg-white border-r border-neutral-200 flex-col h-screen sticky top-0 left-0 z-sidebar select-none overflow-hidden">
      {/* Brand Header */}
      <div className="h-[70px] px-6 flex items-center justify-between border-b border-neutral-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FF8500] flex items-center justify-center text-white shadow-subtle shrink-0">
            <LuGraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-black leading-none">RC Academy</h1>
            <span className="text-[10px] text-[#CC6B00] font-semibold tracking-wider uppercase mt-0.5 block">
              Version 2.0
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links (Fixed, no scrollbar) */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto no-scrollbar">
        {authorizedItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#FFF4E5] text-[#CC6B00] font-semibold border-l-4 border-[#FF8500]'
                  : 'text-neutral-700 hover:text-black hover:bg-neutral-50'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-[#FF8500]' : 'text-neutral-500'
                }`}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Local AI Status Footer */}
      <div className="p-4 border-t border-neutral-100 text-xs text-neutral-600 bg-neutral-50/60 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF8500] animate-pulse" />
            <span className="font-medium text-neutral-800 text-[11px]">Local AI Engine</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-500 uppercase">Online</span>
        </div>
        <div className="mt-1 text-[10px] text-neutral-400">100% On-Premise Privacy</div>
      </div>
    </aside>
  );
}
