# OpenReview

Real-time collaborative code review platform. Import any GitHub pull request and review diffs live with your team — comments, replies, and emoji reactions sync instantly across all participants.

## Features

- **GitHub OAuth login** — authenticate with your GitHub account
- **PR import** — import any public GitHub pull request by owner/repo/number
- **Monaco Editor** — VS Code-grade diff viewer with a custom dark theme (green/red diff colors)
- **Inline line comments** — select a line range in the diff and attach a comment to it; click a comment to jump back to the exact lines
- **Real-time collaboration** — comments appear instantly in all open tabs via WebSockets; active reviewer avatars shown in the header
- **Replies & reactions** — thread discussions with replies and emoji reactions (👍 👎 ❤️ 🚀 👀)
- **Resolve threads** — mark comment threads as resolved
- **Pin reviews** — pin important reviews to the top of the dashboard; pinned/all sections shown automatically
- **AI Review sidebar** — ask Claude about any file diff; resizable overlay panel (✨ Ask AI)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js 16 · TypeScript · Tailwind · Monaco)      │
│                                                             │
│  ┌──────────┐  ┌────────────────────────────────────────┐   │
│  │ /         │  │ /review/[id]                           │   │
│  │ Home      │  │ File tree | Monaco diff | Comments     │   │
│  │ PR import │  │           AI sidebar (overlay)         │   │
│  └──────────┘  └────────────────────────────────────────┘   │
│       │  REST (axios + JWT)          │  Socket.io            │
└───────┼─────────────────────────────┼───────────────────────┘
        │                             │
┌───────▼─────────────────────────────▼──────────────────────┐
│  Express · TypeScript · Socket.io (port 5001)              │
│                                                             │
│  Routes                          Socket Events             │
│  /api/auth/github  OAuth flow    review:join / leave        │
│  /api/reviews      CRUD          comment:new                │
│  /api/comments     Comments      comment:reply              │
│  /api/github/*     GH API proxy  comment:resolved           │
│  /api/ai/review    AI review     comment:reaction           │
│                                  comment:deleted            │
│                                  reviewer:joined/left       │
└───────────────────────────────────────┬─────────────────────┘
                                        │ Mongoose ODM
                                ┌───────▼──────┐
                                │  MongoDB 7   │
                                │              │
                                │  Users       │
                                │  Reviews     │
                                │    └ files[] │
                                │  Comments    │
                                │    ├ replies[]│
                                │    └ reactions│
                                └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4 |
| Code editor | Monaco Editor (`@monaco-editor/react`) |
| Real-time | Socket.io (WebSockets) |
| Backend | Express + TypeScript |
| Database | MongoDB 7 + Mongoose ODM |
| Auth | GitHub OAuth 2.0 + JWT (7-day) |
| External API | GitHub REST API (PR diffs), OpenAI API (AI review) |
| Container | Docker + Docker Compose |

## Quick Start

### Local development

**Prerequisites:** Node.js 20, MongoDB running on port 27017, GitHub OAuth app

1. Clone the repo:
   ```bash
   git clone https://github.com/satyahemanth17/openreview
   cd openreview
   ```

2. Create `backend/.env` with your secrets (see Environment Variables below).

3. Start the backend:
   ```bash
   cd backend
   npm install
   npm run dev         # ts-node-dev, port 5001
   ```

4. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev         # Next.js, port 3001
   ```

5. Open [http://localhost:3001](http://localhost:3001) and click **Login with GitHub**.

### Docker

```bash
# Create backend/.env with your secrets first, then:
docker compose up --build
```

Services start on: MongoDB → 27017, backend → 5001, frontend → 3001.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | Backend port (default `5001`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITHUB_CALLBACK_URL` | OAuth callback (`http://localhost:5001/api/auth/github/callback`) |
| `FRONTEND_URL` | Frontend origin for CORS (`http://localhost:3001`) |
| `OPENAI_API_KEY` | OpenAI API key for AI review feature |
| `GITHUB_TOKEN` | Optional PAT — used as fallback when user has no stored OAuth token |

See `backend/.env.example` for a template.

## GitHub OAuth Setup

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Set **Homepage URL** to `http://localhost:3001`
3. Set **Authorization callback URL** to `http://localhost:5001/api/auth/github/callback`
4. Copy **Client ID** and **Client Secret** into `backend/.env`

## MongoDB Schema

```
User       { githubId, username, email, avatarUrl, accessToken }
Review     { title, author→User, status, files[], reviewers[]→User }
  File     { filename, patch, additions, deletions }
Comment    { reviewId→Review, author→User, filename?, lineStart?, lineEnd?,
             pane?, body, resolved, replies[], reactions[] }
  Reply    { author→User, body, createdAt }
  Reaction { userId→User, emoji }
```

Compound index on `{ reviewId, filename, line }` for efficient inline comment lookups.

## Real-Time Protocol

```
Client → Server          Server → Client
──────────────────────   ─────────────────────────────
review:join(reviewId)    comment:new(comment)
review:leave(reviewId)   comment:reply(comment)
comment:typing(data)     comment:resolved(comment)
cursor:move(data)        comment:reaction(comment)
                         comment:deleted({ commentId })
                         reviewer:joined({ username })
                         reviewer:left({ username })
```

## Validation

```bash
# Backend TypeScript
cd backend && npx tsc --noEmit

# Frontend TypeScript + production build
cd frontend && npx tsc --noEmit && npm run build

# Docker config
docker compose config
docker compose up --build
curl http://localhost:5001/health
```
