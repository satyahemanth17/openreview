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

export default function ReviewCard({ review }: { review: Review }) {
  return (
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
  );
}
