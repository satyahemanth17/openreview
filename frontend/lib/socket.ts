import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001', {
      auth: { token },
      autoConnect: true,
    });
  }
  return socket;
}

export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function joinReview(reviewId: string): void {
  getSocket().emit('review:join', reviewId);
}

export function leaveReview(reviewId: string): void {
  getSocket().emit('review:leave', reviewId);
}
