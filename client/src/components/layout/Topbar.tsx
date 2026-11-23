'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, ChevronRight, ExternalLink, Sparkles } from 'lucide-react';
import { Github } from '../ui/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';

interface TopbarProps {
  onOpenMobile: () => void;
}

export function Topbar({ onOpenMobile }: TopbarProps) {
  const pathname = usePathname();
  const { user, login } = useAuth();

  // Generate breadcrumb items
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/');
    const title = segment
      .replace(/-/g, ' ')
      .replace(/^./, (str) => str.toUpperCase());
    return { title, href };
  });

  return (
    <header className="h-14 border-b border-[#1a1f2e] bg-[#090a0f]/90 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-[#131722]"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav className="flex items-center gap-1.5 text-xs text-slate-400">
          <Link
            href="/dashboard"
            className="hover:text-slate-200 transition-colors font-medium text-slate-300"
          >
            KillSoc
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              {idx === breadcrumbs.length - 1 ? (
                <span className="text-slate-100 font-semibold truncate max-w-[150px] sm:max-w-xs">
                  {crumb.title}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-slate-200 transition-colors truncate max-w-[100px]"
                >
                  {crumb.title}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: Quick actions & profile */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <Link
            href="/recommendations"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>AI Guidance Ready</span>
          </Link>
        </div>

        {user ? (
          <Link
            href="/settings"
            className="flex items-center gap-2 px-2 py-1 rounded-lg border border-[#1e2333] bg-[#0e111a] hover:border-[#2f364d] transition-all"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.githubUsername}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <Github className="w-4 h-4 text-slate-300" />
            )}
            <span className="text-xs font-medium text-slate-200 hidden md:inline">
              @{user.githubUsername}
            </span>
          </Link>
        ) : (
          <Button onClick={login} size="sm" variant="secondary" leftIcon={<Github className="w-3.5 h-3.5" />}>
            Connect GitHub
          </Button>
        )}
      </div>
    </header>
  );
}
