import { Server, Socket } from 'socket.io';

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Client joins a review room
    socket.on('review:join', (reviewId: string) => {
      socket.join(reviewId);
      socket.to(reviewId).emit('reviewer:joined', {
        socketId: socket.id,
        reviewId,
      });
    });

    // Client leaves a review room
    socket.on('review:leave', (reviewId: string) => {
      socket.leave(reviewId);
      socket.to(reviewId).emit('reviewer:left', {
        socketId: socket.id,
        reviewId,
      });
    });

    // Typing indicator — broadcast to room
    socket.on('comment:typing', (data: { reviewId: string; username: string; isTyping: boolean }) => {
      socket.to(data.reviewId).emit('comment:typing', data);
    });

    // Cursor movement — broadcast to room
    socket.on('cursor:move', (data: { reviewId: string; filename: string; line: number; username: string }) => {
      socket.to(data.reviewId).emit('cursor:move', data);
    });

    // comment:deleted — server-to-client event; emitted by DELETE /api/comments/:id
    // after auth verification and DB deletion. No client-initiated handler needed.

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
