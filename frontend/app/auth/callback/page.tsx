'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
    }
    router.replace('/');
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gh-bg">
      <div className="text-gh-textSecondary">Signing in...</div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gh-bg"><div className="text-gh-textSecondary">Loading...</div></div>}>
      <CallbackInner />
    </Suspense>
  );
}
