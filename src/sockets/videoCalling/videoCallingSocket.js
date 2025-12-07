import chalk from "chalk";
import registerChatHandlers from "../chat/chatHandlers.js";
import * as userManager from "../../services/socket/userManager.js";
import registerRoomHandlers from "../room/roomHandler.js";
import registerRecordingHandlers from "../recordings/recHandler.js";
import { authCheck } from "../../utils/authCheck.js";
import { createClient } from "redis";
import { endMeetingService } from "../../services/meeting/meetingService.js";

let videoCallingNamespace;

export function getVideoCallingNamespace() {
  return videoCallingNamespace;
}

export default function RegisterVideoCallingNamespace(io) {
  videoCallingNamespace = io.of("/video-calling");

  const redisUrl = process.env.REDIS_URL ?? "redis://default@127.0.0.1:6379";

  // 🚨 Subscribe to Redis when namespace is created
  const sub = createClient({ url: redisUrl });
  sub.connect().then(() => {
    console.log("📡 Subscribed to meeting-events channel");
    sub.subscribe("meeting-events", async (message) => {
      try {
        const event = JSON.parse(message);

        if (event.type === "meetingEnded") {
          console.log("📢 Broadcasting meeting-ended:", event);

          // Run cleanup + socket notifications
          await endMeetingService(event, videoCallingNamespace);
        }
        if (event.type === "meetingEndingSoon") {
          console.log("meeting will be end in 15 min");
          videoCallingNamespace.to(event.occurrenceId).emit("meetingEndSoon", {
            message: "meeting will be ended in 15 min ",
          });
        }
      } catch (err) {
        console.error("❌ Error handling meeting-events message:", err);
      }
    });
  });

  // Socket.io auth middleware
  videoCallingNamespace.use((socket, next) => {
    let token = socket.handshake.auth.token;

    if(!token) {
      const hdr = socket?.handshake?.headers?.authorization || socket?.request?.headers?.authorization;
      if (hdr && typeof hdr === 'string' && hdr.toLowerCase().startsWith('bearer ')) {
        token = hdr.slice(7);
      }
    }

    if(!token){
      const q = socket?.handshake?.query;
      if (q && typeof q.token === 'string') {
        token = q.token;
      }
    }

    if (token) {
      try {
        const decoded = authCheck(token);
        if (decoded) return next();
      } catch (err) {
        socket.emit("error", {
          message: "Authentication error: Invalid token",
        });
        console.error(
          chalk.redBright(`❌ Authentication error: Invalid token ${err}`)
        );
        return next(new Error("Authentication error: Invalid token"));
      }
    }
    socket.emit("error", {
      message: "Authentication error: No token provided",
    });
    console.error(
      chalk.redBright("❌ Authentication error: No token provided")
    );
    return next(new Error("Authentication error: No token provided"));
  });

  videoCallingNamespace.on("connection", (socket) => {
    console.log("User connected on /video-calling:", socket.id);

    registerRoomHandlers(socket, videoCallingNamespace);
    registerChatHandlers(socket, videoCallingNamespace);
    registerRecordingHandlers(socket, videoCallingNamespace);

    socket.on("disconnect", () => {
      userManager.removeUser(undefined, socket.id);
      console.log(
        chalk.redBright(`User left /video-calling with ID: ${socket.id}`)
      );
    });
  });
}
