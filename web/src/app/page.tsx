'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClient } from '@/lib/api/api-client';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = ApiClient.getToken();
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return null;
}
