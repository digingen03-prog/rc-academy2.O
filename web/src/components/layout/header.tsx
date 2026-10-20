'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  LuBell,
  LuUser,
  LuLogOut,
  LuGraduationCap
} from '@/components/icons';
import { ApiClient } from '@/lib/api/api-client';
import { useAuthUser } from '@/lib/auth/use-role';

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({ title, subtitle, children }: HeaderProps) {
  const router = useRouter();
  const { user, role } = useAuthUser();

  const handleLogout = () => {
    ApiClient.clearToken();
    router.push('/login');
  };

  const formattedRole =
    !role
      ? 'Guest'
      : role === 'SUPER_ADMIN'
      ? 'Super Admin'
      : role === 'ACADEMY_ADMIN'
      ? 'Academy Admin'
      : role === 'TEACHER'
      ? 'Teacher'
      : role === 'ACCOUNTANT'
      ? 'Accountant'
      : 'Staff';

  return (
    <header className="h-14 md:h-[70px] bg-white border-b border-neutral-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 sticky top-0 z-header transition-colors">
      {/* Left: Mobile Brand Emblem + Title Hierarchy */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile-Only Academy Badge */}
        <div className="md:hidden w-8 h-8 rounded-lg bg-[#FF8500] flex items-center justify-center text-white shadow-xs shrink-0">
          <LuGraduationCap className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg md:text-xl font-bold text-black tracking-tight leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5 truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions, Notifications & Identity */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
        {children}

        {/* Notifications */}
        <button
          className="p-1.5 sm:p-2 text-neutral-600 hover:text-black rounded-lg hover:bg-neutral-100 relative transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
          aria-label="View notifications"
        >
          <LuBell className="w-4 h-4" />
          <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#FF8500] rounded-full ring-2 ring-white" />
        </button>

        {/* User Identity Chip (Desktop) */}
        <div className="hidden md:flex items-center gap-2.5 pl-3 sm:pl-4 border-l border-neutral-200">
          <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-800">
            {user?.firstName ? (
              <span className="font-semibold text-xs">{user.firstName.charAt(0).toUpperCase()}</span>
            ) : (
              <LuUser className="w-4 h-4" />
            )}
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-black leading-tight">
              {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Administrator'}
            </div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider">{formattedRole}</div>
          </div>
        </div>

        {/* Sign Out Button (Desktop) */}
        <button
          onClick={handleLogout}
          title="Sign out of portal"
          className="hidden md:flex p-2 text-neutral-500 hover:text-black rounded-lg hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
          aria-label="Sign out"
        >
          <LuLogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
