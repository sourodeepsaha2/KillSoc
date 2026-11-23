'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { skillsApi, aiApi } from '@/lib/api';
import type { DeveloperSkill, SkillProficiency } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Code2,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Layers,
  Database,
  Terminal,
  Cpu,
  Search,
  AlertCircle
} from 'lucide-react';
import { getProficiencyBadge } from '@/lib/utils';

const SUGGESTED_SKILLS = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Rust',
  'Go',
  'C++',
  'Java',
  'React',
  'Next.js',
  'Node.js',
  'Express',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'Docker',
  'Kubernetes',
  'Machine Learning',
  'Deep Learning'
];

const PRESETS = [
  {
    name: 'Full-Stack TypeScript',
    skills: [
      { skillName: 'TypeScript', proficiency: 'Advanced' as SkillProficiency },
      { skillName: 'React', proficiency: 'Advanced' as SkillProficiency },
      { skillName: 'Node.js', proficiency: 'Intermediate' as SkillProficiency },
      { skillName: 'PostgreSQL', proficiency: 'Intermediate' as SkillProficiency }
    ]
  },
  {
    name: 'Python & AI/ML',
    skills: [
      { skillName: 'Python', proficiency: 'Advanced' as SkillProficiency },
      { skillName: 'PyTorch', proficiency: 'Intermediate' as SkillProficiency },
      { skillName: 'Machine Learning', proficiency: 'Intermediate' as SkillProficiency },
      { skillName: 'Docker', proficiency: 'Beginner' as SkillProficiency }
    ]
  },
  {
    name: 'Systems & Backend',
    skills: [
      { skillName: 'Rust', proficiency: 'Intermediate' as SkillProficiency },
      { skillName: 'Go', proficiency: 'Advanced' as SkillProficiency },
      { skillName: 'Docker', proficiency: 'Advanced' as SkillProficiency },
      { skillName: 'Kubernetes', proficiency: 'Intermediate' as SkillProficiency }
    ]
  }
];

