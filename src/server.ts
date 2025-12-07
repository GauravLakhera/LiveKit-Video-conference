import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import chalk from "chalk";
// import redisClient from "./configs/redis.js";
import "dotenv/config";
import RegisterVideoCallingNamespace from "./sockets/videoCalling/videoCallingSocket.js";

import globalAuth from "./middlewares/globalAuth.js";
import generateTokenRoute from "./routes/generateToken.js";
import { mongoConnect } from "./configs/db.js";
import scheduleRouter from "./routes/schedule/schedule.js";
import logRouter from "./routes/log/logs.js"
import participantRoute from "./routes/participant/participant.js";
import messageRoute from "./routes/message/message.js"
import cors from 'cors'
import recordingRoute from "./routes/recording/recording.js";
import platformRoute from "./routes/platform/platform.js"
import adminRoute from "./routes/admin/admin.js"

import "./workers/bullmq/meetingWorker.js" //init bullmq worker
import "./workers/bullmq/meetingEndSoon.js"
import livekitRouter from "./routes/livekit/livekit.js";
// import "./queues/bullmq/meetingQueue.js" //init and run queue function for testing

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: "*", // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  // Include custom auth header used by Flutter client
  allowedHeaders: ['Content-Type', 'Authorization', 'authorization', 'X-Requested-With', 'x-auth-token', 'X-Auth-Token']
}

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (req, res) => {
	res.json({ message: "Video Calling API Server is running", status: "OK" });
});

app.use("/token", generateTokenRoute);
app.use("/livekit", livekitRouter)


app.use('/admin',adminRoute)
// app.use(globalAuth); //All APIs below this goes throught auth token middleware
app.use("/schedule", scheduleRouter)
app.use('/logs', logRouter)
app.use("/participant", participantRoute)
app.use("/messages", messageRoute)
app.use("/recordings", recordingRoute)
app.use('/platform',platformRoute)


app.use(express.static("public"));

const io = new Server(httpServer, {
  cors: corsOptions
});

// socket namespace registrations
RegisterVideoCallingNamespace(io); 

httpServer.listen(PORT, async () => {
  await mongoConnect()
  console.log(chalk.black.bgYellow(`Server Listening on PORT: ${PORT}`));
});
