import mongoose from "mongoose";
import { config } from "@root/config";
import Logger from "bunyan";
import { redisConnection } from "@service/redis/redis.connection";

const log: Logger = config.createLogger("setupDatabase");

export default () => {
    const connect = async () => {
        try {
            await mongoose.connect(config.DATABASE_URL!);
            log.info("Successfully to connected to database.");
            redisConnection.connect();
        } catch(err) {
            log.error("Error connecting to database: ", err);
            return process.exit(1);
        }
    }

    connect();
    mongoose.connection.on("disconnect", connect);
}
