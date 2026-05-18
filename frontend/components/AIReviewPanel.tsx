'use client';

import { useState, useEffect } from 'react';

interface AIReviewPanelProps {
  filename: string | null;
  patch: string | null;
  open: boolean;
}

export default function AIReviewPanel({ filename, patch, open }: AIReviewPanelProps) {
  const [inputText, setInputText] = useState('Review this diff');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [displayedText, setDisplayedText] = useState('');

  // Reset state when filename changes
  useEffect(() => {
    setResponse('');
    setDisplayedText('');
    setInputText('Review this diff');
  }, [filename]);

  // Typewriter effect
  useEffect(() => {
    if (!response) {
      setDisplayedText('');
      return;
    }
    setDisplayedText('');
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (index < response.length) {
        setDisplayedText(response.slice(0, index + 1));
        index++;
        timer = setTimeout(tick, 12);
      }
    };

    timer = setTimeout(tick, 12);

    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [response]);

  async function handleSend() {
    if (!filename || !patch || loading) return;

    setLoading(true);
    setResponse('');
    setDisplayedText('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5001/api/ai/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ filename, patch, question: inputText }),
      });

      if (!res.ok) throw new Error('Non-OK response');

      const data = await res.json();
      setResponse(data.review);
    } catch {
      setResponse('Failed to get AI review. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`bg-gh-surface border-t border-gh-border p-3 h-48 overflow-y-auto ${open ? '' : 'hidden'}`}
    >
      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
          className="bg-gh-bg border border-gh-border rounded px-3 py-1.5 text-sm text-gh-textPrimary focus:outline-none focus:border-gh-primary flex-1"
          placeholder="Ask about this diff..."
        />
        <button
          onClick={handleSend}
          disabled={loading || !filename || !patch}
          className="px-3 py-1.5 text-sm bg-gh-primary text-white rounded disabled:opacity-50 cursor-pointer hover:bg-gh-primary/90"
        >
          Send
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 mt-2">
          <div className="animate-spin border-2 border-gh-border border-t-[#58a6ff] rounded-full w-4 h-4" />
          <span className="text-gh-textSecondary text-sm">Thinking...</span>
        </div>
      )}

      {/* AI response */}
      {displayedText && !loading && (
        <div className="bg-gh-bg rounded border-l-2 border-gh-primary p-3 mt-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span>✨</span>
            <span className="text-xs text-gh-primary font-semibold">AI Review</span>
          </div>
          <p className="text-sm text-gh-textPrimary whitespace-pre-wrap">{displayedText}</p>
        </div>
      )}
    </div>
  );
}
