import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toLocaleString();
}

export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatRelativeTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'Recently';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently';
  
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(d);
}

export function getScoreBadge(score: number | undefined | null): {
  color: string;
  bg: string;
  border: string;
  label: string;
  tier: 'High' | 'Moderate' | 'Low' | 'Needs Attention';
  variant: 'success' | 'warning' | 'danger' | 'indigo' | 'outline';
} {
  if (score === undefined || score === null) {
    return {
      color: 'text-slate-400',
      bg: 'bg-slate-800/40',
      border: 'border-slate-700/50',
      label: 'Unrated',
      tier: 'Needs Attention',
      variant: 'outline'
    };
  }

  const s = Math.round(score);
  if (s >= 80) {
    return {
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      label: 'Exceptional',
      tier: 'High',
      variant: 'success'
    };
  }
  if (s >= 65) {
    return {
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
      label: 'Strong',
      tier: 'High',
      variant: 'indigo'
    };
  }
  if (s >= 50) {
    return {
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      label: 'Moderate',
      tier: 'Moderate',
      variant: 'warning'
    };
  }
  return {
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    label: 'Needs Attention',
    tier: 'Low',
    variant: 'danger'
  };
}

export function getProficiencyBadge(proficiency: string | undefined): {
  color: string;
  bg: string;
  border: string;
} {
  const p = (proficiency || '').toLowerCase();
  if (p === 'advanced') {
    return {
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/30'
    };
  }
  if (p === 'intermediate') {
    return {
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30'
    };
  }
  return {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30'
  };
}
