import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ReviewFile {
  filename: string;
  patch: string;
  additions: number;
  deletions: number;
}

export interface Author {
  _id: string;
  username: string;
  avatarUrl: string;
}

export interface Reply {
  author: Author;
  body: string;
  createdAt: string;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface Comment {
  _id: string;
  reviewId: string;
  author: Author;
  filename?: string;
  line?: number;
  body: string;
  resolved: boolean;
  replies: Reply[];
  reactions: Reaction[];
  createdAt: string;
}

export interface Review {
  _id: string;
  title: string;
  author: Author;
  status: 'open' | 'closed' | 'merged';
  files: ReviewFile[];
  reviewers: Author[];
  createdAt: string;
}

export interface GithubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export const getReviews = () => api.get<Review[]>('/api/reviews').then((r) => r.data);
export const getReview = (id: string) => api.get<Review>(`/api/reviews/${id}`).then((r) => r.data);
export const createReview = (data: { title: string; files: ReviewFile[] }) =>
  api.post<Review>('/api/reviews', data).then((r) => r.data);
export const getComments = (reviewId: string) =>
  api.get<Comment[]>(`/api/comments/review/${reviewId}`).then((r) => r.data);
export const createComment = (reviewId: string, data: { filename?: string; line?: number; body: string }) =>
  api.post<Comment>(`/api/comments/review/${reviewId}`, data).then((r) => r.data);
export const resolveComment = (commentId: string) =>
  api.put<Comment>(`/api/comments/${commentId}/resolve`).then((r) => r.data);
export const addReply = (commentId: string, body: string) =>
  api.post<Comment>(`/api/comments/${commentId}/reply`, { body }).then((r) => r.data);
export const addReaction = (commentId: string, emoji: string) =>
  api.post<Comment>(`/api/comments/${commentId}/reactions`, { emoji }).then((r) => r.data);
export const getPRDetails = (owner: string, repo: string, number: string) =>
  api.get<{ title: string; number: number }>(`/api/github/repos/${owner}/${repo}/pulls/${number}`).then((r) => r.data);
export const getPRFiles = (owner: string, repo: string, number: string) =>
  api.get<GithubFile[]>(`/api/github/repos/${owner}/${repo}/pulls/${number}/files`).then((r) => r.data);
