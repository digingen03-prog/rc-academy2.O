'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  QrCode,
  CreditCard,
  BookOpen,
  FileCheck2,
  GraduationCap,
  Layers,
  UserCheck,
  Calendar,
  X
} from 'lucide-react';
import { useSidebar } from './sidebar-context';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Courses & Batches', href: '/courses', icon: Layers },
  { name: 'Schedule & WhatsApp', href: '/schedule', icon: Calendar },
  { name: 'Staff Directory', href: '/staff', icon: UserCheck },
  { name: 'Students', href: '/students', icon: Users },
  { name: 'Smart Attendance', href: '/attendance', icon: QrCode },
  { name: 'Fees & Finance', href: '/fees', icon: CreditCard },
  { name: 'Examinations', href: '/examinations', icon: BookOpen },
  { name: 'AI Evaluation', href: '/answer-evaluation', icon: FileCheck2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();

  // Reset on route change
  React.useEffect(() => {
    close();
  }, [pathname, close]);

  // Handle Escape key & body scroll lock
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 lg:hidden backdrop-blur-sm animate-in fade-in"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-modal lg:z-sidebar w-[260px] shrink-0 bg-white border-r border-neutral-200 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-[70px] px-6 flex items-center justify-between border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FF8500] flex items-center justify-center text-white shadow-subtle shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-black leading-none">RC Academy</h1>
              <span className="text-[10px] text-[#CC6B00] font-semibold tracking-wider uppercase mt-0.5 block">
                Version 2.0
              </span>
            </div>
          </div>

          <button
            onClick={close}
            className="lg:hidden p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded-lg"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={close}
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
        <div className="p-4 border-t border-neutral-100 text-xs text-neutral-600 bg-neutral-50/60">
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
    </>
  );
}
