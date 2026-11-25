'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser, user } = useAuth();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(errorParam);
      showToast('Authentication failed: ' + errorParam, 'error');
      router.replace(`/login?error=${encodeURIComponent(errorParam)}`);
      return;
    }

    let isMounted = true;

    async function handleAuth() {
      try {
        await refreshUser();
        if (isMounted) {
          showToast('Welcome back to AceSoc!', 'success');
          router.replace('/dashboard');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to authenticate session');
          showToast('Failed to verify session.', 'error');
          setTimeout(() => {
            router.replace('/login');
          }, 2000);
        }
      }
    }

    handleAuth();

    return () => {
      isMounted = false;
    };
  }, [refreshUser, router, searchParams, showToast]);

  return (
    <div className="min-h-screen bg-[#090a0f] flex items-center justify-center p-4">
      <div className="bg-[#12151f] border border-slate-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl shadow-black/60">
        {error ? (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white">Authentication Failed</h2>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h2 className="text-lg font-semibold text-white">Authenticating...</h2>
            <p className="text-xs text-slate-400">Verifying your GitHub credentials and setting up your workspace.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090a0f]" />}>
      <CallbackContent />
    </Suspense>
  );
}
