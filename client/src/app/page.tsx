'use client';

import React from 'react';
import Link from 'next/link';
import {
  Compass,
  Zap,
  Award,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Activity,
  Layers,
  Search,
  ExternalLink
} from 'lucide-react';
import { Github } from '../components/ui/Icons';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';

export default function LandingPage() {
  const { user, login } = useAuth();

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <header className="h-16 border-b border-[#181c28] bg-[#090a0f]/90 backdrop-blur-md sticky top-0 z-40 px-6 lg:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm tracking-wider shadow-sm shadow-indigo-950">
            AS
          </div>
          <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
            AceSoc
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              V1.0
            </span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
          <Link href="/organizations" className="hover:text-slate-200 transition-colors">
            Organizations
          </Link>
          <Link href="/repositories" className="hover:text-slate-200 transition-colors">
            Repositories
          </Link>
          <Link href="/issues" className="hover:text-slate-200 transition-colors">
            Issues
          </Link>
          <Link href="/recommendations" className="hover:text-slate-200 transition-colors">
            AI Guidance
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/dashboard">
              <Button size="sm" variant="primary" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <Button
              onClick={login}
              size="sm"
              variant="secondary"
              leftIcon={<Github className="w-4 h-4" />}
            >
              Connect GitHub
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 lg:px-12 max-w-6xl mx-auto flex flex-col items-center text-center">
        {/* Subtle pill tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#131724] border border-[#23293d] text-xs text-indigo-300 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>AI-Powered Open-Source Intelligence</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.15]">
          Your intelligence layer for open source.
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mt-5 leading-relaxed font-normal">
          Discover the right GSoC organizations, find repositories that match your skills, and turn open-source contributions into a structured journey.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3.5 mt-8">
          {user ? (
            <Link href="/dashboard">
              <Button size="lg" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Open Developer Dashboard
              </Button>
            </Link>
          ) : (
            <Button
              onClick={login}
              size="lg"
              variant="primary"
              leftIcon={<Github className="w-4 h-4" />}
            >
              Get Started with GitHub
            </Button>
          )}
          <Link href="/organizations">
            <Button size="lg" variant="outline">
              Explore Organizations
            </Button>
          </Link>
        </div>

        {/* Product Dashboard Preview (Clean & Grounded) */}
        <div className="w-full mt-14 rounded-2xl border border-[#22283a] bg-[#0c0f18] p-3 sm:p-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-[#1b2030] text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-[11px] text-slate-500">acesoc.dev / dashboard</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Intelligence Live
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-left">
            {/* Card 1 */}
            <div className="bg-[#101420] border border-[#1e2436] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">GSoC Organization</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  2024 Verified
                </span>
              </div>
              <h4 className="font-semibold text-sm text-slate-100">Pallets Projects</h4>
              <p className="text-xs text-slate-400 line-clamp-2">
                Python web development ecosystem powering Flask, Jinja, Click, and Werkzeug.
              </p>
              <div className="flex items-center gap-2 pt-2 text-[11px] font-mono text-slate-300">
                <span className="px-2 py-0.5 bg-[#181d2e] rounded border border-[#242b40]">Python</span>
                <span className="px-2 py-0.5 bg-[#181d2e] rounded border border-[#242b40]">12 Repos</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#101420] border border-[#1e2436] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">Intelligence Analysis</span>
                <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                  84 / 100
                </span>
              </div>
              <h4 className="font-semibold text-sm text-slate-100">pallets/flask</h4>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Activity Score</span>
                  <span className="font-mono text-slate-200">88%</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Contributor Friendliness</span>
                  <span className="font-mono text-slate-200">92%</span>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#101420] border border-[#1e2436] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">AI Contribution Match</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Low Curve
                </span>
              </div>
              <h4 className="font-semibold text-sm text-slate-100">Issue #5401: Type Annotation Fix</h4>
              <p className="text-xs text-slate-400">
                Matched with developer skill <strong>Python (Advanced)</strong>.
              </p>
              <div className="pt-2">
                <span className="text-[11px] text-indigo-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 4-step preparation checklist attached
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="py-16 px-6 lg:px-12 max-w-6xl mx-auto border-t border-[#181c28]">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Engineered for deliberate open-source growth.
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            AceSoc replaces random GitHub browsing with data-driven evaluation and structured contribution paths.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0e111a] border border-[#1b2030] rounded-xl p-5 hover:border-[#2b334c] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3.5">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1.5">GSoC Organization Discovery</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Explore verified organizations across multiple GSoC years, filter by technology and category, and review public repos.
            </p>
          </div>

          <div className="bg-[#0e111a] border border-[#1b2030] rounded-xl p-5 hover:border-[#2b334c] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3.5">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1.5">Repository Intelligence</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Transparent multi-signal scoring evaluates activity, maintenance cadence, documentation depth, and beginner friendliness.
            </p>
          </div>

          <div className="bg-[#0e111a] border border-[#1b2030] rounded-xl p-5 hover:border-[#2b334c] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3.5">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1.5">Deterministic Skill Matching</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Manage your confirmed skill taxonomy with proficiency levels and receive deterministic repo fit scores with clear explanations.
            </p>
          </div>

          <div className="bg-[#0e111a] border border-[#1b2030] rounded-xl p-5 hover:border-[#2b334c] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-3.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1.5">AI Contribution Guidance</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Personalized guidance grounded strictly in database records—checklists, maintainer questions, and difficulty estimates without hallucinations.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 lg:px-12 max-w-5xl mx-auto border-t border-[#181c28]">
        <div className="text-center max-w-lg mx-auto mb-12">
          <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-semibold">
            WORKFLOW
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            How AceSoc guides your contribution journey
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 w-7 h-7 rounded-md flex items-center justify-center">
              01
            </div>
            <h4 className="font-semibold text-sm text-slate-100">Connect GitHub</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sign in with your GitHub account using secure OAuth to establish your authenticated profile.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 w-7 h-7 rounded-md flex items-center justify-center">
              02
            </div>
            <h4 className="font-semibold text-sm text-slate-100">Set Developer Skills</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Register languages, frameworks, databases, and DevOps tools with your current proficiency level.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 w-7 h-7 rounded-md flex items-center justify-center">
              03
            </div>
            <h4 className="font-semibold text-sm text-slate-100">Explore Intelligence</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Evaluate GSoC organizations and inspect transparent health, activity, and maintenance scores.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 w-7 h-7 rounded-md flex items-center justify-center">
              04
            </div>
            <h4 className="font-semibold text-sm text-slate-100">Receive Actionable Guidance</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Get targeted open issues matched with your skills, complete with prep checklists and maintainer questions.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#181c28] bg-[#07080c] py-10 px-6 lg:px-12 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white font-black text-xs">
              AS
            </div>
            <span className="font-semibold text-slate-300">AceSoc</span>
            <span className="text-slate-500">— Find. Analyze. Contribute. Ace.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/organizations" className="hover:text-slate-200 transition-colors">
              Organizations
            </Link>
            <Link href="/repositories" className="hover:text-slate-200 transition-colors">
              Repositories
            </Link>
            <Link href="/issues" className="hover:text-slate-200 transition-colors">
              Issues
            </Link>
            <a
              href="https://github.com/sourodeepsaha2/KillSoc"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 transition-colors flex items-center gap-1"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
