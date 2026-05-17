import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { authenticateToken } from '../middleware/auth';
import { Comment } from '../models/Comment';

const router = Router();

// Module-level io instance — set from app.ts after socket setup
let io: Server | null = null;

export function setIO(ioInstance: Server): void {
  io = ioInstance;
}

// All routes require auth
router.use(authenticateToken);

// GET /review/:reviewId — get all comments for a review
router.get('/review/:reviewId', async (req: Request, res: Response): Promise<void> => {
  try {
    const comments = await Comment.find({ reviewId: req.params.reviewId })
      .populate('author', 'username avatarUrl')
      .populate('replies.author', 'username avatarUrl')
      .sort({ createdAt: 1 });
    res.json(comments);
  } catch {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /review/:reviewId — create new comment
router.post('/review/:reviewId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename, line, body } = req.body as {
      filename?: string;
      line?: number;
      body: string;
    };

    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const authorId = req.user._id ?? req.user.id;

    const comment = new Comment({
      reviewId: req.params.reviewId,
      author: authorId,
      filename,
      line,
      body,
    });
    await comment.save();

    const populated = await comment.populate('author', 'username avatarUrl');

    // Emit real-time event
    if (io) {
      io.to(req.params.reviewId).emit('comment:new', populated);
    }

    res.status(201).json(populated);
  } catch {
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PUT /:id/resolve — toggle resolved
router.put('/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    comment.resolved = !comment.resolved;
    await comment.save();

    const populated = await comment.populate('author', 'username avatarUrl');

    if (io) {
      io.to(comment.reviewId.toString()).emit('comment:resolved', populated);
    }

    res.json(populated);
  } catch {
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

// POST /:id/reply — add reply to comment
router.post('/:id/reply', async (req: Request, res: Response): Promise<void> => {
  try {
    const { body } = req.body as { body: string };
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const authorId = req.user._id ?? req.user.id;

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    comment.replies.push({
      author: authorId,
      body,
      createdAt: new Date(),
    });

    await comment.save();

    const populated = await comment
      .populate('author', 'username avatarUrl')
      .then((c) => c.populate('replies.author', 'username avatarUrl'));

    if (io) {
      io.to(comment.reviewId.toString()).emit('comment:reply', populated);
    }

    res.status(201).json(populated);
  } catch {
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

// POST /:id/reactions — add or remove reaction
router.post('/:id/reactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { emoji } = req.body as { emoji: string };
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const userId = req.user._id ?? req.user.id;

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Toggle reaction: remove if exists, add if not
    const existingIdx = comment.reactions.findIndex(
      (r) => r.userId.toString() === userId && r.emoji === emoji
    );

    if (existingIdx >= 0) {
      comment.reactions.splice(existingIdx, 1);
    } else {
      comment.reactions.push({ userId, emoji });
    }

    await comment.save();

    const populated = await comment
      .populate('author', 'username avatarUrl')
      .then((c) => c.populate('replies.author', 'username avatarUrl'));

    if (io) {
      io.to(comment.reviewId.toString()).emit('comment:reaction', populated);
    }

    res.json(populated);
  } catch {
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});

export default router;
