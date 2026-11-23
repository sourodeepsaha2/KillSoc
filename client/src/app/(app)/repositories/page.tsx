'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { discoveryApi } from '@/lib/api';
import type { DiscoveredRepository } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ScoreIndicator } from '@/components/ui/ScoreIndicator';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  FolderGit2,
  Search,
  Star,
  GitFork,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Code2,
  AlertCircle
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export default function RepositoriesPage() {
  const router = useRouter();
  const [directInput, setDirectInput] = useState<string>('');
  const [directError, setDirectError] = useState<string | null>(null);
  const [repos, setRepos] = useState<DiscoveredRepository[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');

  useEffect(() => {
    loadExploreRepos();
  }, []);

  async function loadExploreRepos() {
    setIsLoading(true);
    try {
      // Fetch orgs to get popular candidate repos
      const orgsRes = await discoveryApi.getOrganizations({ perPage: 6 });
      const fetchedRepos: DiscoveredRepository[] = [];

      for (const org of orgsRes.data.slice(0, 4)) {
        try {
          const repoRes = await discoveryApi.getOrganizationRepos(org.slug, { perPage: 4 });
          fetchedRepos.push(...repoRes.data);
        } catch {
          // Ignore individual org errors
        }
      }

      setRepos(fetchedRepos);
    } catch (err: any) {
      console.error('Failed to load explore repositories', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleDirectLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setDirectError(null);

    let clean = directInput.trim();
    if (!clean) return;

    // Handle full github URL e.g. https://github.com/owner/repo
    clean = clean.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');

    const parts = clean.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setDirectError('Please enter repository in owner/repo format (e.g. facebook/react)');
      return;
    }

    router.push(`/repositories/${parts[0]}/${parts[1]}`);
  };

  const filteredRepos = repos.filter((r) => {
    const matchesQuery =
      filterQuery === '' ||
      r.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(filterQuery.toLowerCase()) ||
      r.extractedSkills?.some((s) => s.toLowerCase().includes(filterQuery.toLowerCase()));

    const matchesLanguage =
      selectedLanguage === 'all' ||
      r.language?.toLowerCase() === selectedLanguage.toLowerCase();

    return matchesQuery && matchesLanguage;
  });

  const availableLanguages = Array.from(
    new Set(repos.map((r) => r.language).filter(Boolean) as string[])
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <FolderGit2 className="w-6 h-6 text-indigo-400" />
          <span>Repository Explorer &amp; Intelligence</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Analyze any open-source GitHub repository or explore synchronized GSoC codebases.
        </p>
      </div>

      {/* Direct Repository Inspection Bar */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950/40 via-[#151926] to-[#12151f] border border-indigo-900/50 p-6 sm:p-8 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Direct Repository Intelligence Inspection</span>
          </h2>
          <p className="text-xs text-slate-400">
            Enter any public GitHub repository to compute transparent activity, community, documentation, and beginner scores.
          </p>
        </div>

        <form onSubmit={handleDirectLookup} className="flex flex-col sm:flex-row gap-3 max-w-2xl">
          <div className="flex-1">
            <Input
              placeholder="e.g. facebook/react, tensorflow/tensorflow, rust-lang/rust"
              value={directInput}
              onChange={(e) => {
                setDirectInput(e.target.value);
                if (directError) setDirectError(null);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              error={directError || undefined}
            />
          </div>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0">
            Analyze Codebase
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>

        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
          <span className="text-slate-500">Popular:</span>
          {['freeCodeCamp/freeCodeCamp', 'torvalds/linux', 'vercel/next.js', 'pallets/flask'].map(
            (sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => router.push(`/repositories/${sample}`)}
                className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 hover:text-white transition-colors text-[11px] font-mono text-slate-300"
              >
                {sample}
              </button>
            )
          )}
        </div>
      </div>

      {/* Synchronized GSoC Repositories */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Indexed Codebases ({filteredRepos.length})
            </h2>
            <p className="text-xs text-slate-400">
              Repositories from verified Google Summer of Code organizations
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Input
              placeholder="Filter by name, skill, tech..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-48 sm:w-64"
              leftIcon={<Search className="w-3.5 h-3.5 text-slate-400" />}
            />

            {availableLanguages.length > 0 && (
              <select
                aria-label="Filter by language"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-[#12151f] border border-slate-800 rounded-lg text-xs text-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
              >
                <option value="all">All Languages</option>
                {availableLanguages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredRepos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRepos.map((repo) => (
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
                      {repo.fullName}
                    </Link>
                    {repo.intelligence?.overallScore !== undefined ? (
                      <ScoreIndicator score={repo.intelligence.overallScore} size="sm" />
                    ) : (
                      <Badge variant="outline" size="sm">Score Ready</Badge>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {repo.description || 'Open-source project participating in GSoC mentoring.'}
                  </p>

                  {/* Skills */}
                  {repo.extractedSkills && repo.extractedSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {repo.extractedSkills.slice(0, 3).map((s) => (
                        <Badge key={s} variant="outline" size="sm" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>

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
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-[#12151f] p-8 text-center">
            <p className="text-sm text-slate-400">
              No repositories currently match your filter criteria. Use the direct analyzer above or explore organizations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
