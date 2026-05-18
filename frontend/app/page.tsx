'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import ReviewCard from '../components/ReviewCard';
import { Review, ReviewFile, GithubFile, getReviews, createReview, getPRDetails, getPRFiles } from '../lib/api';
import { resetSocket } from '../lib/socket';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/api$/, '');

const CODE_LINES = [
  '+ const result = await fetch(endpoint, opts)',
  '- var data = http.get(url).body',
  '+ return { status: 200, data: result.json() }',
  '- if (err != null) { throw err }',
  '+ async function reviewPR(id: string) {',
  '- function review(id) {',
  '+ const diff = await getDiff(pullRequest)',
  '- let diff = getPRData(pr)',
  '+ import { Monaco } from "@monaco-editor/react"',
  '- const editor = require("editor")',
  '+ comments.push({ line, body, author })',
  '- db.comments.insert(comment)',
  '+ socket.emit("comment:new", comment)',
  '- ws.send(JSON.stringify(comment))',
  '+ export default function CodeReview() {',
  '- module.exports = CodeReview',
  '+ const [comments, setComments] = useState([])',
  '- var comments = []',
  '+ useEffect(() => { socket.on("comment:new", cb) }, [])',
  '- setInterval(() => fetchComments(), 1000)',
];

type DiffLine = { type: 'add' | 'del' | 'ctx'; num: string; text: string };

const MOCK_DIFF: DiffLine[] = [
  { type: 'ctx', num: '1', text: 'import { useState } from "react"' },
  { type: 'ctx', num: '2', text: 'import { Monaco } from "./editor"' },
  { type: 'del', num: '3', text: '- function getReviews() {' },
  { type: 'add', num: '3', text: '+ async function getReviews() {' },
  { type: 'del', num: '4', text: '-   return db.reviews.find()' },
  { type: 'add', num: '4', text: '+   return await Review.find().lean()' },
  { type: 'ctx', num: '5', text: ' }' },
  { type: 'del', num: '7', text: '- const socket = io("localhost:3000")' },
  { type: 'add', num: '7', text: '+ const socket = io(SOCKET_URL)' },
  { type: 'add', num: '8', text: '+ socket.on("comment:new", handleNew)' },
];

