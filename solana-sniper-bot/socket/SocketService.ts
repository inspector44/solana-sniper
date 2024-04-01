import { Server as SocketIOServer, Socket } from "socket.io";

class SocketService {
  private io: SocketIOServer | null = null;

  public init(server: any): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
      }
    });
    this.io.on("connection", (socket: Socket) => {
      console.log(`New client connected: ${socket.id}`);

      socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  // Emit to all clients
  public emitToAll(eventName: string, data: any): void {
    if (!this.io) {
      console.warn("Socket.io not initialized!");
      return;
    }
    let res = this.io.emit(eventName, data);
  }
}

export const socketService = new SocketService();
