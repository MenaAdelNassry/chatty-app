import { Server } from "socket.io";

export let socketIOImageObject: Server;

export class SocketIOImageHandler {
  public listen(io: Server): void {
    socketIOImageObject = io;
  }
}