type Particle = {
  x: number; y: number; speed: number;
  opacity: number; text: string; isAdd: boolean; size: number;
};

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importForm, setImportForm] = useState({ owner: '', repo: '', pr: '' });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroCardRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
    if (t) {
      try {
        const payload = JSON.parse(atob(t.split('.')[1]));
        setUsername(payload.username ?? null);
      } catch {}
      getReviews()
        .then(setReviews)
        .catch((err) => console.error('Failed to load reviews:', err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Floating code-line canvas — stops naturally when canvas unmounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = Array.from({ length: 22 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      speed: 0.25 + Math.random() * 0.45,
      opacity: 0.07 + Math.random() * 0.1,
      text: CODE_LINES[Math.floor(Math.random() * CODE_LINES.length)],
      isAdd: Math.random() > 0.5,
      size: 11 + Math.random() * 3,
    }));

    const draw = () => {
      if (!canvasRef.current) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.font = `${p.size}px "SFMono-Regular","Consolas",monospace`;
        ctx.fillStyle = p.isAdd
          ? `rgba(78,201,78,${p.opacity})`
          : `rgba(248,81,73,${p.opacity})`;
        ctx.fillText(p.text, p.x, p.y);
        p.y -= p.speed;
        if (p.y < -20) {
          p.y = canvas.height + 20;
          p.x = Math.random() * canvas.width;
          p.text = CODE_LINES[Math.floor(Math.random() * CODE_LINES.length)];
          p.isAdd = Math.random() > 0.5;
        }
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };
    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const card = heroCardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = ((e.clientY - cy) / (window.innerHeight / 2)) * -4;
    const ry = ((e.clientX - cx) / (window.innerWidth / 2)) * 6;
    card.style.transform = `perspective(1000px) rotateY(${45 + ry}deg) rotateX(${rx}deg) scale(1.01)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = heroCardRef.current;
    if (!card) return;
    card.style.transform = 'perspective(1000px) rotateY(45deg) scale(1)';
  }, []);

  // Add/remove tilt listeners only when on the login page
  useEffect(() => {
    if (token) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [token, handleMouseMove, handleMouseLeave]);

  async function handleImport() {
    const { owner, repo, pr } = importForm;
    if (!owner.trim() || !repo.trim() || !/^\d+$/.test(pr.trim())) {
      setImportError('Please enter a valid owner, repo, and PR number.');
      return;
    }
    const prNum = pr.trim();
    setImporting(true);
    setImportError('');
    try {
      const [prDetails, prFiles] = await Promise.all([
        getPRDetails(owner, repo, prNum),
        getPRFiles(owner, repo, prNum),
      ]);
      const files: ReviewFile[] = prFiles
        .filter((f: GithubFile) => f.patch != null)
        .map((f: GithubFile) => ({
          filename: f.filename,
          patch: f.patch || '',
          additions: f.additions,
          deletions: f.deletions,
        }));
      const review = await createReview({
        title: `PR #${prDetails.number}: ${prDetails.title}`,
        files,
      });
      setReviews((prev) => [review, ...prev]);
      setShowImport(false);
      setImportForm({ owner: '', repo: '', pr: '' });
    } catch {
      setImportError('Failed to import PR. Check owner/repo/number and try again.');
    } finally {
      setImporting(false);
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: '#0d1117', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`
          @keyframes badge-glow {
            0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(88,166,255,0.22); }
            50%      { opacity:0.8; box-shadow:0 0 14px 3px rgba(88,166,255,0.1); }
          }
          .bp1 { animation: badge-glow 2.8s ease-in-out infinite; }
          .bp2 { animation: badge-glow 2.8s ease-in-out 0.93s infinite; }
          .bp3 { animation: badge-glow 2.8s ease-in-out 1.86s infinite; }
          @media (min-width:1024px) { .hero-row { flex-direction:row !important; } }
        `}</style>

        {/* Canvas: floating diff lines */}
        <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

        {/* Ambient radial glow */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 55% at 50% 50%, rgba(88,166,255,0.065) 0%, rgba(62,207,142,0.04) 45%, transparent 70%)' }} />

        {/* Main content */}
        <div className="hero-row" style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 48, padding: '40px 24px', width: '100%', maxWidth: 1100, margin: '0 auto' }}>

          {/* 3D mock Monaco diff card */}
          <div
            ref={heroCardRef}
            style={{ transform: 'perspective(1000px) rotateY(45deg)', transition: 'transform 0.15s ease-out', transformStyle: 'preserve-3d', flexShrink: 0, width: '100%', maxWidth: 616, position: 'relative' }}
          >
            <div style={{ background: 'rgba(22,27,34,0.97)', border: '1px solid rgba(48,54,61,0.9)', borderRadius: 12, boxShadow: '0 40px 90px rgba(0,0,0,0.65), 0 0 0 1px rgba(88,166,255,0.07), inset 0 1px 0 rgba(255,255,255,0.04)', overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to right, black 60%, transparent 100%)', maskImage: 'linear-gradient(to right, black 60%, transparent 100%)' }}>
              {/* Window chrome */}
              <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#f85149', '#e3b341', '#3fb950'].map((c, i) => (
                    <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c, opacity: 0.9 }} />
                  ))}
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8b949e', marginLeft: 8 }}>api/reviews.ts</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#3fb950', background: 'rgba(63,185,80,0.12)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: 4, padding: '1px 6px' }}>+5</span>
                  <span style={{ fontSize: 10, color: '#f85149', background: 'rgba(248,81,73,0.12)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 4, padding: '1px 6px' }}>-3</span>
                </div>
              </div>
              {/* Diff lines */}
              <div style={{ padding: '6px 0', fontFamily: '"SFMono-Regular","Consolas",monospace', fontSize: 12, lineHeight: 1.65 }}>
                {MOCK_DIFF.map((line, i) => (
                  <div key={i} style={{
                    padding: '0 12px',
                    background: line.type === 'add' ? 'rgba(63,185,80,0.1)' : line.type === 'del' ? 'rgba(248,81,73,0.1)' : 'transparent',
                    color: line.type === 'add' ? '#4ec94e' : line.type === 'del' ? '#f85149' : '#8b949e',
                    display: 'flex', gap: 16,
                  }}>
                    <span style={{ color: '#484f58', minWidth: 18, textAlign: 'right', userSelect: 'none' }}>{line.num}</span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>
              {/* Inline comment preview */}
              <div style={{ margin: '8px 12px 12px', padding: '8px 10px', background: 'rgba(88,166,255,0.07)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg,#58a6ff,#3ecf8e)' }} />
                  <span style={{ fontSize: 11, color: '#58a6ff', fontFamily: 'monospace' }}>reviewer</span>
                  <span style={{ fontSize: 10, color: '#484f58', marginLeft: 'auto' }}>just now</span>
                </div>
                <p style={{ fontSize: 11, color: '#c9d1d9', margin: 0 }}>Use env var instead of hardcoded localhost ✓</p>
              </div>
            </div>
          </div>

          {/* Glassmorphism login card */}
          <div style={{
            background: 'rgba(22,27,34,0.72)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(48,54,61,0.75)',
            borderRadius: 18,
            boxShadow: '0 24px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
            padding: '44px 40px',
            maxWidth: 380,
            width: '100%',
            textAlign: 'center',
          }}>
            {/* Logo icon */}
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ margin: '0 auto 14px', display: 'block' }}>
              <rect width="44" height="44" rx="11" fill="url(#lg1)" />
              <path d="M13 15h18M13 22h11M13 29h14" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="31" cy="22" r="4.5" fill="white" fillOpacity="0.88" />
              <defs>
                <linearGradient id="lg1" x1="0" y1="0" x2="44" y2="44">
                  <stop offset="0%" stopColor="#58a6ff" />
                  <stop offset="100%" stopColor="#3ecf8e" />
                </linearGradient>
              </defs>
            </svg>

            <h1 style={{
              fontSize: 40, fontWeight: 800, letterSpacing: '-1.5px',
              background: 'linear-gradient(135deg,#58a6ff 0%,#3ecf8e 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', lineHeight: 1.1, margin: '0 0 10px',
            }}>
              OpenReview
            </h1>
            <p style={{ color: '#8b949e', fontSize: 15, margin: '0 0 34px', lineHeight: 1.6 }}>
              Real-time collaborative<br />code review
            </p>

            <a
              href={`${API_URL}/api/auth/github`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: '#3ecf8e', color: '#0a1628', fontWeight: 700, fontSize: 15,
                padding: '14px 24px', borderRadius: 10, textDecoration: 'none',
                boxShadow: '0 4px 28px rgba(62,207,142,0.4)',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.background = '#34ba7c';
                el.style.boxShadow = '0 6px 36px rgba(62,207,142,0.55)';
                el.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.background = '#3ecf8e';
                el.style.boxShadow = '0 4px 28px rgba(62,207,142,0.4)';
                el.style.transform = 'translateY(0)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Login with GitHub
            </a>
          </div>
        </div>

        {/* Animated stats badges */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center', padding: '0 24px 48px' }}>
          {([
            { label: 'Real-time Sync', cls: 'bp1' },
            { label: 'AI Code Review', cls: 'bp2' },
            { label: 'Monaco Diff Editor', cls: 'bp3' },
          ] as const).map(({ label, cls }) => (
            <div
              key={label}
              className={cls}
              style={{
                background: 'rgba(22,27,34,0.7)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(88,166,255,0.2)',
                borderRadius: 20,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 500,
                color: '#c9d1d9',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gh-bg">
      <header className="border-b border-gh-border bg-gh-surface px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold text-gh-textPrimary">OpenReview</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-1.5 bg-[#3ecf8e] text-[#0f1117] text-sm font-medium rounded-md hover:opacity-90 cursor-pointer"
          >
            Import PR
          </button>
          {username && (
            <div className="flex items-center gap-2 pl-3 border-l border-gh-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://github.com/${username}.png?size=32`} alt="" className="w-6 h-6 rounded-full" />
              <span className="text-xs text-gh-textSecondary">{username}</span>
              <button
                onClick={() => { localStorage.removeItem('token'); resetSocket(); window.location.href = 'http://localhost:3001'; }}
                className="text-xs text-gh-textSecondary hover:text-red-400 cursor-pointer transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-gh-textSecondary text-center">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <div className="text-center text-gh-textSecondary py-16">
            <p className="text-lg">No reviews yet.</p>
            <p className="text-sm mt-1">Import a GitHub PR to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <ReviewCard key={r._id} review={r} />
            ))}
          </div>
        )}
      </main>

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gh-surface border border-gh-border rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gh-textPrimary mb-4">Import GitHub PR</h2>
            <div className="space-y-3">
              <input
                className="w-full bg-gh-bg border border-gh-border rounded px-3 py-2 text-sm text-gh-textPrimary focus:outline-none focus:border-gh-primary"
                placeholder="Owner (e.g. vercel)"
                value={importForm.owner}
                onChange={(e) => setImportForm((p) => ({ ...p, owner: e.target.value }))}
              />
              <input
                className="w-full bg-gh-bg border border-gh-border rounded px-3 py-2 text-sm text-gh-textPrimary focus:outline-none focus:border-gh-primary"
                placeholder="Repository (e.g. next.js)"
                value={importForm.repo}
                onChange={(e) => setImportForm((p) => ({ ...p, repo: e.target.value }))}
              />
              <input
                className="w-full bg-gh-bg border border-gh-border rounded px-3 py-2 text-sm text-gh-textPrimary focus:outline-none focus:border-gh-primary"
                placeholder="PR Number (e.g. 42)"
                value={importForm.pr}
                onChange={(e) => setImportForm((p) => ({ ...p, pr: e.target.value }))}
              />
              {importError && <p className="text-red-400 text-sm">{importError}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowImport(false); setImportError(''); }}
                className="px-4 py-1.5 text-sm text-gh-textSecondary hover:text-gh-textPrimary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-1.5 bg-[#3ecf8e] text-[#0f1117] text-sm font-medium rounded disabled:opacity-50 hover:opacity-90 cursor-pointer"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
