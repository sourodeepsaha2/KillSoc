'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { discoveryApi } from '@/lib/api';
import type { DiscoveredOrganization, PaginationMeta } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ScoreIndicator } from '@/components/ui/ScoreIndicator';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Search,
  Filter,
  Layers,
  ArrowRight,
  ExternalLink,
  Calendar,
  Code2,
  FolderGit2,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const YEARS = [
  { value: '', label: 'All GSoC Years' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
  { value: '2021', label: '2021' }
];

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'Cloud', label: 'Cloud & Infrastructure' },
  { value: 'Operating Systems', label: 'Operating Systems' },
  { value: 'Artificial Intelligence', label: 'Artificial Intelligence & ML' },
  { value: 'Web', label: 'Web Development' },
  { value: 'Programming Languages', label: 'Programming Languages' },
  { value: 'Science and Medicine', label: 'Science & Medicine' },
  { value: 'Security', label: 'Security & Privacy' }
];

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<DiscoveredOrganization[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    perPage: 12,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [search, setSearch] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [technology, setTechnology] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchOrganizations = useCallback(
    async (page: number = 1) => {
      setIsLoading(true);
      try {
        const res = await discoveryApi.getOrganizations({
          page,
          perPage: 12,
          search: search.trim() || undefined,
          year: selectedYear ? parseInt(selectedYear, 10) : undefined,
          category: selectedCategory || undefined,
          technology: technology.trim() || undefined
        });
        setOrganizations(res.data);
        setPagination(res.pagination);
      } catch (err: any) {
        console.error('Failed to load organizations', err);
      } finally {
        setIsLoading(false);
      }
    },
    [search, selectedYear, selectedCategory, technology]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrganizations(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchOrganizations]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedYear('');
    setSelectedCategory('');
    setTechnology('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-400" />
            <span>GSoC Organizations</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Explore official Google Summer of Code organizations, evaluate activity metrics, and discover repositories.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-[#12151f] border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />

          <Select
            options={YEARS}
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          />

          <Select
            options={CATEGORIES}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          />

          <Input
            placeholder="Tech / Language (e.g. Python, Rust)..."
            value={technology}
            onChange={(e) => setTechnology(e.target.value)}
            leftIcon={<Code2 className="w-4 h-4 text-slate-400" />}
          />
        </div>

        {(search || selectedYear || selectedCategory || technology) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <span className="text-slate-400">
              Active filters applied
            </span>
            <button
              onClick={handleResetFilters}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Organizations Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-[#12151f] border-slate-800 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-12 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
              </div>
            </Card>
          ))}
        </div>
      ) : organizations.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {organizations.map((org) => (
              <Card
                key={org.id}
                className="bg-[#12151f] border-slate-800 hover:border-slate-700 hover:bg-[#151926] transition-all flex flex-col justify-between group"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Org Brand Header */}
                  <div className="flex items-start gap-3">
                    {org.imageUrl ? (
                      <img
                        src={org.imageUrl}
                        alt={org.name}
                        className="w-12 h-12 rounded-xl object-contain bg-slate-900 border border-slate-800 p-1"
                        onError={(e) => {
                          // Fallback to letter avatar on error
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg shrink-0">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/organizations/${org.slug}`}
                        className="font-semibold text-base text-white hover:text-indigo-400 transition-colors truncate block"
                      >
                        {org.name}
                      </Link>
                      {org.category && (
                        <span className="text-xs text-slate-400 truncate block">
                          {org.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {org.description || 'Google Summer of Code participating organization.'}
                  </p>

                  {/* Topics / Technologies */}
                  {org.topics?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {org.topics.slice(0, 4).map((topic) => (
                        <span
                          key={topic}
                          className="px-2 py-0.5 rounded-md bg-slate-800/80 text-[11px] text-slate-300 font-mono"
                        >
                          {topic}
                        </span>
                      ))}
                      {org.topics.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-800/40 text-[10px] text-slate-500">
                          +{org.topics.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* GSoC Years Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {org.years && org.years.length > 0 ? (
                      org.years.slice(0, 4).map((y) => (
                        <Badge key={y} variant="outline" size="sm" className="font-mono text-[10px]">
                          {y}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" size="sm" className="text-[10px]">GSoC</Badge>
                    )}
                  </div>
                </CardContent>

                {/* Footer with Metrics & Action */}
                <div className="px-5 py-3.5 bg-slate-900/40 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-slate-400">
                    <span className="flex items-center gap-1">
                      <FolderGit2 className="w-3.5 h-3.5" />
                      <span>{org.repositoryCount || 0} repos</span>
                    </span>
                    {org.averageQualityScore !== null && (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <span>★ {org.averageQualityScore}</span>
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/organizations/${org.slug}`}
                    className="inline-flex items-center gap-1 font-medium text-indigo-400 group-hover:text-indigo-300 transition-colors"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-sm">
            <div className="text-xs text-slate-400">
              Showing page <span className="font-medium text-white">{pagination.page}</span>
              {pagination.totalPages ? ` of ${pagination.totalPages}` : ''}
              {pagination.total !== undefined ? ` (${pagination.total} total)` : ''}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrevPage}
                onClick={() => fetchOrganizations(pagination.page - 1)}
                className="border-slate-800 text-xs"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() => fetchOrganizations(pagination.page + 1)}
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
          icon={Layers}
          title="No Organizations Found"
          description="We couldn't find any GSoC organizations matching your search criteria. Try modifying your filters or clearing them."
          action={{
            label: 'Clear Filters',
            onClick: handleResetFilters
          }}
        />
      )}
    </div>
  );
}
