# OpenReview

Real-time collaborative code review platform. Import any GitHub pull request and review diffs live with your team — comments, replies, and emoji reactions sync instantly across all participants.

## Features

- **GitHub OAuth login** — authenticate with your GitHub account
- **PR import** — import any public GitHub pull request by owner/repo/number
- **Monaco Editor** — VS Code-grade diff viewer for changed files
- **Real-time collaboration** — comments appear instantly in all open tabs via WebSockets
- **Inline comments** — attach comments to specific files
- **Replies & reactions** — thread discussions with replies and emoji reactions (👍 👎 ❤️ 🚀 👀)
- **Resolve threads** — mark comment threads as resolved

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js 16 · TypeScript · Tailwind · Monaco)      │
│                                                             │
│  ┌──────────┐  ┌────────────────┐  ┌───────────────────┐   │
│  │ /         │  │ /review/[id]   │  │ /auth/callback    │   │
│  │ Home      │  │ Monaco Editor  │  │ JWT storage       │   │
│  │ PR import │  │ 3-panel layout │  └───────────────────┘   │
│  └──────────┘  └────────────────┘                           │
│       │  REST (axios + JWT)          │  Socket.io           │
└───────┼─────────────────────────────┼──────────────────────┘
        │                             │
┌───────▼─────────────────────────────▼──────────────────────┐
│  Express · TypeScript · Socket.io (port 5001)              │
│                                                             │
│  Routes                          Socket Events             │
│  /api/auth/github  OAuth flow    review:join / leave        │
│  /api/reviews      CRUD          comment:new                │
│  /api/comments     Comments      comment:reply              │
│  /api/github/*     GH API proxy  comment:resolved           │
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
| External API | GitHub REST API (PR diffs) |
| Container | Docker + Docker Compose |

## Quick Start

### Local development

**Prerequisites:** Node.js 20, MongoDB running on port 27017, GitHub OAuth app

1. Clone and set up environment:
   ```bash
   git clone https://github.com/satyahemanth17/openreview
   cd openreview
   ```
   Create `.env` in the project root with your secrets (see Environment Variables below).

2. Start the backend:
   ```bash
   cd backend
   npm install
   npm run dev         # ts-node-dev, port 5001
   ```

3. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev         # Next.js, port 3000
   ```

4. Open [http://localhost:3000](http://localhost:3000) and click **Login with GitHub**.

### Docker

```bash
# Create .env with your secrets first, then:
docker compose up --build
```

Services start on: MongoDB → 27017, backend → 5001, frontend → 3000.

## Environment Variables

### Backend (`.env` in project root)
| Variable | Description |
|----------|-------------|
| `PORT` | Backend port (default 5001) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |

### Frontend (`frontend/.env.local`)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL (default `http://localhost:5001`) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.io server URL (same as API) |

## GitHub OAuth Setup

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Set **Homepage URL** to `http://localhost:3000`
3. Set **Authorization callback URL** to `http://localhost:5001/api/auth/github/callback`
4. Copy **Client ID** and **Client Secret** into your `.env`

## MongoDB Schema

```
User       { githubId, username, email, avatarUrl, accessToken }
Review     { title, author→User, status, files[], reviewers[]→User }
  File     { filename, patch, additions, deletions }
Comment    { reviewId→Review, author→User, filename?, line?, body,
             resolved, replies[], reactions[] }
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
cursor:move(data)        reviewer:joined({ username })
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
