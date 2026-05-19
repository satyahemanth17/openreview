import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { authenticateToken } from '../middleware/auth';
import { Review } from '../models/Review';

const router = Router();

let io: Server | null = null;
export function setIO(ioInstance: Server): void { io = ioInstance; }

// All routes require auth
router.use(authenticateToken);

// GET / — list all reviews with author populated
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const reviews = await Review.find()
      .populate('author', 'username avatarUrl')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST / — create new review
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, prUrl, prNumber, repoOwner, repoName, files } = req.body as {
      title: string;
      description?: string;
      prUrl?: string;
      prNumber?: number;
      repoOwner?: string;
      repoName?: string;
      files?: Array<{ filename: string; patch: string; additions: number; deletions: number }>;
    };

    const authorId = req.user?._id ?? req.user?.id;

    const review = await Review.create({
      title,
      description,
      author: authorId,
      prUrl,
      prNumber,
      repoOwner,
      repoName,
      files: files ?? [],
    });

    const populated = await review.populate('author', 'username avatarUrl');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// GET /:id — get review by id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('author', 'username avatarUrl email')
      .populate('reviewers', 'username avatarUrl');

    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// PUT /:id — update review
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, status } = req.body as {
      title?: string;
      description?: string;
      status?: 'open' | 'closed' | 'merged';
    };

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { title, description, status },
      { new: true, runValidators: true }
    )
      .populate('author', 'username avatarUrl')
      .populate('reviewers', 'username avatarUrl');

    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// DELETE /:id — delete review (only author)
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    const userId = req.user?._id ?? req.user?.id;
    if (review.author.toString() !== userId) {
      res.status(403).json({ error: 'Only the author can delete this review' });
      return;
    }

    await review.deleteOne();
    io?.emit('review:deleted', { reviewId: req.params.id });
    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// PATCH /:id/pin — toggle pinned state
router.patch('/:id/pin', async (req: Request, res: Response): Promise<void> => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    review.pinned = !review.pinned;
    await review.save();

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle pin' });
  }
});

// POST /:id/reviewers — add reviewer
router.post('/:id/reviewers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body as { userId: string };

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { reviewers: userId } },
      { new: true }
    )
      .populate('author', 'username avatarUrl')
      .populate('reviewers', 'username avatarUrl');

    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add reviewer' });
  }
});

export default router;
