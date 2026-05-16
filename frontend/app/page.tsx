'use client';

import { useEffect, useState } from 'react';
import ReviewCard from '../components/ReviewCard';
import { Review, ReviewFile, GithubFile, getReviews, createReview, getPRDetails, getPRFiles } from '../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importForm, setImportForm] = useState({ owner: '', repo: '', pr: '' });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
    if (t) {
      getReviews()
        .then(setReviews)
        .catch((err) => console.error('Failed to load reviews:', err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gh-bg gap-4">
        <h1 className="text-2xl font-bold text-gh-textPrimary">OpenReview</h1>
        <p className="text-gh-textSecondary">Real-time collaborative code review</p>
        <a
          href={`${API_URL}/api/auth/github`}
          className="px-6 py-2.5 bg-gh-primary text-white rounded-lg font-medium hover:bg-gh-primary/90 transition-colors"
        >
          Login with GitHub
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gh-bg">
      <header className="border-b border-gh-border bg-gh-surface px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold text-gh-textPrimary">OpenReview</h1>
        <button
          onClick={() => setShowImport(true)}
          className="px-4 py-1.5 bg-[#3ecf8e] text-[#0f1117] text-sm font-medium rounded-md hover:opacity-90 cursor-pointer"
        >
          Import PR
        </button>
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
