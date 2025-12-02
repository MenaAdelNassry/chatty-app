import { ISenderReceiver } from '@chat/interfaces/message.interface';
import { Server, Socket } from 'socket.io';
import { userSocketMap } from '@socket/user';

export let socketIOChatObject: Server;

export class SocketIOChatHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    socketIOChatObject = io;
  }

  public listen(): void {
    this.io.on('connection', (socket: Socket) => {

      socket.on('join room', (users: ISenderReceiver) => {
        const { senderId, receiverId } = users;

        const senderSocketId = userSocketMap.get(senderId);
        const receiverSocketId = userSocketMap.get(receiverId);

        if (senderSocketId) socket.join(senderSocketId);
        if (receiverSocketId) socket.join(receiverSocketId);
      });

    });
  }
}
