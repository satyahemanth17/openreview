import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const router = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const CALLBACK_URL = 'http://localhost:5001/api/auth/github/callback';

// GET /api/auth/github — redirect to GitHub OAuth
router.get('/github', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: 'read:user user:email repo',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// GET /api/auth/github/callback — OAuth callback
router.get('/github/callback', async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;

  if (!code) {
    res.status(400).json({ error: 'No code provided' });
    return;
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: CALLBACK_URL,
      },
      { headers: { Accept: 'application/json' } }
    );

    const accessToken: string = tokenResponse.data.access_token;

    if (!accessToken) {
      res.status(400).json({ error: 'Failed to obtain access token' });
      return;
    }

    // Get GitHub user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    const githubUser = userResponse.data as {
      id: number;
      login: string;
      email: string | null;
      avatar_url: string;
    };

    // Upsert user in DB
    const user = await User.findOneAndUpdate(
      { githubId: String(githubUser.id) },
      {
        githubId: String(githubUser.id),
        username: githubUser.login,
        email: githubUser.email ?? undefined,
        avatarUrl: githubUser.avatar_url,
        accessToken,
      },
      { upsert: true, new: true }
    );

    // Sign JWT
    const token = jwt.sign(
      {
        _id: user._id,
        id: user._id,
        githubId: user.githubId,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
