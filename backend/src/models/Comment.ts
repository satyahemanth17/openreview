import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReply {
  author: Types.ObjectId | string;
  body: string;
  createdAt: Date;
}

export interface IReaction {
  userId: Types.ObjectId | string;
  emoji: string;
}

export interface IComment extends Document {
  reviewId: Types.ObjectId | string;
  author: Types.ObjectId | string;
  filename?: string;
  lineStart?: number;
  lineEnd?: number;
  pane?: 'original' | 'modified';
  body: string;
  resolved: boolean;
  replies: IReply[];
  reactions: IReaction[];
  createdAt: Date;
}

const ReplySchema = new Schema<IReply>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ReactionSchema = new Schema<IReaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
  },
  { _id: false }
);

const CommentSchema = new Schema<IComment>(
  {
    reviewId: { type: Schema.Types.ObjectId, ref: 'Review', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String },
    lineStart: { type: Number },
    lineEnd: { type: Number },
    pane: { type: String, enum: ['original', 'modified'] },
    body: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    replies: { type: [ReplySchema], default: [] },
    reactions: { type: [ReactionSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound index per spec
CommentSchema.index({ reviewId: 1, filename: 1, lineStart: 1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
