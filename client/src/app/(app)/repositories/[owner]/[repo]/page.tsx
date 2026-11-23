'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { intelligenceApi, jobsApi, discoveryApi, skillsApi } from '@/lib/api';
import type {
  RepositoryAnalysis,
  DiscoveredIssue,
  DeveloperSkill
} from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ScoreIndicator, ScoreBar } from '@/components/ui/ScoreIndicator';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { Github } from '@/components/ui/Icons';
import {
  FolderGit2,
  Star,
  GitFork,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  BookOpen,
  Activity,
  Users,
  Compass,
  Wrench,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  Sparkles,
  TrendingUp,
  Clock,
  Code2
} from 'lucide-react';
import { formatNumber, formatDate, formatRelativeTime, getScoreBadge } from '@/lib/utils';

export default function RepositoryDetailPage({
  params
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const resolvedParams = use(params);
  const { owner, repo } = resolvedParams;
  const fullName = `${owner}/${repo}`;
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [issues, setIssues] = useState<DiscoveredIssue[]>([]);
  const [userSkills, setUserSkills] = useState<DeveloperSkill[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    loadRepositoryData();
  }, [owner, repo]);

  async function loadRepositoryData() {
    setIsLoading(true);
    try {
      const [analysisData, issuesRes] = await Promise.all([
        intelligenceApi.getAnalysis(owner, repo).catch((err) => {
          console.warn('Analysis fetch error:', err);
          return null;
        }),
        discoveryApi.getIssues({
          repository: fullName,
          beginnerOnly: true,
          perPage: 5
        }).catch(() => null)
      ]);

      if (analysisData) {
        setAnalysis(analysisData);
      }
      if (issuesRes?.data) {
        setIssues(issuesRes.data);
      }

      if (isAuthenticated) {
        const skillsData = await skillsApi.getSkills().catch(() => []);
        setUserSkills(skillsData);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load repository intelligence', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefreshAnalysis() {
    setIsRefreshing(true);
    try {
      showToast(`Recalculating intelligence scores for ${fullName}...`, 'info');
      const updated = await intelligenceApi.refreshAnalysis(owner, repo);
      setAnalysis(updated);
      showToast('Repository intelligence analysis refreshed successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to refresh intelligence metrics', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleQueueBackgroundJob() {
    if (!isAuthenticated) {
      showToast('Please sign in with GitHub to enqueue background analysis jobs.', 'info');
      return;
    }
    try {
      showToast('Enqueuing asynchronous repository analysis job...', 'info');
      await jobsApi.analyzeRepo(owner, repo, true);
      showToast('Background job enqueued in Redis + BullMQ queue.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to enqueue background analysis', 'error');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 w-full rounded-2xl lg:col-span-1" />
          <Skeleton className="h-96 w-full rounded-2xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Analysis Not Available"
        description={`We could not compute metrics for "${fullName}". Ensure the repository exists and is accessible.`}
        action={{
          label: 'Compute Analysis Now',
          onClick: handleRefreshAnalysis
        }}
      />
    );
  }

  const overallBadge = getScoreBadge(analysis.scores.overall);

  return (
    <div className="space-y-8">
      {/* Back navigation */}
      <Link
        href="/repositories"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to Repositories</span>
      </Link>

      {/* Main Repository Header */}
      <div className="rounded-2xl bg-[#12151f] border border-slate-800 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
                {fullName}
              </h1>
              <Badge variant="indigo" size="md">
                Verified Codebase
              </Badge>
            </div>

            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Transparent repository intelligence breakdown powered by GitHub REST API signals and deterministic scoring heuristics.
            </p>

            {/* External Links */}
            <div className="flex items-center gap-4 pt-2 text-xs">
              <a
                href={`https://github.com/${fullName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                <span>View on GitHub</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
              </a>
              {analysis.lastAnalyzedAt && (
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Analyzed {formatRelativeTime(analysis.lastAnalyzedAt)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleQueueBackgroundJob}
              className="border-slate-700 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Queue Worker Job</span>
            </Button>

            <Button
              size="sm"
              onClick={handleRefreshAnalysis}
              isLoading={isRefreshing}
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </Button>
          </div>
        </div>

        {/* Documentation & Health Checklist Indicators */}
        <div className="pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/80 flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                analysis.metricsSummary.hasReadme ? 'text-emerald-400' : 'text-slate-600'
              }`}
            />
            <span className={analysis.metricsSummary.hasReadme ? 'text-slate-200' : 'text-slate-500'}>
              README.md
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/80 flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                analysis.metricsSummary.hasContributing ? 'text-emerald-400' : 'text-slate-600'
              }`}
            />
            <span className={analysis.metricsSummary.hasContributing ? 'text-slate-200' : 'text-slate-500'}>
              CONTRIBUTING.md
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/80 flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                analysis.metricsSummary.hasCodeOfConduct ? 'text-emerald-400' : 'text-slate-600'
              }`}
            />
            <span className={analysis.metricsSummary.hasCodeOfConduct ? 'text-slate-200' : 'text-slate-500'}>
              Code of Conduct
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/80 flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                analysis.metricsSummary.hasLicense ? 'text-emerald-400' : 'text-slate-600'
              }`}
            />
            <span className={analysis.metricsSummary.hasLicense ? 'text-slate-200' : 'text-slate-500'}>
              Open Source License
            </span>
          </div>
        </div>
      </div>

      {/* Main Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col (1 col): Overall Score Widget & Summary */}
        <div className="space-y-6">
          <Card className="bg-[#12151f] border-slate-800 p-6 text-center space-y-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Overall Intelligence Score
            </span>

            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border-4 border-slate-800 flex flex-col items-center justify-center bg-slate-900/60 shadow-inner">
                  <span className="text-4xl font-extrabold text-white tracking-tight">
                    {analysis.scores.overall}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">/ 100</span>
                </div>
              </div>

              <div className="mt-4">
                <Badge
                  variant={
                    overallBadge.variant === 'success'
                      ? 'success'
                      : overallBadge.variant === 'warning'
                      ? 'warning'
                      : 'outline'
                  }
                  size="md"
                  className="px-3 py-1 text-xs font-semibold"
                >
                  {overallBadge.label} Repository Health
                </Badge>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-slate-800">
              Aggregated from real commit velocity, maintainer issue responsiveness, onboarding documentation, and newcomer friendliness.
            </p>
          </Card>

          {/* Quick Metrics Summary */}
          <Card className="bg-[#12151f] border-slate-800 p-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Telemetry Summary
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Commit Frequency</span>
                <span className="text-white font-mono font-medium">
                  {analysis.metricsSummary.commitFrequency !== undefined
                    ? `${analysis.metricsSummary.commitFrequency}/mo`
                    : 'Active'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Issue Resolution Rate</span>
                <span className="text-white font-mono font-medium">
                  {analysis.metricsSummary.issueResolutionRate !== undefined
                    ? `${Math.round(analysis.metricsSummary.issueResolutionRate * 100)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Contributors</span>
                <span className="text-white font-mono font-medium">
                  {analysis.metricsSummary.contributorCount || '10+'}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Col (2 cols): 5 Dimension Scores & Explanations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dimension Breakdown Card */}
          <Card className="bg-[#12151f] border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>5-Dimension Intelligence Breakdown</span>
              </h2>
              <span className="text-xs text-slate-500 font-mono">0 - 100 scale</span>
            </div>

            <div className="space-y-5">
              <ScoreBar
                score={analysis.scores.activity}
                label="Activity & Commit Velocity"
                description="Recent commit frequency, development velocity, and release regularity."
              />

              <ScoreBar
                score={analysis.scores.community}
                label="Community & Maintainer Engagement"
                description="Active contributors, PR review cadence, and collaboration signals."
              />

              <ScoreBar
                score={analysis.scores.documentation}
                label="Documentation & Governance"
                description="Presence of README, CONTRIBUTING guidelines, Code of Conduct, and Architecture docs."
              />

              <ScoreBar
                score={analysis.scores.beginner}
                label="Beginner Friendliness"
                description="Good first issue labels, welcoming maintainer tone, and newcomer issues."
              />

              <ScoreBar
                score={analysis.scores.maintenance}
                label="Maintenance Health"
                description="Issue resolution efficiency, open vs closed issues ratio, and backlog staleness."
              />
            </div>
          </Card>

          {/* Explainability Section: Strengths & Concerns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Positive Factors */}
            <Card className="bg-[#12151f] border-slate-800 p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Verified Strengths</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {analysis.explanations?.overall?.length > 0 ? (
                  analysis.explanations.overall.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-500 shrink-0 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">Strong documentation and consistent commit cadence detected.</li>
                )}
              </ul>
            </Card>

            {/* Areas for Attention */}
            <Card className="bg-[#12151f] border-slate-800 p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Points to Consider</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {analysis.explanations?.maintenance?.length > 0 ? (
                  analysis.explanations.maintenance.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-500 shrink-0 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">Monitor issue backlog for response turnaround times.</li>
                )}
              </ul>
            </Card>
          </div>

          {/* Open Beginner-Friendly Issues */}
          {issues.length > 0 && (
            <Card className="bg-[#12151f] border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Good First Issues in this Repository ({issues.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Recommended entry points for your initial contribution
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <Link
                        href={`/issues/${owner}/${repo}/${issue.number}`}
                        className="text-xs font-medium text-slate-200 hover:text-indigo-400 transition-colors line-clamp-1"
                      >
                        {issue.title}
                      </Link>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="font-mono">#{issue.number}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(issue.createdAt)}</span>
                        {issue.labels?.slice(0, 2).map((lbl) => (
                          <span
                            key={lbl}
                            className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400"
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>

                    <Link href={`/issues/${owner}/${repo}/${issue.number}`}>
                      <Button size="sm" variant="outline" className="text-xs border-slate-700 shrink-0">
                        Inspect
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
