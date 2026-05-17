'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CodeEditor from '../../../components/CodeEditor';
import CommentThread from '../../../components/CommentThread';
import { Review, Comment, getReview, getComments, createComment } from '../../../lib/api';
import { joinReview, leaveReview, getSocket } from '../../../lib/socket';

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<Review | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeReviewers, setActiveReviewers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;

    Promise.all([getReview(id ?? ''), getComments(id ?? '')])
      .then(([r, c]) => {
        setReview(r);
        setComments(c);
        if (r.files.length > 0) setSelectedFile(r.files[0].filename);
      })
      .catch((err) => { console.error('Failed to load review:', err); setError(true); })
      .finally(() => setLoading(false));

    joinReview(id ?? '');

    const socket = getSocket();
    const updateComment = (c: Comment) => setComments((prev) => prev.map((x) => (x._id === c._id ? c : x)));
    const onNew = (c: Comment) => setComments((prev) =>
      prev.some((x) => x._id === c._id) ? prev : [...prev, c]
    );
    const onJoined = ({ username }: { username: string }) =>
      setActiveReviewers((prev) => [...new Set([...prev, username])]);
    const onLeft = ({ username }: { username: string }) =>
      setActiveReviewers((prev) => prev.filter((u) => u !== username));

    socket.on('comment:new', onNew);
    socket.on('comment:reply', updateComment);
    socket.on('comment:resolved', updateComment);
    socket.on('comment:reaction', updateComment);
    socket.on('reviewer:joined', onJoined);
    socket.on('reviewer:left', onLeft);

    return () => {
      leaveReview(id ?? '');
      socket.off('comment:new', onNew);
      socket.off('comment:reply', updateComment);
      socket.off('comment:resolved', updateComment);
      socket.off('comment:reaction', updateComment);
      socket.off('reviewer:joined', onJoined);
      socket.off('reviewer:left', onLeft);
    };
  }, [id]);

  const handleUpdateComment = useCallback((updated: Comment) => {
    setComments((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
  }, []);

  const handleAddComment = useCallback(
    async (body: string) => {
      await createComment(id ?? '', { filename: selectedFile ?? undefined, body });
      // State update comes via comment:new socket event (deduplicated) — no optimistic add
    },
    [id, selectedFile]
  );

  const handleAddLineComment = useCallback(
    async (line: number, body: string) => {
      await createComment(id ?? '', { filename: selectedFile ?? undefined, line, body });
    },
    [id, selectedFile]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gh-bg">
        <p className="text-gh-textSecondary">Loading review...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gh-bg">
        <p className="text-red-400">Failed to load review. Please try again.</p>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gh-bg">
        <p className="text-red-400">Review not found.</p>
      </div>
    );
  }

  const currentFile = review.files.find((f) => f.filename === selectedFile);

  return (
    <div className="h-screen flex flex-col bg-gh-bg">
      {/* Header */}
      <header className="border-b border-gh-border bg-gh-surface px-4 py-2 flex items-center gap-3 shrink-0">
        <Link href="/" className="text-gh-textSecondary hover:text-gh-primary text-sm">← Reviews</Link>
        <h1 className="text-sm font-medium text-gh-textPrimary truncate flex-1">{review.title}</h1>
        {activeReviewers.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-gh-textSecondary">
            <span className="w-2 h-2 rounded-full bg-gh-success inline-block" />
            {activeReviewers.join(', ')}
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* File tree */}
        <aside className="w-56 border-r border-gh-border bg-gh-surface overflow-y-auto shrink-0">
          <div className="p-2">
            <p className="text-xs font-semibold text-gh-textSecondary uppercase tracking-wide px-2 py-1">Files</p>
            {review.files.map((f) => {
              const commentCount = comments.filter((c) => c.filename === f.filename).length;
              return (
                <button
                  key={f.filename}
                  onClick={() => setSelectedFile(f.filename)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                    selectedFile === f.filename
                      ? 'bg-gh-primary/10 text-gh-primary'
                      : 'text-gh-textSecondary hover:text-gh-textPrimary hover:bg-white/5'
                  }`}
                >
                  <span className="truncate block">{f.filename}</span>
                  <span className="text-xs">
                    <span className="text-gh-success">+{f.additions}</span>{' '}
                    <span className="text-red-400">-{f.deletions}</span>
                    {commentCount > 0 && (
                      <span className="ml-1 text-gh-primary">💬{commentCount}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Editor */}
        <main className="flex-1 overflow-hidden">
          {currentFile ? (
            <CodeEditor
              filename={currentFile.filename}
              patch={currentFile.patch}
              onAddLineComment={handleAddLineComment}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gh-textSecondary">
              Select a file to view
            </div>
          )}
        </main>

        {/* Comments panel */}
        <aside className="w-80 border-l border-gh-border bg-gh-surface overflow-y-auto shrink-0 p-3">
          <CommentThread
            comments={comments}
            onUpdate={handleUpdateComment}
            onAdd={handleAddComment}
            filename={selectedFile ?? undefined}
          />
        </aside>
      </div>
    </div>
  );
}
