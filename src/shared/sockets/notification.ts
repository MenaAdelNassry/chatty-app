import { Server, Socket } from "socket.io";
import Logger from 'bunyan';
import { config } from '@root/config';

export let socketIONotificationObject: SocketIONotificationHandler;
const log: Logger = config.createLogger('notificationSocket');

export class SocketIONotificationHandler {
  private io!: Server;

  public listen(io: Server): void {
    this.io = io;
    socketIONotificationObject = this;

    this.io.on("connection", (socket: Socket) => {
      const user = socket.data.user;

      if(user && user.userId) {
        socket.join(user.userId);
        log.info(`User ${user.username} joined room: ${user.userId}`);
      }
    });
  }

  public emit(event: string, data: any, options?: { userTo: string }): void {
    if(options?.userTo) {
      this.io.to(options.userTo).emit(event, data);
    } else {
      this.io.emit(event, data);
    }
  }
}
