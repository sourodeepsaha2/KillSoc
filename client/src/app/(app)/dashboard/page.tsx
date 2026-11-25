'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  discoveryApi,
  skillsApi,
  aiApi,
  matchingApi,
  jobsApi
} from '@/lib/api';
import type {
  DeveloperSkill,
  DiscoveredOrganization,
  DiscoveredIssue,
  AiRecommendation,
  DeterministicRecommendation
} from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ScoreIndicator } from '@/components/ui/ScoreIndicator';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Sparkles,
  Layers,
  Code2,
  FolderGit2,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Cpu,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  AlertCircle
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [skills, setSkills] = useState<DeveloperSkill[]>([]);
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
  const [issues, setIssues] = useState<DiscoveredIssue[]>([]);
  const [orgsCount, setOrgsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    loadDashboardData();
  }, [isAuthenticated]);

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      const [orgsRes, issuesRes] = await Promise.all([
        discoveryApi.getOrganizations({ perPage: 1 }).catch(() => null),
        discoveryApi.getIssues({ beginnerOnly: true, perPage: 5 }).catch(() => null)
      ]);

      if (orgsRes?.pagination?.total !== undefined) {
        setOrgsCount(orgsRes.pagination.total);
      }
      if (issuesRes?.data) {
        setIssues(issuesRes.data);
      }

      if (isAuthenticated) {
        const [skillsData, recsRes] = await Promise.all([
          skillsApi.getSkills().catch(() => []),
          aiApi.getRecommendations({ perPage: 4 }).catch(() => null)
        ]);

        setSkills(skillsData);
        if (recsRes?.data) {
          setRecommendations(recsRes.data);
        }
      }
    } catch (err: any) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerateRecommendations() {
    if (!isAuthenticated) {
      showToast('Please sign in to generate personalized recommendations.', 'info');
      return;
    }
    if (skills.length === 0) {
      showToast('Please add at least one skill to your profile first.', 'info');
      return;
    }

    setIsGenerating(true);
    try {
      showToast('Generating AI recommendations from your skill profile...', 'info');
      const newRecs = await aiApi.generateRecommendations({
        forceRefresh: true,
        maxRepositories: 5
      });
      setRecommendations(newRecs);
      showToast(`Generated ${newRecs.length} personalized recommendations!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate recommendations.', 'error');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Welcome / Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#12151f] via-[#151926] to-[#12151f] border border-slate-800 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Intelligence Platform Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {isAuthenticated ? `Welcome back, ${user?.githubUsername}` : 'Welcome to AceSoc'}
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              Evaluate GSoC organizations, track repository health metrics, and identify your optimal open-source contribution pathways.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleGenerateRecommendations}
              isLoading={isGenerating}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Recommendations</span>
            </Button>

            <Link href="/organizations">
              <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-200">
                <Search className="w-4 h-4 mr-1.5" />
                <span>Explore Orgs</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Registered Skills */}
        <Card className="bg-[#12151f]/80 border-slate-800/80 hover:border-slate-700/80 transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Developer Skills
              </span>
              <div className="text-2xl font-bold text-white">
                {isLoading ? <Skeleton className="h-8 w-12" /> : skills.length}
              </div>
              <Link
                href="/skills"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <span>Manage skills</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Code2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: GSoC Organizations */}
        <Card className="bg-[#12151f]/80 border-slate-800/80 hover:border-slate-700/80 transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                GSoC Organizations
              </span>
              <div className="text-2xl font-bold text-white">
                {isLoading ? <Skeleton className="h-8 w-16" /> : orgsCount || '15+'}
              </div>
              <Link
                href="/organizations"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <span>Browse database</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Beginner Issues */}
        <Card className="bg-[#12151f]/80 border-slate-800/80 hover:border-slate-700/80 transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Good First Issues
              </span>
              <div className="text-2xl font-bold text-white">
                {isLoading ? <Skeleton className="h-8 w-12" /> : issues.length > 0 ? `${issues.length}+` : '0'}
              </div>
              <Link
                href="/issues?beginnerOnly=true"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <span>Explore issues</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: AI Recommendations */}
        <Card className="bg-[#12151f]/80 border-slate-800/80 hover:border-slate-700/80 transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                AI Recommendations
              </span>
              <div className="text-2xl font-bold text-white">
                {isLoading ? <Skeleton className="h-8 w-12" /> : recommendations.length}
              </div>
              <Link
                href="/recommendations"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <span>View analysis</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 cols): Recommended Repositories & Recent AI Advice */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>Personalized Recommendations</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Targeted repositories matching your verified technical stack
              </p>
            </div>
            <Link href="/recommendations">
              <Button variant="ghost" size="sm" className="text-xs text-indigo-400 hover:text-indigo-300">
                View all ({recommendations.length})
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.slice(0, 3).map((rec) => (
                <Card
                  key={rec.id}
                  className="bg-[#12151f] border-slate-800 hover:border-slate-700 transition-all p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={
                            rec.repository
                              ? `/repositories/${rec.repository.fullName}`
                              : `/recommendations`
                          }
                          className="font-semibold text-white hover:text-indigo-400 transition-colors text-base"
                        >
                          {rec.repository?.fullName || rec.sources.repositoryFullName}
                        </Link>
                        {rec.sources.isGSoCOrg && (
                          <Badge variant="indigo" size="sm">GSoC Partner</Badge>
                        )}
                        {rec.isFallback && (
                          <Badge variant="outline" size="sm">Rule-based</Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {rec.summary}
                      </p>

                      {/* Matched skills */}
                      {rec.matchedSkills?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[11px] text-slate-500 font-medium">Matched:</span>
                          {rec.matchedSkills.slice(0, 4).map((s) => (
                            <Badge key={s} variant="success" size="sm">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                      {rec.sources.matchScore !== undefined && (
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Match Fit</div>
                          <div className="text-base font-bold text-indigo-400">
                            {rec.sources.matchScore}%
                          </div>
                        </div>
                      )}
                      <Link
                        href={
                          rec.repository
                            ? `/repositories/${rec.repository.fullName}`
                            : `/recommendations`
                        }
                      >
                        <Button size="sm" variant="outline" className="text-xs border-slate-700">
                          Inspect Metrics
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-[#12151f]/50 border-slate-800 p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">No Recommendations Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                {isAuthenticated
                  ? 'Add your skills or trigger our AI Intelligence engine to get tailored repository guidance.'
                  : 'Sign in with GitHub and record your technical skills to receive personalized repository matches.'}
              </p>
              {isAuthenticated ? (
                <Button
                  onClick={handleGenerateRecommendations}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Generate Recommendations
                </Button>
              ) : (
                <Link href="/login">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                    Sign in to Start
                  </Button>
                </Link>
              )}
            </Card>
          )}

          {/* Quick Skill Showcase */}
          <div className="rounded-xl border border-slate-800 bg-[#12151f] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span>Your Skill Profile</span>
              </h3>
              <Link href="/skills">
                <Button variant="ghost" size="sm" className="text-xs text-indigo-400 hover:text-indigo-300">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Skill
                </Button>
              </Link>
            </div>

            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <Badge
                    key={s.id}
                    variant={
                      s.proficiency === 'Advanced'
                        ? 'indigo'
                        : s.proficiency === 'Intermediate'
                        ? 'cyan'
                        : 'outline'
                    }
                    size="md"
                    className="flex items-center gap-1.5 py-1 px-3"
                  >
                    <span>{s.skillName}</span>
                    <span className="text-[10px] opacity-60">({s.proficiency})</span>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No technical skills configured yet. Add languages, frameworks, and databases to power the recommendation engine.
              </p>
            )}
          </div>
        </div>

        {/* Right Column (1 col): Beginner-Friendly Opportunities & Background Jobs */}
        <div className="space-y-6">
          {/* Beginner Issues list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Good First Issues</span>
                </h2>
                <p className="text-[11px] text-slate-400">Verified entry points for newcomers</p>
              </div>
              <Link href="/issues?beginnerOnly=true">
                <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white">
                  All
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : issues.length > 0 ? (
              <div className="space-y-3">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-3.5 rounded-xl bg-[#12151f] border border-slate-800/80 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/issues/${issue.repository.fullName}/${issue.number}`}
                        className="text-xs font-medium text-slate-200 hover:text-indigo-400 transition-colors line-clamp-2"
                      >
                        {issue.title}
                      </Link>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        #{issue.number}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate max-w-[150px] text-indigo-400/90">
                        {issue.repository.fullName}
                      </span>
                      <span>{formatRelativeTime(issue.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#12151f] border border-slate-800 text-center text-xs text-slate-400">
                No active issues cached. Sync repositories to discover good first issues.
              </div>
            )}
          </div>

          {/* Background Jobs Banner / Status */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border border-indigo-900/40 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
              <Cpu className="w-4 h-4" />
              <span>Background Engine Active</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              BullMQ + Redis workers handle organization ingestion, repository metrics, and asynchronous skill extraction in real-time.
            </p>
            <Link href="/jobs" className="block pt-1">
              <Button variant="outline" size="sm" className="w-full text-xs border-indigo-800/60 hover:bg-indigo-900/40 text-indigo-300">
                View Job Monitor
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
