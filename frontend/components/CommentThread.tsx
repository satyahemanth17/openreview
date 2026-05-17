'use client';

import { useState } from 'react';
import { Comment, addReaction, addReply, resolveComment } from '../lib/api';

const EMOJIS = ['👍', '👎', '❤️', '🚀', '👀'];

function CommentItem({
  comment,
  onUpdate,
}: {
  comment: Comment;
  onUpdate: (updated: Comment) => void;
}) {
  const [replyBody, setReplyBody] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReaction(emoji: string) {
    try {
      const updated = await addReaction(comment._id, emoji);
      onUpdate(updated);
    } catch {
      // ignore
    }
  }

  async function handleResolve() {
    try {
      const updated = await resolveComment(comment._id);
      onUpdate(updated);
    } catch {
      // ignore
    }
  }

  async function handleReply() {
    if (!replyBody.trim()) return;
    setLoading(true);
    try {
      const updated = await addReply(comment._id, replyBody.trim());
      onUpdate(updated);
      setReplyBody('');
      setShowReply(false);
    } finally {
      setLoading(false);
    }
  }

  const reactionCounts = EMOJIS.map((emoji) => ({
    emoji,
    count: comment.reactions.filter((r) => r.emoji === emoji).length,
  }));

  return (
    <div className={`border border-gh-border rounded-lg p-3 ${comment.resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        {comment.author.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.author.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
        )}
        <span className="text-sm font-medium text-gh-textPrimary">{comment.author.username}</span>
        <span className="ml-auto">
          {comment.resolved && (
            <span className="text-xs text-gh-success px-1.5 py-0.5 bg-gh-success/10 rounded">resolved</span>
          )}
        </span>
      </div>
      <p className="text-sm text-gh-textPrimary whitespace-pre-wrap">{comment.body}</p>

      {/* Reactions */}
      <div className="flex gap-1 mt-2 flex-wrap">
        {reactionCounts.map(({ emoji, count }) => (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className={`text-xs px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
              count > 0
                ? 'border-gh-primary/50 bg-gh-primary/10 text-gh-textPrimary'
                : 'border-gh-border text-gh-textSecondary hover:border-gh-primary/50'
            }`}
          >
            {emoji} {count > 0 && count}
          </button>
        ))}
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-2 pl-3 border-l border-gh-border space-y-2">
          {comment.replies.map((reply, i) => (
            <div key={`${reply.createdAt}-${i}`} className="text-sm">
              <span className="font-medium text-gh-textPrimary">{reply.author.username}: </span>
              <span className="text-gh-textPrimary">{reply.body}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => setShowReply(!showReply)}
          className="text-xs text-gh-textSecondary hover:text-gh-primary cursor-pointer"
        >
          Reply
        </button>
        {!comment.resolved ? (
          <button onClick={handleResolve} className="text-xs text-gh-textSecondary hover:text-gh-success cursor-pointer">
            Resolve
          </button>
        ) : (
          <button onClick={handleResolve} className="text-xs text-gh-textSecondary hover:text-gh-primary cursor-pointer">
            Reopen
          </button>
        )}
      </div>

      {showReply && (
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 bg-gh-bg border border-gh-border rounded px-2 py-1 text-sm text-gh-textPrimary focus:outline-none focus:border-gh-primary"
            placeholder="Write a reply..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !loading && handleReply()}
          />
          <button
            onClick={handleReply}
            disabled={loading}
            className="px-3 py-1 text-sm bg-gh-primary text-white rounded disabled:opacity-50 cursor-pointer"
          >
            Reply
          </button>
        </div>
      )}
    </div>
  );
}

interface InlineGroup {
  filename: string;
  line: number;
  items: Comment[];
}

export default function CommentThread({
  comments,
  onUpdate,
  onAdd,
  filename,
  onInlineCommentClick,
}: {
  comments: Comment[];
  onUpdate: (updated: Comment) => void;
  onAdd: (body: string) => Promise<void>;
  filename?: string;
  onInlineCommentClick?: (filename: string, line: number) => void;
}) {
  const [newBody, setNewBody] = useState('');
  const [loading, setLoading] = useState(false);

  // Inline: attached to a specific file line; General: everything else
  const inlineComments = comments.filter((c) => c.filename != null && c.line != null);
  const generalComments = comments.filter((c) => c.filename == null || c.line == null);

  // Group inline by filename + line, sorted
  const groupMap: Record<string, InlineGroup> = {};
  for (const c of inlineComments) {
    const key = `${c.filename}:${c.line}`;
    if (!groupMap[key]) groupMap[key] = { filename: c.filename!, line: c.line!, items: [] };
    groupMap[key].items.push(c);
  }
  const groups = Object.values(groupMap).sort((a, b) => {
    const fc = a.filename.localeCompare(b.filename);
    return fc !== 0 ? fc : a.line - b.line;
  });

  async function handleAdd() {
    if (!newBody.trim()) return;
    setLoading(true);
    try {
      await onAdd(newBody.trim());
      setNewBody('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Inline Comments */}
      {groups.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gh-textSecondary uppercase tracking-wide">
            Inline Comments ({inlineComments.length})
          </h3>
          {groups.map((group) => (
            <div key={`${group.filename}:${group.line}`} className="flex flex-col gap-2">
              <button
                onClick={() => onInlineCommentClick?.(group.filename, group.line)}
                className="text-xs font-mono text-gh-primary px-2 py-1 bg-gh-primary/10 rounded hover:bg-gh-primary/20 cursor-pointer w-full text-left transition-colors"
              >
                {group.filename} · Line {group.line}
              </button>
              {group.items.map((c) => (
                <CommentItem key={c._id} comment={c} onUpdate={onUpdate} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* General Comments */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gh-textSecondary uppercase tracking-wide">
          General Comments {generalComments.length > 0 && `(${generalComments.length})`}
        </h3>
        {generalComments.map((c) => (
          <CommentItem key={c._id} comment={c} onUpdate={onUpdate} />
        ))}
        <div className="mt-2">
          <textarea
            className="w-full bg-gh-bg border border-gh-border rounded px-3 py-2 text-sm text-gh-textPrimary focus:outline-none focus:border-gh-primary resize-none"
            rows={3}
            placeholder={filename ? `Leave a comment on ${filename}...` : 'Leave a comment...'}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
          />
          <button
            onClick={handleAdd}
            disabled={loading || !newBody.trim()}
            className="mt-1 px-4 py-1.5 text-sm bg-gh-primary text-white rounded disabled:opacity-50 hover:bg-gh-primary/90 cursor-pointer"
          >
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}
