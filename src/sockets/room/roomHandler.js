import chalk from "chalk";
import * as userManager from "../../services/socket/userManager.js";
import {
  getRecentMessages,
  getRecentPolls,
  deleteAllMessages,
  deleteAllPolls,
  getRaisedHands,
  deleteBanUserMessage,
} from "../../services/message/messageService.js";
import client from "../../configs/redis.js";
import {
  logMeetingEvent,
  updateMeetingEnd,
} from "../../services/log/meetingLog.js";
import { logParticipantLeave } from "../../services/log/participantsLog.js";
import {
  createLivekitToken,
  endLivekitRoom,
  removeUserLivekit,
} from "../../utils/livekit/livekit.js";
import {
  fetchSchedule,
  scheduleUpdate,
} from "../../services/schedule/schedule.js";
import {
  fetchParticipant,
  updateParticipant,
} from "../../services/participant/participant.js";
import {
  fetchOccurrence,
  updateOccurrence,
} from "../../services/schedule/scheduleOccurrences.js";
import mongoose from "mongoose";
import { formatRedisUserId } from "../../utils/redis/redis.js";
import { start } from "repl";
import { endMeetingService } from "../../services/meeting/meetingService.js";
import { scheduleJobAt } from "../../queues/bullmq/meetingQueue.js";


