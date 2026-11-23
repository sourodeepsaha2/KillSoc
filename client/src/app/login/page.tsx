'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Github } from '@/components/ui/Icons';
import {
  Terminal,
  Shield,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const handleGitHubLogin = () => {
    window.location.href = authApi.getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col justify-between px-4 py-8">
      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
            <Terminal className="w-4 h-4" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-white">KillSoc</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Back to home
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto my-auto py-12">
        <div className="bg-[#12151f] border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
          {/* Subtle top highlight */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-75" />

          {/* Heading */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Welcome to KillSoc
            </h1>
            <p className="text-sm text-slate-400">
              Find. Analyze. Contribute. Conquer.
            </p>
          </div>

          {/* Error Banner if any */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <div>
                <p className="font-medium text-red-200">Authentication Failed</p>
                <p className="text-xs text-red-300/80 mt-1">
                  {error === 'access_denied'
                    ? 'GitHub authorization was declined. Please authorize KillSoc to continue.'
                    : error}
                </p>
              </div>
            </div>
          )}

          {/* Primary Login Button */}
          <div className="space-y-4">
            <Button
              onClick={handleGitHubLogin}
              size="lg"
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-medium py-3 rounded-xl shadow-lg transition-all"
            >
              <Github className="w-5 h-5" />
              <span>Continue with GitHub</span>
            </Button>

            <Link href="/dashboard" className="block">
              <Button
                variant="outline"
                size="lg"
                className="w-full flex items-center justify-center gap-2 border-slate-700 hover:bg-slate-800/60 text-slate-300 py-3 rounded-xl"
              >
                <span>Explore as Guest</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Button>
            </Link>
          </div>

          {/* Value Props & Transparency */}
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Read-only GitHub profile info &amp; verified email</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>AES-256-GCM encrypted token storage</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instant AI recommendations &amp; skill matching</span>
            </div>
          </div>

          {/* Security note */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            <span>Zero access to private code or unauthorized repositories</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} KillSoc Intelligence Engine. Built for GSoC contributors.
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090a0f]" />}>
      <LoginContent />
    </Suspense>
  );
}
