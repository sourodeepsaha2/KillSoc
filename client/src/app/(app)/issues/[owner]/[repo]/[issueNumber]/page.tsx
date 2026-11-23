'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { discoveryApi } from '@/lib/api';
import type { DiscoveredIssue } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  TrendingUp,
  FolderGit2,
  ExternalLink,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  MessageSquare,
  Clock,
  Sparkles
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

export default function IssueDetailPage({
  params
}: {
  params: Promise<{ owner: string; repo: string; issueNumber: string }>;
}) {
  const resolvedParams = use(params);
  const { owner, repo, issueNumber } = resolvedParams;
  const router = useRouter();

  const [issue, setIssue] = useState<DiscoveredIssue | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadIssue() {
      setIsLoading(true);
      try {
        const data = await discoveryApi.getIssue(owner, repo, issueNumber);
        setIssue(data);
      } catch (err: any) {
        console.error('Failed to load issue detail', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadIssue();
  }, [owner, repo, issueNumber]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!issue) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Issue Not Found"
        description={`We could not locate issue #${issueNumber} for ${owner}/${repo}.`}
        action={{
          label: 'Back to Issues',
          onClick: () => router.push('/issues')
        }}
      />
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Back Link */}
      <Link
        href="/issues"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to Contribution Issues</span>
      </Link>

      {/* Header Card */}
      <div className="rounded-2xl bg-[#12151f] border border-slate-800 p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Link
              href={`/repositories/${owner}/${repo}`}
              className="text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>{owner}/{repo}</span>
            </Link>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-slate-400">#{issue.number}</span>
            <span className="text-slate-600">•</span>
            <Badge
              variant={issue.state === 'open' ? 'success' : 'outline'}
              size="sm"
            >
              {issue.state.toUpperCase()}
            </Badge>
            {issue.isBeginnerFriendly && (
              <Badge variant="indigo" size="sm">Good First Issue</Badge>
            )}
          </div>

          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 transition-colors"
          >
            <span>Open on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
          {issue.title}
        </h1>

        <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Opened {formatRelativeTime(issue.createdAt)}</span>
          </span>
          {issue.commentsCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{issue.commentsCount} comments</span>
            </span>
          )}
        </div>

        {/* Labels */}
        {issue.labels && issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {issue.labels.map((lbl) => (
              <span
                key={lbl}
                className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-slate-300 font-mono"
              >
                {lbl}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Mandatory GSoC Suitability Disclaimer */}
      <div className="rounded-xl bg-amber-950/20 border border-amber-500/30 p-5 space-y-2 text-amber-200">
        <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Google Summer of Code Suitability Disclaimer</span>
        </div>
        <p className="text-xs text-amber-300/90 leading-relaxed">
          {issue.gsocSuitabilityDisclaimer ||
            'Resolving individual issues or bug fixes demonstrates technical capability and community familiarity, but GSoC participation requires submitting a comprehensive project proposal during the official application window. Use this opportunity to establish credibility and engage with mentors early.'}
        </p>
      </div>

      {/* Issue Body */}
      <Card className="bg-[#12151f] border-slate-800 p-6 sm:p-8 space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
          Issue Description
        </h2>
        <div className="prose prose-invert max-w-none text-slate-300 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans">
          {issue.description || 'No description body provided on GitHub.'}
        </div>
      </Card>

      {/* Recommended Contribution Strategy & Checklist */}
      <Card className="bg-[#12151f] border-slate-800 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Recommended Next Steps &amp; Etiquette</span>
        </h2>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-white">Fork &amp; Build Locally: </span>
              Clone the repository, configure required environment variables, and run the test suite to verify a clean baseline.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-white">Leave an Expression of Interest: </span>
              Comment on the GitHub issue politely asking if you may claim it, outlining a brief 1-2 sentence proposed fix.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-white">Adhere to Code Standards: </span>
              Consult the repository&apos;s CONTRIBUTING.md for formatting, linting rules, and commit message conventions.
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <Link href={`/repositories/${owner}/${repo}`}>
            <Button variant="outline" size="sm" className="border-slate-700 text-xs">
              <FolderGit2 className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              Inspect Repository Intelligence
            </Button>
          </Link>

          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
              Comment on GitHub
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
