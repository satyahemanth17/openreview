'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

interface AISidebarProps {
  filename: string | null;
  patch: string | null;
  onClose: () => void;
}

export default function AISidebar({ filename, patch, onClose }: AISidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('Review this diff');
  const [loading, setLoading] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);

  // Reset on file change
  useEffect(() => {
    setMessages([]);
    setPendingText('');
    setDisplayedText('');
    setInputText('Review this diff');
  }, [filename]);

  // Typewriter effect — when typing completes, commit to messages
  useEffect(() => {
    if (!pendingText) return;
    setDisplayedText('');
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (index < pendingText.length) {
        setDisplayedText(pendingText.slice(0, index + 1));
        index++;
        timer = setTimeout(tick, 12);
      } else {
        setMessages((prev) => [...prev, { id: nextIdRef.current++, role: 'assistant', content: pendingText }]);
        setPendingText('');
        setDisplayedText('');
      }
    };
    timer = setTimeout(tick, 12);
    return () => { if (timer !== null) clearTimeout(timer); };
  }, [pendingText]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, displayedText, loading]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = sidebarWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = dragStartXRef.current - ev.clientX;
      setSidebarWidth(Math.min(600, Math.max(280, dragStartWidthRef.current + delta)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  async function handleSend() {
    if (!filename || !patch || loading || !!displayedText || !inputText.trim()) return;
    const question = inputText.trim();
    setMessages((prev) => [...prev, { id: nextIdRef.current++, role: 'user', content: question }]);
    setInputText('');
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5001/api/ai/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ filename, patch, question }),
      });
      if (!res.ok) throw new Error('Non-OK response');
      const data = await res.json();
      setPendingText(data.review || 'Failed to get AI review. Please try again.');
    } catch {
      setMessages((prev) => [...prev, { id: nextIdRef.current++, role: 'assistant', content: 'Failed to get AI review. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed right-0 bottom-0 z-50 flex bg-[#1c1e2e] border-l border-[#2a2d3e] shadow-2xl"
      style={{ top: '37px', width: sidebarWidth }}
    >
      {/* Drag handle */}
      <div
        className="w-1 shrink-0 cursor-col-resize hover:bg-gh-primary/40 transition-colors"
        onMouseDown={handleDragStart}
      />

      {/* Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d3e] shrink-0">
          <div className="flex items-center gap-2">
            <span>✨</span>
            <span className="text-sm font-semibold text-gh-textPrimary">AI Review</span>
          </div>
          <button
            onClick={onClose}
            className="text-gh-textSecondary hover:text-gh-textPrimary cursor-pointer text-lg leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Filename pill */}
        {filename && (
          <div className="px-4 py-2 border-b border-[#2a2d3e] shrink-0">
            <span className="text-xs text-gh-textSecondary font-mono bg-gh-bg px-2 py-0.5 rounded-full border border-gh-border truncate block max-w-full">
              {filename}
            </span>
          </div>
        )}

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <div key={msg.id} className="flex justify-end">
                <div className="bg-gh-primary text-white text-sm px-3 py-2 rounded-lg max-w-[85%] break-words">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex justify-start">
                <div className="bg-gh-bg border-l-2 border-gh-primary p-3 rounded text-sm text-gh-textPrimary whitespace-pre-wrap max-w-full break-words">
                  <div className="flex items-center gap-1 mb-1">
                    <span>✨</span>
                    <span className="text-xs text-gh-primary font-semibold">AI Review</span>
                  </div>
                  {msg.content}
                </div>
              </div>
            )
          )}

          {(loading || displayedText) && (
            <div className="flex justify-start">
              <div className="bg-gh-bg border-l-2 border-gh-primary p-3 rounded text-sm text-gh-textPrimary max-w-full">
                {loading && !displayedText ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin border-2 border-gh-border border-t-[#58a6ff] rounded-full w-4 h-4 shrink-0" />
                    <span className="text-gh-textSecondary">Thinking...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1 mb-1">
                      <span>✨</span>
                      <span className="text-xs text-gh-primary font-semibold">AI Review</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{displayedText}</p>
                  </>
                )}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-[#2a2d3e] p-3 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && !displayedText && handleSend()}
              placeholder="Ask about this diff..."
              className="flex-1 bg-gh-bg border border-gh-border rounded px-3 py-1.5 text-sm text-gh-textPrimary focus:outline-none focus:border-gh-primary min-w-0"
            />
            <button
              onClick={handleSend}
              disabled={loading || !filename || !patch}
              className="px-3 py-1.5 text-sm bg-[#3ecf8e] text-black font-medium rounded disabled:opacity-50 cursor-pointer hover:opacity-90 shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
