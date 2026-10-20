'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LuX,
  LuLogOut,
  LuUser,
  LuChevronRight,
  LuGraduationCap,
} from '@/components/icons';
import { getSecondaryNav } from './nav-items';
import { useAuthUser } from '@/lib/auth/use-role';
import { ApiClient } from '@/lib/api/api-client';

interface MobileMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMoreMenu({ isOpen, onClose }: MobileMoreMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role } = useAuthUser();

  const secondaryItems = getSecondaryNav(role);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleLogout = () => {
    onClose();
    ApiClient.clearToken();
    router.push('/login');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal md:hidden flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div className="relative bg-white rounded-t-2xl shadow-2xl border-t border-neutral-200 max-h-[85vh] flex flex-col z-10 animate-in slide-in-from-bottom duration-250 pb-[env(safe-area-inset-bottom)]">
        {/* Handle Bar */}
        <div className="w-12 h-1 bg-neutral-300 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Header with User Info */}
        <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFF4E5] border border-[#FF8500]/30 flex items-center justify-center text-[#CC6B00] font-bold text-sm">
              {user?.firstName ? user.firstName.charAt(0).toUpperCase() : <LuUser className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-semibold text-black text-sm">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Administrator'}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-neutral-100 text-neutral-600 rounded">
                  {role || 'Guest'}
                </span>
                <span className="text-[11px] text-neutral-400 truncate max-w-[150px]">
                  {user?.email || ''}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-black rounded-lg hover:bg-neutral-100"
            aria-label="Close menu"
          >
            <LuX className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items List */}
        <div className="p-4 overflow-y-auto space-y-1.5 flex-1">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-2">
            More Academy Modules
          </div>

          {secondaryItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl min-h-[48px] transition ${
                  isActive
                    ? 'bg-[#FFF4E5] text-[#CC6B00] font-semibold'
                    : 'text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isActive ? 'bg-[#FF8500] text-white' : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <LuChevronRight className="w-4 h-4 text-neutral-400" />
              </Link>
            );
          })}

          {/* Quick Sign Out Action */}
          <div className="pt-3 mt-3 border-t border-neutral-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl min-h-[48px] text-rose-600 hover:bg-rose-50 active:bg-rose-100 font-medium transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                  <LuLogOut className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Sign Out</span>
              </div>
              <span className="text-xs text-neutral-400">Exit session</span>
            </button>
          </div>
        </div>

        {/* System Footer Note */}
        <div className="px-5 py-2.5 bg-neutral-50 border-t border-neutral-100 text-center text-[11px] text-neutral-400 flex items-center justify-center gap-1.5">
          <LuGraduationCap className="w-3.5 h-3.5 text-[#FF8500]" />
          <span>RC Academy 2.0 • Native Mobile ERP</span>
        </div>
      </div>
    </div>
  );
}
