'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { discoveryApi, jobsApi } from '@/lib/api';
import type { DiscoveredOrganization, DiscoveredRepository, PaginationMeta } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ScoreIndicator } from '@/components/ui/ScoreIndicator';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { Github } from '@/components/ui/Icons';
import {
  Layers,
  Globe,
  Calendar,
  FolderGit2,
  RefreshCw,
  Search,
  Star,
  GitFork,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export default function OrganizationDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const router = useRouter();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const [org, setOrg] = useState<DiscoveredOrganization | null>(null);
  const [repos, setRepos] = useState<DiscoveredRepository[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    perPage: 12,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [search, setSearch] = useState<string>('');
  const [language, setLanguage] = useState<string>('');
  const [sort, setSort] = useState<string>('stars');
  const [isLoadingOrg, setIsLoadingOrg] = useState<boolean>(true);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    loadOrg();
  }, [slug]);

  useEffect(() => {
    loadRepos(1);
  }, [slug, search, language, sort]);

  async function loadOrg() {
    setIsLoadingOrg(true);
    try {
      const data = await discoveryApi.getOrganization(slug);
      setOrg(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization details', 'error');
    } finally {
      setIsLoadingOrg(false);
    }
  }

  async function loadRepos(page: number = 1) {
    setIsLoadingRepos(true);
    try {
      const res = await discoveryApi.getOrganizationRepos(slug, {
        page,
        perPage: 12,
        search: search.trim() || undefined,
        language: language || undefined,
        sort
      });
      setRepos(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      console.error('Failed to load organization repositories', err);
    } finally {
      setIsLoadingRepos(false);
    }
  }

  async function handleSyncRepositories() {
    if (!isAuthenticated) {
      showToast('Please sign in with GitHub to synchronize repositories.', 'info');
      return;
    }
    setIsSyncing(true);
    try {
      showToast(`Initiating repository synchronization for ${slug}...`, 'info');
      const job = await jobsApi.syncOrg(slug, true);
      showToast('Synchronization job enqueued in background!', 'success');
      // Give worker a moment to process, then refresh repos
      setTimeout(() => {
        loadRepos(1);
        setIsSyncing(false);
      }, 2500);
    } catch (err: any) {
      showToast(err.message || 'Failed to trigger synchronization job', 'error');
      setIsSyncing(false);
    }
  }

  if (isLoadingOrg) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Organization Not Found"
        description={`We could not locate organization "${slug}". It might not be in our database yet.`}
        action={{
          label: 'Back to Organizations',
          onClick: () => router.push('/organizations')
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/organizations"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to Organizations</span>
      </Link>

      {/* Organization Header Banner */}
      <div className="rounded-2xl bg-[#12151f] border border-slate-800 p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            {org.imageUrl ? (
              <img
                src={org.imageUrl}
                alt={org.name}
                className="w-16 h-16 rounded-2xl object-contain bg-slate-900 border border-slate-700/80 p-2 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-2xl shrink-0">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {org.name}
                </h1>
                {org.category && (
                  <Badge variant="indigo" size="md">{org.category}</Badge>
                )}
              </div>

              <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
                {org.description || 'Google Summer of Code participating organization.'}
              </p>

              {/* Links */}
              <div className="flex items-center gap-4 pt-2 text-xs">
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Official Website</span>
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                  </a>
                )}
                {org.githubUrl && (
                  <a
                    href={org.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>GitHub Organization</span>
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Sync Repositories Button */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={handleSyncRepositories}
              isLoading={isSyncing}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync Repositories</span>
            </Button>
          </div>
        </div>

        {/* Tags & Years Bar */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-medium">GSoC Years:</span>
            {org.years && org.years.length > 0 ? (
              org.years.map((y) => (
                <Badge key={y} variant="outline" size="sm" className="font-mono">
                  {y}
                </Badge>
              ))
            ) : (
              <span className="text-slate-400">Official Partner</span>
            )}
          </div>

          {org.topics && org.topics.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {org.topics.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-slate-300 font-mono"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Repositories Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-indigo-400" />
              <span>Repositories ({repos.length})</span>
            </h2>
            <p className="text-xs text-slate-400">
              Synchronized repositories and their codebase health metrics
            </p>
          </div>

          {/* Repos search / sort filter */}
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 sm:w-64"
              leftIcon={<Search className="w-3.5 h-3.5 text-slate-400" />}
            />
            <Select
              options={[
                { value: 'stars', label: 'Most Stars' },
                { value: 'quality', label: 'Highest Score' },
                { value: 'updated', label: 'Recently Updated' }
              ]}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-36 text-xs"
            />
          </div>
        </div>

        {/* Repos Grid */}
        {isLoadingRepos ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : repos.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {repos.map((repo) => (
                <Card
                  key={repo.id}
                  className="bg-[#12151f] border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/repositories/${repo.fullName}`}
                        className="font-semibold text-white hover:text-indigo-400 transition-colors text-sm truncate"
                      >
                        {repo.name}
                      </Link>
                      {repo.intelligence?.overallScore !== undefined ? (
                        <ScoreIndicator score={repo.intelligence.overallScore} size="sm" />
                      ) : (
                        <Badge variant="outline" size="sm">Unanalyzed</Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {repo.description || 'No description provided for this repository.'}
                    </p>

                    {/* Extracted Skills */}
                    {repo.extractedSkills && repo.extractedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {repo.extractedSkills.slice(0, 3).map((skill) => (
                          <Badge key={skill} variant="outline" size="sm" className="text-[10px]">
                            {skill}
                          </Badge>
                        ))}
                        {repo.extractedSkills.length > 3 && (
                          <span className="text-[10px] text-slate-500 self-center">
                            +{repo.extractedSkills.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>

                  {/* Card Footer */}
                  <div className="px-5 py-3 bg-slate-900/40 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-slate-400">
                      {repo.language && (
                        <span className="font-mono text-indigo-400">{repo.language}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <span>{formatNumber(repo.stars)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="w-3.5 h-3.5" />
                        <span>{formatNumber(repo.forks)}</span>
                      </span>
                    </div>

                    <Link
                      href={`/repositories/${repo.fullName}`}
                      className="font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <span>Analyze</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 text-xs text-slate-400">
              <span>Page {pagination.page} of {pagination.totalPages || 1}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => loadRepos(pagination.page - 1)}
                  className="border-slate-800 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNextPage}
                  onClick={() => loadRepos(pagination.page + 1)}
                  className="border-slate-800 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={FolderGit2}
            title="No Repositories Synchronized Yet"
            description="We haven't indexed repositories for this organization yet. Click below to fetch the repository catalog from GitHub."
            action={{
              label: 'Synchronize Repositories',
              onClick: handleSyncRepositories
            }}
          />
        )}
      </div>
    </div>
  );
}
