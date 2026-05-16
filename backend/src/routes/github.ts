import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth';
import { User } from '../models/User';

const router = Router();

// All routes require auth
router.use(authenticateToken);

const GITHUB_API = 'https://api.github.com';

async function getAccessToken(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const user = await User.findById(userId);
  return user?.accessToken ?? null;
}

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// GET /api/github/repos — list user's GitHub repos
router.get('/repos', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id ?? req.user?.id;
    const token = await getAccessToken(userId);

    if (!token) {
      res.status(401).json({ error: 'No GitHub access token found' });
      return;
    }

    const response = await axios.get(`${GITHUB_API}/user/repos`, {
      headers: githubHeaders(token),
      params: { sort: 'updated', per_page: 100 },
    });

    res.json(response.data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch repos' });
  }
});

// GET /api/github/repos/:owner/:repo/pulls — list open PRs
router.get('/repos/:owner/:repo/pulls', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id ?? req.user?.id;
    const token = await getAccessToken(userId);

    if (!token) {
      res.status(401).json({ error: 'No GitHub access token found' });
      return;
    }

    const { owner, repo } = req.params;
    const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, {
      headers: githubHeaders(token),
      params: { state: 'open', per_page: 50 },
    });

    res.json(response.data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch pull requests' });
  }
});

// GET /api/github/repos/:owner/:repo/pulls/:number — get single PR
router.get('/repos/:owner/:repo/pulls/:number', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id ?? req.user?.id;
    const token = await getAccessToken(userId);

    if (!token) {
      res.status(401).json({ error: 'No GitHub access token found' });
      return;
    }

    const { owner, repo, number } = req.params;
    const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}`, {
      headers: githubHeaders(token),
    });

    res.json(response.data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch pull request' });
  }
});

// GET /api/github/repos/:owner/:repo/pulls/:number/files — get PR file diffs
router.get('/repos/:owner/:repo/pulls/:number/files', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id ?? req.user?.id;
    const token = await getAccessToken(userId);

    if (!token) {
      res.status(401).json({ error: 'No GitHub access token found' });
      return;
    }

    const { owner, repo, number } = req.params;
    const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}/files`, {
      headers: githubHeaders(token),
      params: { per_page: 100 },
    });

    res.json(response.data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch PR files' });
  }
});

export default router;
