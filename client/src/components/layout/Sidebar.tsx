'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  FolderGit2,
  CheckCircle2,
  Award,
  Sparkles,
  Activity,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Github } from '../ui/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Discover Organizations', href: '/organizations', icon: Building2 },
  { label: 'Repositories', href: '/repositories', icon: FolderGit2 },
  { label: 'Contribution Issues', href: '/issues', icon: CheckCircle2 },
  { label: 'My Skills', href: '/skills', icon: Award },
  { label: 'AI Recommendations', href: '/recommendations', icon: Sparkles },
  { label: 'Background Jobs', href: '/jobs', icon: Activity },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobile = false,
  onCloseMobile
}: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        'h-screen bg-[#0d0f17] border-r border-[#1a1f2e] flex flex-col justify-between transition-all duration-200 z-30 select-none shrink-0',
        isMobile
          ? 'w-64 fixed left-0 top-0 shadow-2xl'
          : isCollapsed
          ? 'w-16 sticky top-0'
          : 'w-60 sticky top-0'
      )}
    >
      {/* Brand Header */}
      <div>
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-[#1a1f2e]">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 overflow-hidden"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm tracking-wider shadow-sm shadow-indigo-950 shrink-0">
              AS
            </div>
            {(!isCollapsed || isMobile) && (
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                  AceSoc
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    BETA
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  Intelligence Layer
                </span>
              </div>
            )}
          </Link>

          {!isMobile && (
            <button
              onClick={onToggleCollapse}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-[#1a2030] transition-colors"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                title={isCollapsed && !isMobile ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all group relative',
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-300 font-semibold border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#141824] border border-transparent'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                {(!isCollapsed || isMobile) && (
                  <span className="truncate">{item.label}</span>
                )}

                {/* Subtle active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User / Logout Footer */}
      <div className="p-2 border-t border-[#1a1f2e] space-y-1">
        {user ? (
          <div
            className={cn(
              'flex items-center gap-2.5 p-2 rounded-lg bg-[#111420] border border-[#1e2333]',
              isCollapsed && !isMobile && 'justify-center p-1.5'
            )}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.githubUsername}
                className="w-7 h-7 rounded-md object-cover border border-[#2b334a] shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                <Github className="w-3.5 h-3.5" />
              </div>
            )}

            {(!isCollapsed || isMobile) && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-100 truncate">
                  @{user.githubUsername}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {user.email || 'GitHub Connected'}
                </p>
              </div>
            )}

            {(!isCollapsed || isMobile) && (
              <button
                onClick={logout}
                title="Log out"
                className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-[#1a2030] transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-center p-2 text-xs text-slate-500">
            {(!isCollapsed || isMobile) && 'Not authenticated'}
          </div>
        )}
      </div>
    </aside>
  );
}
