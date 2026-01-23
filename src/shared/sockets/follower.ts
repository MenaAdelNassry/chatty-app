import { Server, Socket } from "socket.io";

export let socketIOFollowerObject: Server;

export class SocketIOFollowerHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    socketIOFollowerObject = io;
  }

  public listen(): void {
    // The Controller then uses 'socketIOFollowerObject.emit()' to broadcast updates to the UI.
    // This class strictly acts as the "Server-Side Socket Initializer".
    this.io.on("connection", (socket: Socket) => {
    });
  }
}
