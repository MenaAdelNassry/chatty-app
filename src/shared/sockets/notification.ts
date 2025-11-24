import { Server } from "socket.io";

export let socketIONotificationObject: Server;

export class SocketIONotificationHandler {
  public listen(io: Server): void {
    socketIONotificationObject = io;
  }
}
