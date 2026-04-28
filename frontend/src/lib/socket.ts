import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let socketToken: string | undefined;

/**
 * Get or create a Socket.IO client instance.
 * Token is passed for server-side JWT validation.
 */
export const getSocket = (token?: string): Socket => {
  if (socket?.connected && socketToken === token) return socket;

  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = undefined;
  }

  socket = io(process.env.NEXT_PUBLIC_NODE_SERVER_URL || 'http://localhost:4000', {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });
  socketToken = token;

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = undefined;
  }
};

export { socket };
