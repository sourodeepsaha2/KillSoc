'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { aiApi, skillsApi } from '@/lib/api';
import type {
  AiRecommendation,
  AiProviderStatus,
  PaginationMeta,
  DeveloperSkill
} from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Sparkles,
  RefreshCw,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
  ListTodo
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

export default function RecommendationsPage() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
  const [providerStatus, setProviderStatus] = useState<AiProviderStatus | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    perPage: 10,
    hasNextPage: false,
    hasPrevPage: false
  });

  const [filterType, setFilterType] = useState<'ALL' | 'REPOSITORY' | 'CONTRIBUTION'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Generate Modal state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [maxRepos, setMaxRepos] = useState<number>(5);
  const [includeGSoCOnly, setIncludeGSoCOnly] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Checked items state for interactive checklists
  const [checkedChecklist, setCheckedChecklist] = useState<Record<string, boolean>>({});

  const fetchRecommendations = useCallback(
    async (page: number = 1) => {
      setIsLoading(true);
      try {
        const typeParam = filterType === 'ALL' ? undefined : filterType;
        const [recsRes, statusRes] = await Promise.all([
          aiApi.getRecommendations({ page, perPage: 10, type: typeParam }).catch(() => null),
          aiApi.getStatus().catch(() => null)
        ]);

        if (recsRes?.data) {
          setRecommendations(recsRes.data);
          setPagination(recsRes.pagination);
        }
        if (statusRes) {
          setProviderStatus(statusRes);
        }
      } catch (err: any) {
        console.error('Failed to load AI recommendations', err);
      } finally {
        setIsLoading(false);
      }
    },
    [filterType]
  );

  useEffect(() => {
    fetchRecommendations(1);
  }, [fetchRecommendations]);

  const handleGenerateRecommendations = async () => {
    if (!isAuthenticated) {
      showToast('Please sign in with GitHub to generate recommendations.', 'info');
      return;
    }

    setIsGenerating(true);
    try {
      showToast('Analyzing your skill profile with AI...', 'info');
      const newRecs = await aiApi.generateRecommendations({
        difficulty,
        maxRepositories: maxRepos,
        includeGSoC: includeGSoCOnly,
        forceRefresh: true
      });
      setRecommendations(newRecs);
      setIsGenerateModalOpen(false);
      showToast(`Generated ${newRecs.length} personalized recommendations!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate recommendations', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefreshSingle = async (id: string) => {
    setRefreshingId(id);
    try {
      showToast('Updating recommendation reasoning...', 'info');
      const updated = await aiApi.refreshRecommendation(id);
      setRecommendations(recommendations.map((r) => (r.id === updated.id ? updated : r)));
      showToast('Recommendation refreshed!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to refresh recommendation', 'error');
    } finally {
      setRefreshingId(null);
    }
  };

  const toggleChecklistItem = (key: string) => {
    setCheckedChecklist((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <span>AI Recommendation Engine</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Personalized, evidence-based repository guidance grounded strictly in verified GitHub and GSoC data.
          </p>
        </div>

        <Button
          onClick={() => setIsGenerateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-lg shadow-indigo-600/20"
        >
          <Zap className="w-4 h-4" />
          <span>Generate Recommendations</span>
        </Button>
      </div>

      {/* AI Provider Status Banner */}
      {providerStatus && (
        <div className="p-4 rounded-xl bg-[#12151f] border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Provider:</span>
              <span className="font-mono text-white font-medium">{providerStatus.provider}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-medium">Model:</span>
              <span className="font-mono text-indigo-400 font-medium">{providerStatus.model}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            {providerStatus.fallbackEnabled && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Deterministic Fallback Enabled</span>
              </span>
            )}
            <span className="text-[11px] font-mono text-slate-500">
              Cache: {providerStatus.cacheTtlHours}h TTL
            </span>
          </div>
        </div>
      )}

      {/* Type Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {(['ALL', 'REPOSITORY', 'CONTRIBUTION'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === t
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            {t === 'ALL'
              ? 'All Recommendations'
              : t === 'REPOSITORY'
              ? 'Repositories'
              : 'Contribution Opportunities'}
          </button>
        ))}
      </div>

      {/* Recommendations Cards List */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : recommendations.length > 0 ? (
        <div className="space-y-6">
          {recommendations.map((rec) => (
            <Card
              key={rec.id}
              className="bg-[#12151f] border-slate-800 hover:border-slate-700 transition-all p-6 sm:p-7 space-y-6 relative overflow-hidden"
            >
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-indigo-400 font-medium">
                      {rec.recommendationType}
                    </span>
                    {rec.sources.isGSoCOrg && (
                      <Badge variant="indigo" size="sm">GSoC Partner</Badge>
                    )}
                    {rec.isFallback && (
                      <Badge variant="outline" size="sm">Deterministic Match</Badge>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {rec.repository?.fullName || rec.sources.repositoryFullName}
                  </h2>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {rec.sources.matchScore !== undefined && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                        Match Score
                      </span>
                      <span className="text-lg font-bold text-indigo-400">
                        {rec.sources.matchScore}%
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRefreshSingle(rec.id)}
                    disabled={refreshingId === rec.id}
                    className="p-2 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
                    title="Refresh reasoning"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${refreshingId === rec.id ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs sm:text-sm text-slate-200 leading-relaxed">
                {rec.summary}
              </div>

              {/* Reasoning */}
              <div className="space-y-1 text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-white">AI Analysis &amp; Fit: </span>
                <span>{rec.reasoning}</span>
              </div>

              {/* Matched vs Missing Skills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Matched */}
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
                  <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Matched Skills</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.matchedSkills?.length > 0 ? (
                      rec.matchedSkills.map((s) => (
                        <Badge key={s} variant="success" size="sm">
                          {s}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400">None matched</span>
                    )}
                  </div>
                </div>

                {/* Missing */}
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-2">
                  <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Skills to Learn / Missing</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.missingSkills?.length > 0 ? (
                      rec.missingSkills.map((s) => (
                        <Badge key={s} variant="warning" size="sm">
                          {s}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400">Complete skill coverage</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Strengths & Concerns */}
              {(rec.strengths?.length > 0 || rec.concerns?.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {rec.strengths?.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-semibold text-slate-300">Why this is a strong fit:</span>
                      <ul className="space-y-1 text-slate-400 list-disc list-inside">
                        {rec.strengths.slice(0, 3).map((st, i) => (
                          <li key={i}>{st}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rec.concerns?.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-semibold text-slate-300">Potential challenges:</span>
                      <ul className="space-y-1 text-slate-400 list-disc list-inside">
                        {rec.concerns.slice(0, 3).map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Actionable Preparation Checklist */}
              {rec.checklist?.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Actionable Preparation Checklist</span>
                  </span>
                  <div className="space-y-1.5">
                    {rec.checklist.map((item, idx) => {
                      const itemKey = `${rec.id}-chk-${idx}`;
                      const isChecked = Boolean(checkedChecklist[itemKey]);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleChecklistItem(itemKey)}
                          className="flex items-start gap-2.5 w-full text-left p-2 rounded-lg hover:bg-slate-900/60 transition-colors"
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isChecked
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-slate-700 bg-slate-900'
                            }`}
                          >
                            {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <span
                            className={`text-xs ${
                              isChecked ? 'text-slate-500 line-through' : 'text-slate-300'
                            }`}
                          >
                            {item}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Questions for Maintainers */}
              {rec.maintainerQuestions?.length > 0 && (
                <div className="space-y-2 text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Strategic Questions to Ask Maintainers:</span>
                  </span>
                  <ul className="space-y-1 text-slate-400 list-disc list-inside pl-1">
                    {rec.maintainerQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  Generated via {rec.provider} ({rec.model})
                </span>

                <div className="flex items-center gap-3">
                  {rec.repository && (
                    <Link href={`/repositories/${rec.repository.fullName}`}>
                      <Button size="sm" variant="outline" className="border-slate-700 text-xs">
                        Inspect Intelligence
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  )}
                  {rec.sources.repositoryUrl && (
                    <a
                      href={rec.sources.repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="No Recommendations Available"
          description="Configure your technical skills and run the AI recommendation engine to discover ideal GSoC codebases."
          action={{
            label: 'Generate Recommendations',
            onClick: () => setIsGenerateModalOpen(true)
          }}
        />
      )}

      {/* Generate Recommendations Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate AI Recommendations"
        description="Select your criteria to synthesize fresh repository recommendations."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Difficulty / Skill Fit
            </label>
            <Select
              options={[
                { value: 'all', label: 'All Difficulty Levels' },
                { value: 'beginner', label: 'Beginner Friendly (First time contributors)' },
                { value: 'intermediate', label: 'Intermediate (Feature contributions)' },
                { value: 'advanced', label: 'Advanced (Architecture & Core systems)' }
              ]}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Maximum Repositories to Analyze
            </label>
            <Select
              options={[
                { value: '3', label: '3 Recommendations (Focused)' },
                { value: '5', label: '5 Recommendations (Balanced)' },
                { value: '10', label: '10 Recommendations (Comprehensive)' }
              ]}
              value={String(maxRepos)}
              onChange={(e) => setMaxRepos(parseInt(e.target.value, 10))}
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-white block">
                GSoC Organizations Only
              </span>
              <span className="text-[11px] text-slate-400 block">
                Restrict matching to verified Google Summer of Code mentoring orgs
              </span>
            </div>
            <input
              type="checkbox"
              checked={includeGSoCOnly}
              onChange={(e) => setIncludeGSoCOnly(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              variant="outline"
              onClick={() => setIsGenerateModalOpen(false)}
              className="border-slate-800 text-slate-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateRecommendations}
              isLoading={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Start Analysis
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
