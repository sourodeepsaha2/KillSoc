import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  action,
  className
}: EmptyStateProps) {
  const finalActionLabel = action?.label || actionLabel;
  const finalOnAction = action?.onClick || onAction;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-[#222738] rounded-xl bg-[#0b0d14]/50',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-[#131722] border border-[#222738] flex items-center justify-center text-slate-400 mb-4 shadow-inner">
        <Icon className="w-6 h-6 text-indigo-400/80" />
      </div>
      <h3 className="font-semibold text-base text-slate-100 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {finalActionLabel && finalOnAction && (
        <Button onClick={finalOnAction} variant="secondary" size="sm">
          {finalActionLabel}
        </Button>
      )}
    </div>
  );
}
