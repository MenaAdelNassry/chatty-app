import mongoose from "mongoose";
import { config } from "./config";
import Logger from "bunyan";

const log: Logger = config.createLogger("setupDatabase");

export default () => {
    const connect = async () => {
        try {
            await mongoose.connect(config.DATABASE_URL!);
            log.info("Successfully to connected to database.");
        } catch(err) {
            log.error("Error connecting to database: ", err);
            return process.exit(1);
        }
    }

    connect();
    mongoose.connection.on("disconnect", connect);
}