export default function SkillsPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();

  const [skills, setSkills] = useState<DeveloperSkill[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSkill, setEditingSkill] = useState<DeveloperSkill | null>(null);
  const [skillNameInput, setSkillNameInput] = useState<string>('');
  const [proficiencyInput, setProficiencyInput] = useState<SkillProficiency>('Intermediate');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    loadSkills();
  }, [isAuthenticated]);

  async function loadSkills() {
    setIsLoading(true);
    try {
      if (isAuthenticated) {
        const data = await skillsApi.getSkills();
        setSkills(data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load skills', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenAddModal = (suggestedName?: string) => {
    setEditingSkill(null);
    setSkillNameInput(suggestedName || '');
    setProficiencyInput('Intermediate');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (skill: DeveloperSkill) => {
    setEditingSkill(skill);
    setSkillNameInput(skill.skillName);
    setProficiencyInput(skill.proficiency);
    setIsModalOpen(true);
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillNameInput.trim()) return;

    setIsSaving(true);
    try {
      if (editingSkill) {
        const updated = await skillsApi.updateSkill(editingSkill.id, proficiencyInput);
        setSkills(skills.map((s) => (s.id === updated.id ? updated : s)));
        showToast(`Updated ${updated.skillName} to ${proficiencyInput}`, 'success');
      } else {
        const created = await skillsApi.addSkill(skillNameInput.trim(), proficiencyInput);
        setSkills([...skills, created]);
        showToast(`Added ${created.skillName} (${proficiencyInput})`, 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save skill', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSkill = async (id: string, name: string) => {
    try {
      await skillsApi.deleteSkill(id);
      setSkills(skills.filter((s) => s.id !== id));
      showToast(`Removed ${name} from your profile`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete skill', 'error');
    }
  };

  const handleApplyPreset = async (preset: (typeof PRESETS)[0]) => {
    if (!isAuthenticated) {
      showToast('Please sign in to apply skill presets.', 'info');
      return;
    }
    setIsSaving(true);
    try {
      showToast(`Applying "${preset.name}" preset...`, 'info');
      const updated = await skillsApi.bulkUpdate(preset.skills);
      setSkills(updated);
      showToast(`Added ${preset.skills.length} skills from ${preset.name}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to apply preset', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    if (skills.length === 0) {
      showToast('Please add at least one skill before generating recommendations.', 'info');
      return;
    }
    setIsGenerating(true);
    try {
      showToast('Running recommendation engine...', 'info');
      await aiApi.generateRecommendations({ forceRefresh: true });
      showToast('New recommendations ready!', 'success');
      router.push('/recommendations');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate recommendations', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Code2 className="w-6 h-6 text-indigo-400" />
            <span>Developer Skill Profile</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your technical competencies to receive tailored GSoC repository and issue recommendations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => handleOpenAddModal()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Skill</span>
          </Button>

          {skills.length > 0 && (
            <Button
              variant="outline"
              onClick={handleGenerateRecommendations}
              isLoading={isGenerating}
              className="border-slate-700 text-slate-200 flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Match Repos</span>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Skill Presets */}
      <div className="p-5 rounded-2xl bg-[#12151f] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Quick Start Skill Stacks</span>
          </h3>
          <span className="text-[11px] text-slate-500">1-click bulk import</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-left transition-all space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white group-hover:text-indigo-400 transition-colors">
                  {preset.name}
                </span>
                <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
              </div>
              <div className="flex flex-wrap gap-1">
                {preset.skills.map((s) => (
                  <span
                    key={s.skillName}
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400"
                  >
                    {s.skillName}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Skills Inventory Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            Active Skills ({skills.length})
          </h2>
          <span className="text-xs text-slate-400">
            Isolated to your authenticated developer session
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : skills.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => {
              const badgeInfo = getProficiencyBadge(skill.proficiency);
              return (
                <Card
                  key={skill.id}
                  className="bg-[#12151f] border-slate-800 hover:border-slate-700 transition-all p-4 flex items-center justify-between group"
                >
                  <div className="space-y-1.5">
                    <div className="font-semibold text-white text-sm">
                      {skill.skillName}
                    </div>
                    <Badge
                      variant={
                        skill.proficiency === 'Advanced'
                          ? 'indigo'
                          : skill.proficiency === 'Intermediate'
                          ? 'cyan'
                          : 'outline'
                      }
                      size="sm"
                    >
                      {skill.proficiency}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(skill)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Edit proficiency"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(skill.id, skill.skillName)}
                      className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete skill"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Code2}
            title="No Skills Registered Yet"
            description="Add your programming languages, frameworks, and tools to unlock personalized GSoC repository matching."
            action={{
              label: 'Add First Skill',
              onClick: () => handleOpenAddModal()
            }}
          />
        )}
      </div>

      {/* Suggested Quick Add Tags */}
      <div className="p-5 rounded-2xl bg-[#12151f]/50 border border-slate-800 space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Popular Technologies
        </h3>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_SKILLS.filter(
            (s) => !skills.some((userSkill) => userSkill.skillName.toLowerCase() === s.toLowerCase())
          ).map((suggested) => (
            <button
              key={suggested}
              type="button"
              onClick={() => handleOpenAddModal(suggested)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:text-indigo-300 text-xs text-slate-300 transition-all"
            >
              <Plus className="w-3 h-3 text-slate-500" />
              <span>{suggested}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Add / Edit Skill Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSkill ? `Edit ${editingSkill.skillName}` : 'Add Developer Skill'}
        description="Configure your skill and self-assessed proficiency level."
      >
        <form onSubmit={handleSaveSkill} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Skill or Technology Name
            </label>
            <Input
              placeholder="e.g. TypeScript, Python, Docker, PyTorch"
              value={skillNameInput}
              onChange={(e) => setSkillNameInput(e.target.value)}
              disabled={Boolean(editingSkill)} // Name locked during edit
              autoFocus={!editingSkill}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Proficiency Level
            </label>
            <Select
              options={[
                { value: 'Beginner', label: 'Beginner (Basic familiarity & syntax)' },
                { value: 'Intermediate', label: 'Intermediate (Can build features & debug)' },
                { value: 'Advanced', label: 'Advanced (Deep architectural & production expertise)' }
              ]}
              value={proficiencyInput}
              onChange={(e) => setProficiencyInput(e.target.value as SkillProficiency)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="border-slate-800 text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSaving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {editingSkill ? 'Save Changes' : 'Add Skill'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
