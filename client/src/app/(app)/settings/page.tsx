'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Settings,
  User,
  Shield,
  Key,
  Globe,
  LogOut,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Database,
  Cpu,
  Server
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { showToast } = useToast();

  const [serverHealth, setServerHealth] = useState<string>('Checking...');
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    async function checkHealth() {
      try {
        const rootUrl = apiBaseUrl.replace(/\/api\/?$/, '');
        const res = await fetch(`${rootUrl}/health`);
        if (res.ok) {
          setServerHealth('Healthy & Responsive');
        } else {
          setServerHealth(`HTTP ${res.status}`);
        }
      } catch {
        setServerHealth('Offline / Unreachable');
      }
    }
    checkHealth();
  }, [apiBaseUrl]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      showToast('You have been signed out.', 'info');
      router.push('/login');
    } catch (err: any) {
      showToast(err.message || 'Logout failed', 'error');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" />
          <span>Account &amp; System Settings</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Review your connected GitHub developer account, encryption safeguards, and API connectivity.
        </p>
      </div>

      {/* Profile Card */}
      <Card className="bg-[#12151f] border-slate-800 p-6 sm:p-7 space-y-6">
        <div className="flex items-center gap-2 text-white font-semibold text-base">
          <User className="w-5 h-5 text-indigo-400" />
          <span>GitHub Developer Profile</span>
        </div>

        {isAuthenticated && user ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-2">
            <div className="flex items-center gap-4">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.githubUsername}
                  className="w-16 h-16 rounded-2xl border border-slate-700/80 object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xl">
                  {user.githubUsername.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-white font-mono">
                    {user.githubUsername}
                  </h3>
                  <Badge variant={user.role === 'ADMIN' ? 'danger' : 'indigo'} size="sm">
                    {user.role}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">{user.email || 'Email set to private'}</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  GitHub ID: {user.githubId} • Registered {formatDate(user.createdAt)}
                </p>
              </div>
            </div>

            <a
              href={`https://github.com/${user.githubUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 transition-colors shrink-0"
            >
              <span>View GitHub Profile</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              You are currently viewing KillSoc in guest mode. Sign in to link your GitHub profile.
            </div>
            <Link href="/login">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                Sign in with GitHub
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Security & Token Vault */}
      <Card className="bg-[#12151f] border-slate-800 p-6 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-base">
          <Shield className="w-5 h-5 text-emerald-400" />
          <span>Security &amp; Token Encryption</span>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-white">AES-256-GCM Vault</span>
              <p className="text-slate-400">
                GitHub OAuth access tokens are encrypted with an authenticated 96-bit IV and 128-bit authentication tag before being stored in PostgreSQL.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-white">Zero Token Leakage</span>
              <p className="text-slate-400">
                Access tokens and decrypted secrets are never logged in backend outputs, never stored in browser localStorage, and never transmitted in API responses.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Backend & Environment Telemetry */}
      <Card className="bg-[#12151f] border-slate-800 p-6 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-base">
          <Server className="w-5 h-5 text-indigo-400" />
          <span>Backend Configuration</span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800">
            <span className="text-slate-400">API Endpoint</span>
            <span className="font-mono text-indigo-400">{apiBaseUrl}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800">
            <span className="text-slate-400">Server Health</span>
            <span
              className={`font-semibold ${
                serverHealth.includes('Healthy') ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {serverHealth}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800">
            <span className="text-slate-400">Task Architecture</span>
            <span className="font-mono text-slate-300">Redis 7 + BullMQ Multi-Queue</span>
          </div>
        </div>
      </Card>

      {/* Session Logout Action */}
      {isAuthenticated && (
        <div className="pt-4 flex justify-end">
          <Button
            variant="danger"
            onClick={handleLogout}
            isLoading={isLoggingOut}
            className="flex items-center gap-2 text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of KillSoc</span>
          </Button>
        </div>
      )}
    </div>
  );
}
