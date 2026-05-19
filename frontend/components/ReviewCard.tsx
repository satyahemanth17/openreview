'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Review } from '../lib/api';

const STATUS_COLORS: Record<Review['status'], string> = {
  open: 'bg-gh-success/20 text-gh-success border border-gh-success/40',
  closed: 'bg-gray-500/20 text-gray-400 border border-gray-500/40',
  merged: 'bg-purple-500/20 text-purple-400 border border-purple-500/40',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface ReviewCardProps {
  review: Review;
  currentUserId: string | null;
  onDelete: (reviewId: string) => void;
  onPin: (reviewId: string) => void;
}

export default function ReviewCard({ review, currentUserId, onDelete, onPin }: ReviewCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  function handleDeleteConfirm() {
    setDeleting(true);
    setTimeout(() => {
      onDelete(review._id);
    }, 300);
  }

  const isOwner = currentUserId === review.author._id;

  return (
    <div
      className={`relative group transition-all duration-300 ${
        deleting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
    >
      {/* Pin badge */}
      {review.pinned && (
        <span
          className="absolute top-2 left-2 z-10 text-xs font-bold"
          style={{ color: '#3ecf8e' }}
        >
          📌
        </span>
      )}

      {/* Three-dot menu button */}
      {isOwner && (
        <div ref={menuRef} className="absolute top-2 right-2 z-10">
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gh-textSecondary hover:text-gh-textPrimary bg-gh-surface hover:bg-gh-bg border border-gh-border rounded px-1.5 py-0.5 text-sm cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
          >
            ⋮
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div className="absolute top-8 right-0 z-20 bg-gh-surface border border-gh-border rounded-md shadow-lg py-1 min-w-[120px]">
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-gh-textSecondary hover:text-gh-textPrimary hover:bg-white/5 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPin(review._id);
                  setMenuOpen(false);
                }}
              >
                {review.pinned ? '📌 Unpin' : '📌 Pin'}
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-gh-textSecondary hover:text-gh-textPrimary hover:bg-white/5 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowConfirm(true);
                  setMenuOpen(false);
                }}
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Card link */}
      <Link
        href={`/review/${review._id}`}
        className="block bg-gh-surface border border-gh-border rounded-lg p-4 hover:border-gh-primary transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-gh-textPrimary font-medium truncate">{review.title}</h3>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[review.status]}`}>
            {review.status}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-gh-textSecondary">
          {review.author.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={review.author.avatarUrl} alt="" className="w-4 h-4 rounded-full" />
          )}
          <span>{review.author.username}</span>
          <span>·</span>
          <span>{timeAgo(review.createdAt)}</span>
          <span>·</span>
          <span>{review.files.length} files</span>
        </div>
      </Link>

      {/* Delete confirmation overlay */}
      {showConfirm && (
        <div className="absolute inset-0 z-30 bg-gh-surface/95 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-gh-textPrimary">Delete this review?</p>
          <div className="flex items-center gap-2">
            <button
              className="text-xs px-3 py-1 text-gh-textSecondary hover:text-gh-textPrimary cursor-pointer"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="text-xs px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded cursor-pointer"
              onClick={handleDeleteConfirm}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
