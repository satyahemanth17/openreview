import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReviewFile {
  filename: string;
  patch: string;
  additions: number;
  deletions: number;
}

export interface IReview extends Document {
  title: string;
  description?: string;
  author: Types.ObjectId;
  status: 'open' | 'closed' | 'merged';
  prUrl?: string;
  prNumber?: number;
  repoOwner?: string;
  repoName?: string;
  files: IReviewFile[];
  reviewers: Types.ObjectId[];
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewFileSchema = new Schema<IReviewFile>(
  {
    filename: { type: String, required: true },
    patch: { type: String },
    additions: { type: Number },
    deletions: { type: Number },
  },
  { _id: false }
);

const ReviewSchema = new Schema<IReview>(
  {
    title: { type: String, required: true },
    description: { type: String },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['open', 'closed', 'merged'],
      default: 'open',
    },
    prUrl: { type: String },
    prNumber: { type: Number },
    repoOwner: { type: String },
    repoName: { type: String },
    files: { type: [ReviewFileSchema], default: [] },
    reviewers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
