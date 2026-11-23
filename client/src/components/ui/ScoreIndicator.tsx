import React from 'react';
import { getScoreBadge } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface ScoreIndicatorProps {
  score: number | undefined | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ScoreIndicator({
  score,
  size = 'md',
  showLabel = true,
  className
}: ScoreIndicatorProps) {
  const badge = getScoreBadge(score);
  const rounded = score !== undefined && score !== null ? Math.round(score) : '—';

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base font-bold px-3 py-1.5'
  };

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'font-semibold rounded-md border flex items-center gap-1.5 font-mono select-none',
          badge.bg,
          badge.color,
          badge.border,
          sizes[size]
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
        <span>{rounded}</span>
        {size !== 'sm' && <span className="text-[10px] opacity-60">/100</span>}
      </span>
      {showLabel && size !== 'sm' && (
        <span className="text-xs text-slate-400 font-medium">{badge.label}</span>
      )}
    </div>
  );
}

interface ScoreBarProps {
  label: string;
  score: number;
  weight?: string;
  description?: string;
}

export function ScoreBar({ label, score, weight, description }: ScoreBarProps) {
  const badge = getScoreBadge(score);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-200">{label}</span>
          {weight && <span className="text-[10px] text-slate-500">({weight})</span>}
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className={cn('font-semibold', badge.color)}>{Math.round(score)}</span>
          <span className="text-slate-600 text-[10px]">/100</span>
        </div>
      </div>
      <div className="h-2 w-full bg-[#181c28] rounded-full overflow-hidden border border-[#222738]/50">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            score >= 80 ? 'bg-emerald-500' : score >= 65 ? 'bg-indigo-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
          )}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
      {description && <p className="text-[11px] text-slate-500">{description}</p>}
    </div>
  );
}
