'use client';

import React, { useState, useEffect } from 'react';
import { jobsApi } from '@/lib/api';
import type { JobStatusResponse, JobType, JobStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Cpu,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Layers,
  Sparkles,
  FolderGit2,
  Copy,
  Check
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

// Local storage key for persistent job monitoring across navigation
const STORAGE_KEY = 'killsoc_tracked_job_ids';

export default function JobsPage() {
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const [trackedJobs, setTrackedJobs] = useState<JobStatusResponse[]>([]);
  const [lookupJobId, setLookupJobId] = useState<string>('');
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Trigger modal state
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState<boolean>(false);
  const [selectedJobType, setSelectedJobType] = useState<JobType>('org-sync');
  const [paramInput, setParamInput] = useState<string>('');
  const [isEnqueueing, setIsEnqueueing] = useState<boolean>(false);

  useEffect(() => {
    // Load saved job IDs from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        if (ids.length > 0) {
          refreshAllJobs(ids);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Poll active jobs every 3 seconds if any are in 'waiting' or 'active' state
  useEffect(() => {
    const hasPending = trackedJobs.some(
      (j) => j.status === 'waiting' || j.status === 'active'
    );
    if (!hasPending) return;

    const interval = setInterval(() => {
      refreshAllJobs(trackedJobs.map((j) => j.jobId));
    }, 3000);

    return () => clearInterval(interval);
  }, [trackedJobs]);

  async function refreshAllJobs(ids: string[]) {
    try {
      const results = await Promise.all(
        ids.map((id) => jobsApi.getJobStatus(id).catch(() => null))
      );
      const valid = results.filter(Boolean) as JobStatusResponse[];
      setTrackedJobs(valid);
    } catch (err) {
      console.warn('Job refresh failed', err);
    }
  }

  function saveJobId(newId: string) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const ids: string[] = saved ? JSON.parse(saved) : [];
      if (!ids.includes(newId)) {
        ids.unshift(newId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, 15)));
      }
    } catch {
      // Ignore storage errors
    }
  }

  async function handleLookup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!isAuthenticated) {
      showToast('Please sign in with GitHub to inspect background jobs.', 'info');
      return;
    }
    if (!lookupJobId.trim()) return;

    setIsLookingUp(true);
    try {
      const job = await jobsApi.getJobStatus(lookupJobId.trim());
      saveJobId(job.jobId);
      setTrackedJobs((prev) => {
        const existing = prev.filter((j) => j.jobId !== job.jobId);
        return [job, ...existing];
      });
      showToast(`Located job ${job.jobId} (${job.status})`, 'success');
      setLookupJobId('');
    } catch (err: any) {
      showToast(err.message || 'Job ID not found in Redis queues', 'error');
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleEnqueueJob() {
    if (!isAuthenticated) {
      showToast('Please sign in with GitHub to dispatch background jobs.', 'info');
      return;
    }
    setIsEnqueueing(true);
    try {
      let res: { jobId: string; jobType: string; status: string };

      if (selectedJobType === 'org-sync') {
        const slug = paramInput.trim() || 'python';
        res = await jobsApi.syncOrg(slug, true);
        showToast(`Enqueued organization sync for "${slug}"`, 'success');
      } else if (selectedJobType === 'repo-analysis') {
        const target = paramInput.trim() || 'facebook/react';
        const [owner, repo] = target.split('/');
        if (!owner || !repo) {
          showToast('Please provide owner/repo format (e.g. facebook/react)', 'error');
          setIsEnqueueing(false);
          return;
        }
        res = await jobsApi.analyzeRepo(owner, repo, true);
        showToast(`Enqueued repository analysis for "${target}"`, 'success');
      } else {
        res = await jobsApi.generateAiRecommendations();
        showToast('Enqueued AI recommendation generation job', 'success');
      }

      saveJobId(res.jobId);
      // Fetch status
      const status = await jobsApi.getJobStatus(res.jobId);
      setTrackedJobs((prev) => [status, ...prev]);
      setIsTriggerModalOpen(false);
      setParamInput('');
    } catch (err: any) {
      showToast(err.message || 'Failed to enqueue job', 'error');
    } finally {
      setIsEnqueueing(false);
    }
  }

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" size="sm">Completed</Badge>;
      case 'active':
        return <Badge variant="indigo" size="sm">Active (Processing)</Badge>;
      case 'waiting':
        return <Badge variant="warning" size="sm">Waiting in Queue</Badge>;
      case 'failed':
        return <Badge variant="danger" size="sm">Failed</Badge>;
      case 'delayed':
        return <Badge variant="outline" size="sm">Delayed / Backoff</Badge>;
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-indigo-400" />
            <span>Background Job Activity</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry and execution monitor for asynchronous Redis + BullMQ workers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => refreshAllJobs(trackedJobs.map((j) => j.jobId))}
            variant="outline"
            className="border-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Poll Status</span>
          </Button>

          <Button
            onClick={() => setIsTriggerModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Enqueue Test Job</span>
          </Button>
        </div>
      </div>

      {/* Lookup Bar */}
      <div className="p-4 rounded-xl bg-[#12151f] border border-slate-800">
        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Query any BullMQ Job ID (e.g. 1, 2, org-sync-1234)..."
              value={lookupJobId}
              onChange={(e) => setLookupJobId(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <Button
            type="submit"
            isLoading={isLookingUp}
            className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs"
          >
            Inspect Job
          </Button>
        </form>
      </div>

      {/* Architecture Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-[#12151f] border border-slate-800 space-y-1.5">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Org Sync Queue</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Paginates GSoC organization repositories with rate-limit backoff.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#12151f] border border-slate-800 space-y-1.5">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <FolderGit2 className="w-4 h-4 text-emerald-400" />
            <span>Repo Analysis Queue</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Calculates 5-dimension intelligence scores from GitHub API signals.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#12151f] border border-slate-800 space-y-1.5">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>AI Synthesis Queue</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Synthesizes personalized repository matches and checklists via LLM.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#12151f] border border-slate-800 space-y-1.5">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>Redis + BullMQ</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Exponential retry policy, sanitized failure logs, safe shutdown.
          </p>
        </div>
      </div>

      {/* Tracked Jobs List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            Monitored Jobs ({trackedJobs.length})
          </h2>
          <span className="text-xs text-slate-500">Auto-refreshing</span>
        </div>

        {trackedJobs.length > 0 ? (
          <div className="space-y-3">
            {trackedJobs.map((job) => (
              <Card
                key={job.jobId}
                className="bg-[#12151f] border-slate-800 p-5 space-y-3 hover:border-slate-700 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-400 flex items-center gap-1.5">
                      <span>ID: {job.jobId}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyId(job.jobId)}
                        className="hover:text-white transition-colors"
                        title="Copy Job ID"
                      >
                        {copiedId === job.jobId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </span>

                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-indigo-400">
                      {job.jobType}
                    </span>
                  </div>

                  <div>{getStatusBadge(job.status)}</div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Progress</span>
                    <span className="font-mono">{job.progress || (job.status === 'completed' ? 100 : 0)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        job.status === 'completed'
                          ? 'bg-emerald-500'
                          : job.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{
                        width: `${job.progress || (job.status === 'completed' ? 100 : 20)}%`
                      }}
                    />
                  </div>
                </div>

                {/* Timestamps & Details */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Created {formatRelativeTime(job.createdAt)}</span>
                  </span>

                  {job.completedAt && (
                    <span className="text-emerald-400">
                      Finished {formatRelativeTime(job.completedAt)}
                    </span>
                  )}
                </div>

                {/* Failure Reason if any */}
                {job.failedReason && (
                  <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                    <span className="font-mono text-[11px] break-all">{job.failedReason}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-[#12151f] p-8 text-center space-y-3">
            <Cpu className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-semibold text-white">No Tracked Jobs Yet</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Enqueue a background synchronization or analysis job to monitor its queue state and worker execution in real-time.
            </p>
            <Button
              size="sm"
              onClick={() => setIsTriggerModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
            >
              Enqueue Test Job
            </Button>
          </div>
        )}
      </div>

      {/* Enqueue Job Modal */}
      <Modal
        isOpen={isTriggerModalOpen}
        onClose={() => setIsTriggerModalOpen(false)}
        title="Enqueue Asynchronous Job"
        description="Select a job queue and target entity to execute via BullMQ workers."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Job Queue
            </label>
            <select
              value={selectedJobType}
              onChange={(e) => setSelectedJobType(e.target.value as JobType)}
              className="w-full bg-[#12151f] border border-slate-800 rounded-lg text-xs text-slate-200 px-3.5 py-2.5 outline-none focus:border-indigo-500"
            >
              <option value="org-sync">Organization Repository Sync (org-sync)</option>
              <option value="repo-analysis">Repository Intelligence Analysis (repo-analysis)</option>
              <option value="ai-recommendations">AI Recommendations (ai-recommendations)</option>
            </select>
          </div>

          {selectedJobType === 'org-sync' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Organization Slug
              </label>
              <Input
                placeholder="e.g. python, palisadoesfoundation, tensorflow"
                value={paramInput}
                onChange={(e) => setParamInput(e.target.value)}
              />
            </div>
          )}

          {selectedJobType === 'repo-analysis' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Target Repository (owner/repo)
              </label>
              <Input
                placeholder="e.g. facebook/react, tensorflow/tensorflow"
                value={paramInput}
                onChange={(e) => setParamInput(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              variant="outline"
              onClick={() => setIsTriggerModalOpen(false)}
              className="border-slate-800 text-slate-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnqueueJob}
              isLoading={isEnqueueing}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Dispatch to Queue
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
