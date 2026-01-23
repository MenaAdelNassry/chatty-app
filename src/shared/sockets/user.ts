import { ILogin, ISocketData } from '@user/interfaces/user.interface';
import { Server, Socket } from 'socket.io';

export let socketIOUserObject: Server;

export const userSocketMap: Map<string, string> = new Map();
export const socketUserMap: Map<string, string> = new Map();

export class SocketIOUserHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    socketIOUserObject = io;
  }

  public listen(): void {
    this.io.on('connection', (socket: Socket) => {
      const { userId } = socket.data.user;
      socket.join(`user:${userId}`);
      console.log(`User ${userId} connected and joined room: user:${userId}`);

      socket.on('setup', (data: ILogin) => {
        this.addClient(data.userId, socket.id);
      });

      socket.on('disconnect', () => {
        this.removeClient(socket.id);
      });

      socket.on('block user', (data: ISocketData) => {
        this.io.emit('blocked user id', data);
      });

      socket.on('unblock user', (data: ISocketData) => {
        this.io.emit('unblocked user id', data);
      });
    });
  }

  private addClient(userId: string, socketId: string): void {
    userSocketMap.set(userId, socketId);
    socketUserMap.set(socketId, userId);

    this.emitOnlineUsers();
  }

  private removeClient(socketId: string): void {
    if (socketUserMap.has(socketId)) {
      const userId = socketUserMap.get(socketId)!;

      userSocketMap.delete(userId);
      socketUserMap.delete(socketId);

      this.emitOnlineUsers();
    }
  }

  private emitOnlineUsers(): void {
    const onlineUsers = Array.from(userSocketMap.keys());
    this.io.emit('user online', onlineUsers);
  }
}

// TODO: ⚠️ SCALABILITY ISSUE
// Storing users in a local 'Map' variable means this logic works ONLY on a single server instance.
// If we scale to multiple servers (Cluster Mode), users on Server A won't see users on Server B.
// FUTURE FIX: Use Redis Sets to store online users globally.

// TODO: ⚠️ MULTI-DEVICE LIMITATION
// Current logic restricts a user to a SINGLE socket connection.
// If a user opens the app on Phone + Desktop, the second connection might be ignored or overwrite the first.
// FUTURE FIX: Map value should be an Array of strings (string[]), not a single string.

// TODO: ⚠️ PERFORMANCE BOTTLENECK (Big O: O(N))
// 'Array.from' + '.find' iterates over ALL connected users.
// With 100k+ online users, a single disconnect could freeze the Event Loop temporarily.
// FUTURE FIX: Maintain a secondary 'Reverse Map' (SocketID -> UserID) for O(1) instant lookup & removal.
