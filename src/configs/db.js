import mongoose from "mongoose";
import dotenv from "dotenv";
import chalk from "chalk";
dotenv.config();

export const mongoConnect = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: "videoCalling",
        });
        console.log(chalk.bgGreen.bold("MongoDB connected successfully"));
    } catch (error) {
        console.log(
            error.message
                ? `MongoDB connection failed: ${error.message}`
                : `MongoDB connection failed`
        )
    }
};

export const mongoDisconnect = async () => {
  try {
    await mongoose.connection.close();
    console.log(chalk.bgBlue.bold("🔌 MongoDB disconnected"));
  } catch (error) {
    console.log(`⚠️ Error disconnecting MongoDB: ${error.message}`);
  }
};