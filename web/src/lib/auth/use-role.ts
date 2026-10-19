'use client';

import { useState, useEffect } from 'react';
import { ApiClient } from '@/lib/api/api-client';

export type UserRole = 'SUPER_ADMIN' | 'ACADEMY_ADMIN' | 'TEACHER' | 'ACCOUNTANT' | 'STAFF';

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: UserRole[];
  permissions?: string[];
}

export function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function useAuthUser(): {
  user: UserProfile | null;
  role: UserRole;
  isAuthorized: (route: string) => boolean;
  loading: boolean;
} {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const token = ApiClient.getToken();
      if (token) {
        const payload = parseJwtPayload(token);
        if (payload) {
          const roles = payload.roles || ['SUPER_ADMIN'];
          setUser({
            id: payload.sub || 'user-1',
            email: payload.email || 'admin@rcacademy.com',
            firstName: payload.firstName || 'Administrator',
            lastName: payload.lastName || '',
            roles,
            permissions: payload.permissions || [],
          });
          setLoading(false);
          return;
        }
      }
      // Fallback default
      setUser({
        id: 'admin-default',
        email: 'admin@rcacademy.com',
        firstName: 'Administrator',
        lastName: 'RCA',
        roles: ['SUPER_ADMIN'],
      });
    } catch {
      setUser({
        id: 'admin-default',
        email: 'admin@rcacademy.com',
        firstName: 'Administrator',
        lastName: 'RCA',
        roles: ['SUPER_ADMIN'],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const primaryRole: UserRole = user?.roles?.[0] || 'SUPER_ADMIN';

  const isAuthorized = (route: string): boolean => {
    if (!user) return true;
    if (user.roles.includes('SUPER_ADMIN') || user.roles.includes('ACADEMY_ADMIN')) {
      return true;
    }

    if (user.roles.includes('TEACHER')) {
      return ['/dashboard', '/attendance', '/schedule', '/examinations', '/answer-evaluation', '/courses'].some(
        (r) => route === r || route.startsWith(`${r}/`)
      );
    }

    if (user.roles.includes('ACCOUNTANT')) {
      return ['/dashboard', '/fees', '/staff', '/students', '/schedule'].some(
        (r) => route === r || route.startsWith(`${r}/`)
      );
    }

    if (user.roles.includes('STAFF')) {
      return ['/dashboard', '/attendance', '/schedule', '/students'].some(
        (r) => route === r || route.startsWith(`${r}/`)
      );
    }

    return true;
  };

  return { user, role: primaryRole, isAuthorized, loading };
}
