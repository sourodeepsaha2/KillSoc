'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { discoveryApi } from '@/lib/api';
import type { DiscoveredIssue, PaginationMeta } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  TrendingUp,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderGit2
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

function IssuesListContent() {
  const searchParams = useSearchParams();
  const initialBeginner = searchParams.get('beginnerOnly') === 'true';

  const [issues, setIssues] = useState<DiscoveredIssue[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    perPage: 15,
    hasNextPage: false,
    hasPrevPage: false
  });

  const [search, setSearch] = useState<string>('');
  const [beginnerOnly, setBeginnerOnly] = useState<boolean>(initialBeginner);
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchIssues = useCallback(
    async (page: number = 1) => {
      setIsLoading(true);
      try {
        const res = await discoveryApi.getIssues({
          page,
          perPage: 15,
          search: search.trim() || undefined,
          beginnerOnly: beginnerOnly ? true : undefined,
          label: selectedLabel || undefined,
          language: selectedLanguage || undefined
        });
        setIssues(res.data);
        setPagination(res.pagination);
      } catch (err: any) {
        console.error('Failed to load issues', err);
      } finally {
        setIsLoading(false);
      }
    },
    [search, beginnerOnly, selectedLabel, selectedLanguage]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIssues(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchIssues]);

  const handleResetFilters = () => {
    setSearch('');
    setBeginnerOnly(false);
    setSelectedLabel('');
    setSelectedLanguage('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-400" />
          <span>Contribution Opportunities &amp; Issues</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Explore beginner-friendly issues from active GSoC repositories and kickstart your contribution journey.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-[#12151f] border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          <Input
            placeholder="Search issue title or keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />

          <Select
            options={[
              { value: '', label: 'All Labels' },
              { value: 'good first issue', label: 'good first issue' },
              { value: 'help wanted', label: 'help wanted' },
              { value: 'beginner', label: 'beginner' },
              { value: 'documentation', label: 'documentation' },
              { value: 'easy', label: 'easy' }
            ]}
            value={selectedLabel}
            onChange={(e) => setSelectedLabel(e.target.value)}
          />

          <Input
            placeholder="Language (e.g. TypeScript, Python)..."
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
          />

          {/* Beginner Only Toggle Button */}
          <button
            type="button"
            onClick={() => setBeginnerOnly(!beginnerOnly)}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-all ${
              beginnerOnly
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 ${beginnerOnly ? 'text-emerald-400' : 'text-slate-500'}`}
            />
            <span>Beginner Friendly Only</span>
          </button>
        </div>

        {(search || beginnerOnly || selectedLabel || selectedLanguage) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <span className="text-slate-400">Filters active</span>
            <button
              onClick={handleResetFilters}
              className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Issues List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : issues.length > 0 ? (
        <>
          <div className="space-y-3">
            {issues.map((issue) => (
              <Card
                key={issue.id}
                className="bg-[#12151f] border-slate-800 hover:border-slate-700 hover:bg-[#151926] transition-all p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/repositories/${issue.repository.fullName}`}
                        className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                      >
                        <FolderGit2 className="w-3.5 h-3.5" />
                        <span>{issue.repository.fullName}</span>
                      </Link>

                      {issue.repository.language && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({issue.repository.language})
                        </span>
                      )}

                      {issue.isBeginnerFriendly && (
                        <Badge variant="success" size="sm">
                          Good First Issue
                        </Badge>
                      )}
                    </div>

                    <Link
                      href={`/issues/${issue.repository.fullName}/${issue.number}`}
                      className="text-sm sm:text-base font-semibold text-white hover:text-indigo-400 transition-colors block leading-snug"
                    >
                      {issue.title}
                    </Link>

                    {/* Labels */}
                    {issue.labels && issue.labels.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {issue.labels.slice(0, 5).map((l) => (
                          <span
                            key={l}
                            className="px-2 py-0.5 rounded bg-slate-800/80 text-[11px] text-slate-300"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                    <div className="text-right text-xs text-slate-400 space-y-1">
                      <div className="font-mono text-slate-500">#{issue.number}</div>
                      <div>{formatRelativeTime(issue.createdAt)}</div>
                      {issue.commentsCount > 0 && (
                        <div className="flex items-center gap-1 justify-end text-slate-400">
                          <MessageSquare className="w-3 h-3" />
                          <span>{issue.commentsCount}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/issues/${issue.repository.fullName}/${issue.number}`}>
                        <Button size="sm" variant="outline" className="text-xs border-slate-700">
                          Inspect
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>

                      <a
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="View on GitHub"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
            <span>
              Page {pagination.page} of {pagination.totalPages || 1}
              {pagination.total !== undefined ? ` (${pagination.total} total)` : ''}
            </span>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrevPage}
                onClick={() => fetchIssues(pagination.page - 1)}
                className="border-slate-800 text-xs"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() => fetchIssues(pagination.page + 1)}
                className="border-slate-800 text-xs"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="No Issues Match Your Filters"
          description="Try broadening your search keywords, disabling the beginner-friendly toggle, or selecting a different label."
          action={{
            label: 'Reset Filters',
            onClick: handleResetFilters
          }}
        />
      )}
    </div>
  );
}

export default function IssuesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading issues...</div>}>
      <IssuesListContent />
    </Suspense>
  );
}