export default function registerRoomHandlers(socket, namespace) {
  // ------------------- JOIN ROOM -------------------
  socket.on("joinRoom", async (data) => {
    try {
      const { occurrenceId, scheduleId, platformId, userId, username } = data;
      // if (!occurrenceId || !scheduleId || !platformId || !userId) {
      //   socket.emit("error", {
      //     message:
      //       "Missing one or more of the required fields: occurrenceId, scheduleId, platformId or userId",
      //   });
      //   return;
      // }

      // if (!mongoose.Types.ObjectId.isValid(occurrenceId)) {
      //   socket.emit("error", {
      //     message: "Invalid occurrenceId, please check and try again.",
      //   });
      //   return;
      // }

      // const occurrence = await fetchOccurrence({
      //   scheduleId,
      //   platformId,
      //   occurrenceId: new mongoose.Types.ObjectId(`${occurrenceId}`),
      // });
      // console.log('occurrence', occurrence)

      // // Fetch schedule
      // if (!occurrence) {
      //   socket.emit("joinDenied", {
      //     code: "NOT_FOUND",
      //     reason: "Schedule occurrence not found",
      //   });
      //   return;
      // }
      // const now = new Date();

      // // //meeting should be in time betwen start to end
      // if (occurrence.endDateTime < now) {
      //   socket.emit("joinDenied", {
      //     code: "ENDED",
      //     reason: "Meeting already ended",
      //   });
      //   return;
      // }

      // if (occurrence.startDateTime > now) {
      //   socket.emit("joinDenied", {
      //     code: "NOT_STARTED",
      //     reason: "Meeting has not started yet",
      //   });
      //   return;
      // }

      // // Determine role
      // let effectiveRole = null;
      // let participantStatus = "active";
      // if (
      //   occurrence.hosts.find((host) => {
      //     return host.hostId === userId;
      //   })
      // ) {
      //   if (occurrence.hostId === userId) {
      //     effectiveRole = "host";
      //   } else {
      //     effectiveRole = "coHost";
      //   }
      // } else {
      //   const participant = await fetchParticipant({
      //     scheduleId: scheduleId,
      //     participantId: userId,
      //     platformId: platformId,
      //   });
      //   effectiveRole = participant?.role ?? null;

      //   participantStatus = participant?.status ?? "active";
      // }
      // // console.log(chalk.bgCyan(`participantStatus: ${participantStatus}`));
      // if (participantStatus !== "active") {
      //   socket.emit("joinDenied", {
      //     code: "NOT_ALLOWED",
      //     reason: `Participant status: ${participantStatus}`,
      //   });
      //   return;
      // }

      // if (!effectiveRole) {
      //   socket.emit("joinDenied", {
      //     code: "NOT_IN_SCHEDULE",
      //     reason: "Not allowed in this meeting.",
      //   });
      //   return;
      // }

      // data.role = effectiveRole;

      // // Lobby gate
      // if (occurrence.status === "scheduled") {
      //   // console.log(
      //   //   `Meeting with occurenceId: ${occurrenceId} is currently: `,
      //   //   occurrence.status
      //   // );
      //   // console.log("User's Effective role is:", effectiveRole);

      //   if (["host", "coHost"].includes(effectiveRole)) {
      //     const updatedOccurrence = await updateOccurrence({
      //       occurrenceId: occurrenceId,
      //       hostId: userId,
      //       platformId: occurrence.platformId,
      //       scheduleId: occurrence.scheduleId,
      //       data: { status: "live" },
      //     });

      //     const schedulePayload = {
      //         platformId: occurrence.platformId, 
      //         scheduleId: occurrence.scheduleId, 
      //         occurrenceId: occurrenceId.toString(),
      //         userId: occurrence.hostId
      //       }
          
      //     // console.log('schedule payload', schedulePayload)
          
      //     scheduleJobAt(updatedOccurrence.endDateTime, schedulePayload);

      //     // console.log(updatedOccurrence);
      //   } else {
      //     socket.emit("joinDenied", {
      //       code: "WAITING",
      //       reason: "Meeting not started yet. Please wait for host.",
      //     });
      //     return;
      //   }
      // }

      // if (["ended", "cancelled"].includes(occurrence.status)) {
      //   socket.emit("joinDenied", {
      //     code: "ROOM_CLOSED",
      //     reason: "Meeting not active",
      //   });
      //   return;
      // }

      //Sep 5 2025, needs update: occurrenceId logic <join, leave, kick, endRoom, poll, hand raise, chats, chatHistory> CAN BE MORE BUT THIS IS WHAT I REMEMBER..

      // Join room
      socket.join(occurrenceId);

      let activeParticipants = await userManager.getUsersByOccurrence(
        occurrenceId
      );
      activeParticipants = activeParticipants.map((p) => {
        return {
          scheduleId: p.rawId,
          platformId: p.platformId,
          occurrenceId: p.occurrenceId,
          userId: p.userId,
          username: p.username,
        };
      });
      socket.emit("active-participants", activeParticipants);

      await userManager.addUser(data, socket.id);
      socket.broadcast.to(occurrenceId).emit("new-participant", {
        platformId,
        scheduleId,
        occurrenceId,
        userId,
        username,
      });

      // Hydrate client state
      // const recent = await getRecentMessages(scheduleId, occurrenceId);
      // socket.emit("chatHistory", {
      //   messages: recent,
      //   hasMore: recent.length >= 50,
      //   oldestTimestamp: recent.length ? recent[0].timeStamp : null,
      // });
      // // console.log("recent", recent);
      // socket.emit(
      //   "pollHistory",
      //   await getRecentPolls(scheduleId, occurrenceId)
      // );
      // socket.emit(
      //   "handRaiseList",
      //   await getRaisedHands(scheduleId, occurrenceId)
      // );

      // Livekit auth
      const token = await createLivekitToken({
        occurrenceId,
        userId,
        role: "host",
        username,
        platformId: platformId,
      });

      const livekit_url = `${process.env.LIVEKIT_PROTOCOL ?? "ws"}://${process.env.LIVEKIT_HOST ?? "localhost"}:${process.env.LIVEKIT_PORT ?? "7880"}`
      socket.emit("livekit-auth", { url: livekit_url, token });

      // console.log(
      //   `✅ ${userId} joined ${occurrenceId} for schedule:${scheduleId} as ${effectiveRole}`
      // );
      // if (effectiveRole === "host") await logMeetingEvent(data);
    } catch (err) {
      console.error("Error in joinRoom:", err);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // ------------------- LEAVE ROOM -------------------
  socket.on("leaveRoom", async (data) => {
    const { scheduleId, occurrenceId, userId } = data;

    if (!scheduleId || !occurrenceId) {
      socket.emit("error", {
        message: "Missing required fields: scheduleId, occurrenceId",
      });
      return;
    }

    try {
      socket.leave(occurrenceId);
      await logParticipantLeave(data);
      await userManager.removeUser(undefined, socket.id);

      try {
        const result = await removeUserLivekit(occurrenceId, userId);
        // console.log(
        //   `✅ User ${userId} removed from LiveKit room ${occurrenceId}:${result}`
        // );
      } catch (livekitErr) {
        console.warn(
          `⚠️ Failed to remove user ${userId} from LiveKit: ${livekitErr.message}`
        );
      }
      namespace
        .to(occurrenceId)
        .emit("userLeft", { scheduleId, occurrenceId, userId });
      socket.emit("leaveSuccess", {
        success: true,
        message: `User ${userId} left occurrence ${occurrenceId}`,
      });
    } catch (error) {
      console.error("❌ Error in leaveRoom:", error);
      socket.emit("error", {
        message: error?.message ?? "Failed to leave room",
      });
    }
  });

  // ------------------- END ROOM -------------------
  socket.on("endRoom", async (data) => {
    await endMeetingService(data, namespace, socket)
  });

  // ------------------- KICK USER -------------------
  socket.on("kickUser", async (data) => {
    const {
      scheduleId,
      occurrenceId,
      platformId,
      userId,
      targetUserId,
      targetUsername,
    } = data;

    if (!scheduleId || !occurrenceId || !targetUserId) {
      socket.emit("error", {
        message:
          "Missing required fields: scheduleId, occurrenceId, targetUserId",
      });
      return;
    }

    try {
      // 1. Check if requester is host
      const occurrence = await fetchOccurrence({
        scheduleId,
        platformId,
        occurrenceId: new mongoose.Types.ObjectId(`${occurrenceId}`),
      });

      const isHost = occurrence.hosts.some((host) => host.hostId === userId);
      if (!isHost) {
        socket.emit("error", { message: "Only hosts can kick participants" });
        return;
      }

      // 2. Get target user
      const redisId = formatRedisUserId(occurrenceId, targetUserId, platformId);
      const targetUser = await userManager.getUserById(redisId);
      if (!targetUser) {
        socket.emit("error", { message: "Target user not found in room" });
        return;
      }

      // 3. Remove from userManager + LiveKit
      await userManager.removeUser(undefined, targetUser.socketId);
      await removeUserLivekit(occurrenceId, targetUser.rawId);

      // 4. Kick actual socket
      const targetSocket = namespace.sockets.get(targetUser.socketId);
      if (targetSocket) {
        targetSocket.leave(occurrenceId);
        targetSocket.emit("kicked", { reason: "Removed by host" });
      }

      namespace.to(occurrenceId).emit("userKicked", { targetUserId });

      // console.log(`✅ User ${targetUserId} was kicked from ${occurrenceId}`);
    } catch (err) {
      console.error("❌ Error in kickUser:", err);
      socket.emit("error", { message: "Failed to kick user" });
    }
  });
  socket.on("banUser", async (data) => {
    const { scheduleId, occurrenceId, platformId, userId, targetUserId } = data;

    if (!scheduleId || !occurrenceId || !targetUserId) {
      socket.emit("error", {
        message:
          "Missing required fields: scheduleId, occurrenceId, targetUserId",
        status: 400,
      });
      return;
    }

    try {
      const occurrence = await fetchOccurrence({
        scheduleId,
        platformId,
        occurrenceId: new mongoose.Types.ObjectId(`${occurrenceId}`),
      });

      if (!occurrence) {
        socket.emit("error", { message: "Occurrence not found", status: 404 });
        return;
      }

      const isHost = occurrence.hosts.some((host) => host.hostId === userId);
      if (!isHost) {
        socket.emit("error", {
          message: "Only hosts can ban participants",
          status: 403,
        });
        return;
      }

      const redisId = formatRedisUserId(occurrenceId, targetUserId, platformId);
      const targetUser = await userManager.getUserById(redisId);

      if (!targetUser) {
        socket.emit("error", {
          message: "Target user not found in room",
          status: 404,
        });
        return;
      }

      await userManager.removeUser(undefined, targetUser.socketId);
      await removeUserLivekit(occurrenceId, targetUser.rawId);

      const targetSocket = namespace.sockets.get(targetUser.socketId);
      if (targetSocket) {
        targetSocket.leave(occurrenceId);
        targetSocket.emit("banned", { reason: "Banned by host" });
      }

      await deleteBanUserMessage(targetUserId, scheduleId, occurrenceId);

      await updateParticipant(targetUserId, platformId, scheduleId, {
        status: "ban",
      });

      namespace.to(occurrenceId).emit("userBanned", { targetUserId });
      namespace.to(occurrenceId).emit("deleteMessage", { targetUserId });

      console.log(
        `✅ User ${targetUserId} was banned from occurrence ${occurrenceId}`
      );
    } catch (err) {
      console.error("❌ Error in banUser:", err);

      // Send safe error response to the requester
      socket.emit("error", {
        message: "Failed to ban user. Please try again later.",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
        status: 500,
      });
    }
  });
}
