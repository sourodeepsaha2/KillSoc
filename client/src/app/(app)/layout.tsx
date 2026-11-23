'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Github } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <p className="text-xs font-mono tracking-wider text-slate-500">
          AUTHENTICATING SESSION...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
          <Sidebar
            isCollapsed={false}
            onToggleCollapse={() => {}}
            isMobile
            onCloseMobile={() => setIsMobileOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenMobile={() => setIsMobileOpen(true)} />

        {/* Auth prompt banner if viewing while unauthenticated */}
        {!user && (
          <div className="bg-indigo-950/40 border-b border-indigo-500/20 px-4 py-2.5 flex items-center justify-between text-xs text-indigo-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>You are viewing in guest mode. Connect GitHub for personalized skill matching, intelligence scores, and AI recommendations.</span>
            </div>
            <Button onClick={login} size="sm" variant="primary" leftIcon={<Github className="w-3.5 h-3.5" />}>
              Connect
            </Button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
