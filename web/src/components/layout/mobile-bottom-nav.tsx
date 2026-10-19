'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LuEllipsis } from '@/components/icons';
import { getPrimaryBottomNav } from './nav-items';
import { useAuthUser } from '@/lib/auth/use-role';
import { MobileMoreMenu } from './mobile-more-menu';

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const { role } = useAuthUser();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const primaryItems = getPrimaryBottomNav(role);

  // Check if current route is among secondary items (in which case highlight "More")
  const isSecondaryActive =
    !primaryItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) &&
    pathname !== '/login';

  return (
    <>
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-nav-mobile bg-white border-t border-neutral-200 select-none pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
      >
        <div className="grid grid-cols-5 h-[58px] items-center px-1">
          {primaryItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center justify-center h-full min-h-[48px] transition-colors relative ${
                  isActive ? 'text-[#FF8500]' : 'text-neutral-500 hover:text-black active:text-[#FF8500]'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 w-8 h-0.5 bg-[#FF8500] rounded-full" />
                )}
                <div className="relative mt-0.5">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                </div>
                <span
                  className={`text-[10px] mt-1 font-medium leading-none tracking-tight ${
                    isActive ? 'font-bold text-[#CC6B00]' : 'text-neutral-500'
                  }`}
                >
                  {item.shortName}
                </span>
              </Link>
            );
          })}

          {/* 5th item: More Menu Button */}
          <button
            type="button"
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center h-full min-h-[48px] transition-colors relative ${
              isSecondaryActive || showMoreMenu
                ? 'text-[#FF8500]'
                : 'text-neutral-500 hover:text-black active:text-[#FF8500]'
            }`}
            aria-label="Open More Modules Menu"
            aria-expanded={showMoreMenu}
          >
            {(isSecondaryActive || showMoreMenu) && (
              <span className="absolute top-0 w-8 h-0.5 bg-[#FF8500] rounded-full" />
            )}
            <div className="relative mt-0.5">
              <LuEllipsis className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] mt-1 font-medium leading-none tracking-tight ${
                isSecondaryActive || showMoreMenu ? 'font-bold text-[#CC6B00]' : 'text-neutral-500'
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Slide-over More Sheet */}
      <MobileMoreMenu isOpen={showMoreMenu} onClose={() => setShowMoreMenu(false)} />
    </>
  );
}
