"use client";

import { InstallAppButton } from "@/components/landing/InstallAppButton";
import { HeroPreview } from "@/components/landing/HeroPreview";
import { getAuthPageUrl, getRedirectUrl } from "@/lib/auth-path";
import { desk } from "@/lib/ui/desk";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Lock,
  Scale,
} from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: Lock,
    title: "Private by design",
    body: "Every journal, checklist, and chart stays on your account. Row-level isolation keeps other traders out of your desk.",
  },
  {
    icon: BarChart3,
    title: "Performance analytics",
    body: "Win rate, equity curve, setup stats, and weekly flow — so you can see which edge is actually paying.",
  },
  {
    icon: ClipboardCheck,
    title: "Pre-trade checklists",
    body: "Run your rules before you click. Readiness scoring keeps discipline in the session, not just in a notebook.",
  },
  {
    icon: Scale,
    title: "Clean risk tools",
    body: "Stops, targets, R:R, lot size, and account balance sit next to the setup so size never outruns the plan.",
  },
] as const;

const steps = [
  {
    n: "01",
    title: "Create your desk",
    body: "Sign up with email. Your journal starts empty and private.",
  },
  {
    n: "02",
    title: "Check, then log",
    body: "Clear the pre-trade list, then capture pair, plan, and outcome.",
  },
  {
    n: "03",
    title: "Review the edge",
    body: "Analytics and calendar show what you repeat — and what to cut.",
  },
] as const;

const btnPrimary = desk.btnPrimary;
const btnGhost = desk.btnGhost;
const loginHref = getAuthPageUrl("/login");
const signupHref = getAuthPageUrl("/signup");
const homeHref = getRedirectUrl("/");

export function LandingPage() {
  return (
    <div className="desk-atmosphere min-h-screen bg-surface text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={homeHref} className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/35 via-violet-500/20 to-emerald-500/10 ring-1 ring-indigo-400/40 shadow-[0_0_18px_rgba(99,102,241,0.35)]">
              <Activity className="h-5 w-5 text-indigo-200" />
            </span>
            <span className="min-w-0">
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500 sm:block">
                Trading
              </span>
              <span className="block truncate text-base font-bold tracking-[0.16em] text-gradient sm:text-lg sm:tracking-[0.18em]">
                EDGE LOG
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href={loginHref}
              className="px-2 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white sm:px-3"
            >
              Sign in
            </Link>
            <Link href={signupHref} className={`${btnPrimary} !px-3 !py-2 sm:!px-5`}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-indigo-300">
              Trading journal PWA
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-zinc-50 sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1]">
              Track your edge.
              <span className="mt-1 block text-gradient">
                Prove your performance.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              Edge Log is a private desk for logging setups, running pre-trade
              checklists, and reading the numbers that actually move your
              account — installable on phone or desktop.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
              <Link href={signupHref} className={btnPrimary}>
                Get started
              </Link>
              <Link href={loginHref} className={btnGhost}>
                Sign in
              </Link>
              <InstallAppButton className={btnGhost} />
            </div>
          </div>

          <HeroPreview />
        </section>

        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Why traders stay
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
                A desk built around discipline, not noise.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                No social feed. No shared leaderboard. Just your process,
                your risk, and a clear read on whether the edge is real.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className={`${desk.card} p-6 hover:-translate-y-0.5`}
                  >
                    <div className={desk.bar} />
                    <div className={desk.wash} />
                    <div className="relative">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/30">
                        <Icon className="h-5 w-5 text-indigo-300" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold tracking-tight text-zinc-50">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                        {feature.body}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
              From first login to a readable edge.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.n} className="relative">
                  <p className="text-3xl font-extrabold tracking-tight text-indigo-300/40">
                    {step.n}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-zinc-50">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="relative overflow-hidden rounded-2xl border border-indigo-400/25 bg-[#0c0c16] px-6 py-10 shadow-[0_0_40px_rgba(99,102,241,0.12)] sm:px-10 sm:py-12">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-violet-600/5 to-emerald-500/10" />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                  <h2 className="text-2xl font-extrabold tracking-tight text-zinc-50 sm:text-3xl">
                    Open the desk. Keep the session clean.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                    Create an account, install Edge Log, and start logging
                    before the next setup — not after the damage.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link href={signupHref} className={btnPrimary}>
                    Get started
                  </Link>
                  <Link href={loginHref} className={btnGhost}>
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Edge Log by Owz</p>
          <div className="flex gap-4">
            <Link href={loginHref} className="hover:text-zinc-200">
              Sign in
            </Link>
            <Link href={signupHref} className="hover:text-zinc-200">
              Create an account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
