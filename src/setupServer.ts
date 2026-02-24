import { BadRequestError, CustomError, IErrorResponse } from '@global/helpers/error-handler';
import { Application, json, urlencoded, Response, Request, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import cookieSession from 'cookie-session';
import HTTP_STATUS from 'http-status-codes';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import 'express-async-errors';
import { config } from '@root/config';
import applicationRoutes from '@root/routes';
import Logger from 'bunyan';
import { SocketIOPostHandler } from '@socket/post';
import { SocketIOFollowerHandler } from '@socket/follower';
import { SocketIOUserHandler } from '@socket/user';
import { SocketIONotificationHandler } from '@socket/notification';
import { SocketIOImageHandler } from '@socket/image';
import { SocketIOChatHandler } from '@socket/chat';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { SocialStrategy } from '@auth/strategies/google.strategy';

const SERVER_PORT = process.env.PORT || 5000;
const log: Logger = config.createLogger('setupServer');

export class ChattyServer {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public start(): void {
    this.securityMiddleware(this.app);
    this.standardMiddleware(this.app);
    this.routesMiddleware(this.app);
    this.globalErrorHandler(this.app);
    this.startServer(this.app);
  }

  private securityMiddleware(app: Application): void {
    app.set('trust proxy', 1);

    /* -------- Cookie Session --------  */
    app.use(
      cookieSession({
        name: 'session',
        keys: [config.SECRET_KEY_ONE!, config.SECRET_KEY_TWO!],
        // maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Days
        secure: config.NODE_ENV !== 'development',
        sameSite: 'none'
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    new SocialStrategy().google();

    /* -------- Helmet --------  */
    app.use(helmet({ contentSecurityPolicy: false }));

    /* -------- Cors --------  */
    app.use(
      cors({
        origin: config.CLIENT_URL,
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS']
      })
    );
  }

  private standardMiddleware(app: Application): void {
    /* -------- Compression --------  */
    app.use(compression());

    /* -------- Parsing --------  */
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));

    /* -------- Hpp --------  */
    // app.use(hpp);
  }

  private routesMiddleware(app: Application): void {
    applicationRoutes(app);
  }

  private globalErrorHandler(app: Application): void {
    app.all('*', (req: Request, res: Response, next: NextFunction) => {
      res.status(HTTP_STATUS.NOT_FOUND).json({ message: `${req.originalUrl} is not found` });
    });

    app.use((error: IErrorResponse, req: Request, res: Response, next: NextFunction) => {
      console.log(error);
      if (error instanceof CustomError) {
        res.status(error.statusCode).json(error.serializeErrors());
        return;
      }
      next();
    });
  }

  private async startServer(app: Application): Promise<void> {
    try {
      const httpServer: http.Server = new http.Server(app);
      const socketIO: Server = await this.createSocketIO(httpServer);
      this.startHttpServer(httpServer);
      this.socketIOConnections(socketIO);
    } catch (err) {
      log.error(err);
    }
  }

  private async createSocketIO(httpServer: http.Server): Promise<Server> {
    const io: Server = new Server(httpServer, {
      cors: {
        origin: config.CLIENT_URL,
        methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS']
      }
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) return next(new BadRequestError('Not authorized. No token provided.'));
      try {
        const payload = jwt.verify(token, config.JWT_TOKEN!);
        socket.data.user = payload;
        next();
      } catch (error) {
        return next(new BadRequestError('Not authorized. Invalid token.'));
      }
    });

    const pubClient = createClient({ url: config.REDIS_HOST });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    return io;
  }

  private startHttpServer(httpServer: http.Server): void {
    log.info(`Server has started with process ${process.pid}`);
    const hostName = config.NODE_ENV === 'development' ? 'localhost': '0.0.0.0';

    httpServer.listen(Number(SERVER_PORT), hostName, () => {
      log.info(`Server is running on ${hostName}:${SERVER_PORT}`);
    });
  }

  private socketIOConnections(io: Server): void {
    const postSocketHandler: SocketIOPostHandler = new SocketIOPostHandler(io);
    const followerSocketHandler: SocketIOFollowerHandler = new SocketIOFollowerHandler(io);
    const userSocketHandler: SocketIOUserHandler = new SocketIOUserHandler(io);
    const chatSocketHandler: SocketIOChatHandler = new SocketIOChatHandler(io);
    const notificationSocketHandler: SocketIONotificationHandler = new SocketIONotificationHandler();
    const imageSocketHandler: SocketIOImageHandler = new SocketIOImageHandler();

    postSocketHandler.listen();
    followerSocketHandler.listen();
    userSocketHandler.listen();
    chatSocketHandler.listen();
    notificationSocketHandler.listen(io);
    imageSocketHandler.listen(io);
  }
}
