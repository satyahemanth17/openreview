import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require auth
router.use(authenticateToken);

// Fix 3: Move OPENAI_API_KEY to module scope
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const DEFAULT_PROMPT =
  'Review this code diff. Explain what changed, identify any bugs or issues, and suggest improvements. Be concise and specific.';

// POST /api/ai/review — get AI review for a code diff
router.post('/review', async (req: Request, res: Response): Promise<void> => {
  if (!OPENAI_API_KEY) {
    res.status(500).json({ error: 'OpenAI API key not configured' });
    return;
  }

  try {
    const { filename, patch, question } = req.body as {
      filename: string;
      patch: string;
      question?: string;
    };

    // Fix 2: Input validation for filename and patch
    if (!filename || !patch) {
      res.status(400).json({ error: 'filename and patch are required' });
      return;
    }

    const reviewQuestion = question || DEFAULT_PROMPT;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer. Analyze git diffs and provide clear, actionable feedback.',
          },
          {
            role: 'user',
            content: `File: ${filename}\n\nDiff:\n${patch}\n\nQuestion: ${reviewQuestion}`,
          },
        ],
      }),
    });

    // Fix 1: Check response.ok before parsing (Fix 5: typed error body, no `any`)
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[ai] OpenAI error:', response.status, errData);
      res.status(502).json({ error: 'AI service error', detail: (errData as { error?: { message?: string } })?.error?.message });
      return;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    // Fix 4: Guard against empty choices array
    const review = data.choices?.[0]?.message?.content;
    if (!review) {
      res.status(502).json({ error: 'No response from AI' });
      return;
    }
    res.json({ review });
  } catch (err) {
    console.error('[ai] POST /review error:', err);
    res.status(500).json({ error: 'Failed to get AI review' });
  }
});

export default router;
