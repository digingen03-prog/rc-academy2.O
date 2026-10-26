import {
  LuLayoutDashboard,
  LuClipboardCheck,
  LuCalendarClock,
  LuGraduationCap,
  LuBookOpen,
  LuUsers,
  LuWallet,
  LuFileText,
  LuFileCheck2,
  LuEllipsis,
} from '@/components/icons';
import { UserRole } from '@/lib/auth/use-role';

export interface NavItem {
  id: string;
  name: string;
  shortName: string;
  href: string;
  icon: any;
  roles?: UserRole[];
}

export const ALL_NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    shortName: 'Home',
    href: '/dashboard',
    icon: LuLayoutDashboard,
  },
  {
    id: 'attendance',
    name: 'Smart Attendance',
    shortName: 'Attendance',
    href: '/attendance',
    icon: LuClipboardCheck,
    roles: ['SUPER_ADMIN', 'ACADEMY_ADMIN', 'TEACHER', 'STAFF'],
  },
  {
    id: 'schedule',
    name: 'Schedule & WhatsApp',
    shortName: 'Schedule',
    href: '/schedule',
    icon: LuCalendarClock,
  },
  {
    id: 'students',
    name: 'Students',
    shortName: 'Students',
    href: '/students',
    icon: LuGraduationCap,
    roles: ['SUPER_ADMIN', 'ACADEMY_ADMIN', 'ACCOUNTANT', 'STAFF'],
  },
  {
    id: 'courses',
    name: 'Courses & Batches',
    shortName: 'Courses',
    href: '/courses',
    icon: LuBookOpen,
    roles: ['SUPER_ADMIN', 'ACADEMY_ADMIN', 'TEACHER'],
  },
  {
    id: 'staff',
    name: 'Staff Directory',
    shortName: 'Staff',
    href: '/staff',
    icon: LuUsers,
    roles: ['SUPER_ADMIN', 'ACADEMY_ADMIN', 'ACCOUNTANT'],
  },
  {
    id: 'fees',
    name: 'Fees & Finance',
    shortName: 'Fees',
    href: '/fees',
    icon: LuWallet,
    roles: ['SUPER_ADMIN', 'ACADEMY_ADMIN', 'ACCOUNTANT'],
  },
  {
    id: 'examinations',
    name: 'Question Papers',
    shortName: 'Questions',
    href: '/examinations',
    icon: LuFileText,
    roles: ['SUPER_ADMIN', 'ACADEMY_ADMIN', 'TEACHER'],
  },
  {
    id: 'answer-evaluation',
    name: 'AI Evaluation',
    shortName: 'AI Eval',
    href: '/answer-evaluation',
    icon: LuFileCheck2,
    roles: ['SUPER_ADMIN', 'ACADEMY_ADMIN', 'TEACHER'],
  },
];

/**
 * Returns the 4 primary bottom navigation items for a given role (the 5th is always "More")
 */
export function getPrimaryBottomNav(role?: UserRole | null): NavItem[] {
  if (!role) return [];

  if (role === 'TEACHER') {
    return [
      ALL_NAV_ITEMS.find((i) => i.id === 'dashboard')!,
      ALL_NAV_ITEMS.find((i) => i.id === 'attendance')!,
      ALL_NAV_ITEMS.find((i) => i.id === 'schedule')!,
      ALL_NAV_ITEMS.find((i) => i.id === 'examinations')!,
    ];
  }

  if (role === 'ACCOUNTANT') {
    return [
      ALL_NAV_ITEMS.find((i) => i.id === 'dashboard')!,
      ALL_NAV_ITEMS.find((i) => i.id === 'fees')!,
      ALL_NAV_ITEMS.find((i) => i.id === 'staff')!,
      ALL_NAV_ITEMS.find((i) => i.id === 'students')!,
    ];
  }

  if (role === 'STAFF') {
    return [
      ALL_NAV_ITEMS.find((i) => i.id === 'dashboard')!,
      ALL_NAV_ITEMS.find((i) => i.id === 'attendance')!,
      ALL_NAV_ITEMS.find((i) => i.id === 'schedule')!,
      ALL_NAV_ITEMS.find((i) => i.id === 'students')!,
    ];
  }

  // SUPER_ADMIN & ACADEMY_ADMIN
  return [
    ALL_NAV_ITEMS.find((i) => i.id === 'dashboard')!,
    ALL_NAV_ITEMS.find((i) => i.id === 'attendance')!,
    ALL_NAV_ITEMS.find((i) => i.id === 'schedule')!,
    ALL_NAV_ITEMS.find((i) => i.id === 'students')!,
  ];
}

/**
 * Returns the secondary navigation items for the "More" bottom sheet based on role
 */
export function getSecondaryNav(role?: UserRole | null): NavItem[] {
  if (!role) return [];
  const primaryIds = new Set(getPrimaryBottomNav(role).map((i) => i.id));
  return ALL_NAV_ITEMS.filter((item) => {
    if (primaryIds.has(item.id)) return false;
    if (!item.roles) return true;
    return item.roles.includes(role);
  });
}
