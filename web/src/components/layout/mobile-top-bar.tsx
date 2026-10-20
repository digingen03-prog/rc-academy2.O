'use client';

import React from 'react';
import { LuGraduationCap, LuBell, LuUser } from '@/components/icons';
import { useAuthUser } from '@/lib/auth/use-role';

interface MobileTopBarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function MobileTopBar({ title, actions }: MobileTopBarProps) {
  const { user, role } = useAuthUser();

  const formattedRole =
    !role
      ? 'Guest'
      : role === 'SUPER_ADMIN'
      ? 'Admin'
      : role === 'ACADEMY_ADMIN'
      ? 'Academy'
      : role === 'TEACHER'
      ? 'Teacher'
      : role === 'ACCOUNTANT'
      ? 'Accounts'
      : 'Staff';

  return (
    <header className="md:hidden h-14 bg-white border-b border-neutral-200 px-4 flex items-center justify-between shrink-0 sticky top-0 z-header">
      {/* Brand & Page Context */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[#FF8500] flex items-center justify-center text-white shadow-xs shrink-0">
          <LuGraduationCap className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#CC6B00] uppercase tracking-wider">RCA</span>
            <span className="text-neutral-300">/</span>
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{formattedRole}</span>
          </div>
          {title && (
            <h1 className="text-sm font-bold text-black tracking-tight leading-none truncate">
              {title}
            </h1>
          )}
        </div>
      </div>

      {/* Quick Action Elements */}
      <div className="flex items-center gap-2 shrink-0">
        {actions}

        {/* Notifications Icon */}
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-600 hover:text-black hover:bg-neutral-100 relative transition-colors"
          aria-label="Notifications"
        >
          <LuBell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#FF8500] rounded-full ring-2 ring-white" />
        </button>

        {/* User Mini Avatar */}
        <div
          className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-700 font-semibold text-xs shrink-0"
          title={user?.email || 'User'}
        >
          {user?.firstName ? user.firstName.charAt(0).toUpperCase() : <LuUser className="w-3.5 h-3.5" />}
        </div>
      </div>
    </header>
  );
}
