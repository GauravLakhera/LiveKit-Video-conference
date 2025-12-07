import chalk from "chalk";

import * as userManager from "../../services/socket/userManager.js";
import pollModel from "../../models/message/poll.js";
import messageModel from "../../models/message/message.js";
import client from "../../configs/redis.js";
import { encrypt, decrypt } from "../../utils/message/encrypt.js";
import {
  saveMessageToRedis,
  saveWithRetry,
  savePollToRedis,
} from "../../services/message/messageService.js";
import { timeStamp } from "console";

const CHAT_MSG_RATE_MS = 300;
const CREATE_POLL_RATE_MS = 2000;
const lastMsgTimestamps = new Map();
const lastCreatePollTimestamps = new Map();

export default function registerChatHandlers(socket, namespace) {
  socket.on("chatMessage", async ({ scheduleId, occurrenceId, text }) => {
    try {
      const user = await userManager.getUserBySocketId(socket.id);
      if (!user) return socket.emit("error", { message: "User not found" });

      if (!scheduleId || typeof scheduleId !== "string") {
        return socket.emit("error", { message: "Invalid room ID" });
      }
      if (!text || !text.trim()) {
        return socket.emit("error", { message: "Message cannot be empty" });
      }
      if (text.length > 1000) {
        return socket.emit("error", {
          message: "Message too long. Max 1000 chars",
        });
      }
      const encryptText = encrypt(text);

      const lastSent = lastMsgTimestamps.get(user.userId) || 0;
      if (Date.now() - lastSent < CHAT_MSG_RATE_MS) {
        return socket.emit("error", {
          message: "You are sending messages too fast",
        });
      }
      lastMsgTimestamps.set(user.userId, Date.now());

      const now = Date.now();
      const d = new Date(now);
      const createdAtISO = d.toISOString();
      const msg = {
        scheduleId,
        occurrenceId,
        text: encryptText,
        createdAt: createdAtISO,
        timeStamp: now,
        senderId: user.rawId,
        senderName: user.username,
        meta: {
          userRole: user.role || null,
          platformId: user.platformId || null,
        },
      };

      try {
        await saveMessageToRedis(scheduleId, occurrenceId, msg);
      } catch (err) {
        console.error(chalk.yellow("Redis chat save failed:"), err);
      }
      msg.text = decrypt(msg.text);

      namespace.to(occurrenceId).emit("newChat", msg);

      socket.emit("messageAck", { tempId: msg.timeStamp, status: "delivered" });

      try {
        await messageModel.create({
          scheduleId,
          occurrenceId,
          timeStamp: now,
          senderId: user.rawId,
          senderName: user.username,
          text: encryptText,
          meta: msg.meta,
        });
      } catch (err) {
        console.error(chalk.red("Mongo save failed for chat message:"), err);
      }

      // console.log(
      //   chalk.cyan(`💬 Chat in ${occurrenceId}: ${user.username} -> ${text}`)
      // );
    } catch (err) {
      console.error(chalk.red("Error sending chat message:"), err);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on(
    "createPoll",
    async ({ scheduleId, occurrenceId, question, options }) => {
      try {
        const user = await userManager.getUserBySocketId(socket.id);
        if (!user) return socket.emit("error", { message: "User not found" });
        if (user.role !== "host")
          return socket.emit("error", {
            message: "Only host can create polls",
          });

        if (!scheduleId || typeof scheduleId !== "string") {
          return socket.emit("error", { message: "Invalid room ID" });
        }

        const lastCreate = lastCreatePollTimestamps.get(user.userId) || 0;
        if (Date.now() - lastCreate < CREATE_POLL_RATE_MS) {
          return socket.emit("error", {
            message: "Please wait before creating another poll",
          });
        }
        lastCreatePollTimestamps.set(user.userId, Date.now());

        if (!question || !String(question).trim()) {
          return socket.emit("error", { message: "Poll question is required" });
        }
        if (
          !Array.isArray(options) ||
          options.length < 2 ||
          options.length > 10
        ) {
          return socket.emit("error", {
            message: "Poll must have between 2 and 10 options",
          });
        }

        const pollDoc = new pollModel({
          scheduleId,
          occurrenceId,
          question: String(question).trim(),
          options: options.map((text) => ({ text, votes: 0 })),
          createdBy: user.rawId,
        });

        await saveWithRetry(() => pollDoc.save());

        const pollId = pollDoc._id.toString();

        try {
          await savePollToRedis(scheduleId, occurrenceId, {
            id: pollId,
            scheduleId,
            question: String(question).trim(),
            createdBy: user.username,
            createdAt: Date.now(),
            options: pollDoc.options.map((o) => ({
              text: o.text,
              votes: o.votes || 0,
            })),
            isActive: true,
          });
        } catch (err) {
          console.error(chalk.yellow("Redis savePollToRedis failed:"), err);
        }

        const event = {
          type: "pollCreated",
          id: pollId,
          scheduleId,
          occurrenceId,
          question: String(question).trim(),
          createdBy: user.username,
          createdAt: Date.now(),
          options: pollDoc.options.map((o) => ({ text: o.text, votes: 0 })),
          isActive: true,
        };

        namespace.to(occurrenceId).emit("pollEvent", event);
        socket.emit("createPollAck", { pollId, status: "created" });
        // console.log(
        //   chalk.green(
        //     `🗳 Poll created: ${pollId} by ${user.userId} in ${occurrenceId}`
        //   )
        // );
      } catch (err) {
        console.error(chalk.red("Error creating poll:"), err);
        socket.emit("error", { message: "Failed to create poll" });
      }
    }
  );

socket.on("votePoll", async ({ pollId, optionIndex }) => {
  try {
    const user = await userManager.getUserBySocketId(socket.id);
    if (!user) return socket.emit("error", { message: "User not found" });

    const userId = user.rawId;
    const pollKey = `poll:${pollId}`;
    const votedKey = `poll:${pollId}:votedUsers`;

    // 1) Load current poll state from Redis
    let pollData = await client.hGetAll(pollKey);

    // 2) If Redis cache empty, fallback to Mongo
    if (!pollData || Object.keys(pollData).length === 0) {
      const pollDoc = await pollModel.findById(pollId);
      if (!pollDoc) {
        return socket.emit("error", { message: "Poll not found" });
      }
      pollData = {
        isActive: pollDoc.isActive ? "true" : "false",
        question: pollDoc.question,
        scheduleId: pollDoc.scheduleId,
        occurrenceId: pollDoc.occurrenceId,
        createdBy: pollDoc.createdBy,
      };
    }

    // 3) Validate poll active
    const isActive =
      pollData.isActive === "true" || pollData.isActive === "1";
    if (!isActive) {
      return socket.emit("error", { message: "Poll is closed" });
    }

    // 4) Validate option exists
    if (typeof pollData[`option:${optionIndex}`] === "undefined") {
      return socket.emit("error", { message: "Invalid option" });
    }

    // 5) Prevent double vote
    const added = await client.sAdd(votedKey, userId);
    if (added === 0) {
      return socket.emit("error", { message: "You already voted" });
    }

    // 6) Increment chosen option atomically
    const votes = await client.hIncrBy(pollKey, `votes:${optionIndex}`, 1);

    // 7) Reload updated poll state
    const pollData2 = await client.hGetAll(pollKey);

    // 8) Rebuild options deterministically
    const optionEntries = Object.keys(pollData2)
      .filter((k) => k.startsWith("option:"))
      .map((k) => ({
        idx: parseInt(k.split(":")[1], 10),
        text: pollData2[k],
      }))
      .sort((a, b) => a.idx - b.idx);

    const formattedPoll = {
      type: "pollUpdate",
      id: pollId,
      scheduleId: pollData2.scheduleId || pollData.scheduleId,
      occurrenceId: pollData2.occurrenceId || pollData.occurrenceId,
      question: pollData2.question || pollData.question,
      createdBy: pollData2.createdBy || pollData.createdBy,
      createdAt: parseInt(pollData2.createdAt || "0", 10),
      isActive: pollData2.isActive === "true" || pollData2.isActive === "1",
      options: optionEntries.map(({ idx, text }) => ({
        text,
        votes: parseInt(pollData2[`votes:${idx}`] || "0", 10),
      })),
    };

    // 9) Broadcast update to room
    const roomId = formattedPoll.occurrenceId || user.occurrenceId;
    if (roomId) {
      namespace.to(roomId).emit("voteEvent", formattedPoll);
    }

    // 10) Ack the voter
    socket.emit("voteAck", { pollId, optionIndex, status: "ok", votes });

    // 11) Persist vote in Mongo
    saveWithRetry(() =>
      pollModel.findOneAndUpdate(
        { _id: pollId, "votedUsers.userId": { $ne: userId }, isActive: true },
        {
          $inc: { [`options.${optionIndex}.votes`]: 1 },
          $push: {
            votedUsers: {
              userId,
              username: user.username,
              optionIndex,
            },
          },
        },
        { new: true }
      )
    ).catch((err) =>
      console.error(chalk.red("Mongo update failed for vote:"), err)
    );
  } catch (err) {
    console.error(chalk.red("Error voting poll:"), err);
    socket.emit("error", { message: "Failed to cast vote" });
  }
});


  socket.on("raiseHand", async ({ scheduleId, occurrenceId }) => {
    try {
      const user = await userManager.getUserBySocketId(socket.id);
      if (!user) return socket.emit("error", { message: "User not found" });

      const key = `handraise:${scheduleId}:${occurrenceId}`;

      await client.zAdd(key, [{ score: Date.now(), value: user.userId }]);
      await client.expire(key, 10800);

      namespace.to(occurrenceId).emit("handEvent", {
        type: "handRaised",
        userId: user.rawId,
        username: user.username,
        scheduleId,
        occurrenceId,
      });

      socket.emit("handRaiseAck", { status: "raised" });
    } catch (err) {
      console.error("Error in raiseHand:", err);
      socket.emit("error", { message: "Failed to raise hand" });
    }
  });

  socket.on("lowerHand", async ({ scheduleId, occurrenceId }) => {
    try {
      const user = await userManager.getUserBySocketId(socket.id);
      // console.log("lower hand triggered", user);
      if (!user) return socket.emit("error", { message: "User not found" });

      const key = `handraise:${scheduleId}:${occurrenceId}`;

      await client.zRem(key, user.userId);
      await client.expire(key, 10800);

      namespace.to(occurrenceId).emit("handEvent", {
        type: "handLowered",
        userId: user.rawId,
        username: user.username,
        scheduleId,
        occurrenceId,
      });

      socket.emit("handLowerAck", { status: "lowered" });
    } catch (err) {
      console.error("Error in lowerHand:", err);
      socket.emit("error", { message: "Failed to lower hand" });
    }
  });


  socket.on("changePollStatus", async ({scheduleId, occurrenceId , pollId, isActive }) => {
    console.log("infi=>",scheduleId, occurrenceId , pollId, isActive )
    try {
      const user = await userManager.getUserBySocketId(socket.id);
      if (!user) return socket.emit("error", { message: "User not found" });


      if (user.role !== "host") {
        return socket.emit("error", { message: "Only host can update polls" });
      }


      const updatedPoll = await pollModel.findByIdAndUpdate(
        pollId,
        { $set: { isActive: isActive } },
        { new: true }
      );

      if (!updatedPoll) {
        return socket.emit("error", { message: "Poll not found" });
      }


      const pollKey = `poll:${pollId}`;
      try {
        await client.hSet(pollKey, "isActive", isActive ? "true" : "false");
      } catch (err) {
        console.error(chalk.yellow("Redis updatePoll failed:"), err);
      }

    
      socket.emit("PollStatusAck", {
        pollId,
        isActive,
        message:"status updated"
      });


      namespace.to(occurrenceId).emit("pollStatusUpdate", {
        pollId,
        isActive,
      });

    
      console.log(
        chalk.green(
          `🗳 Poll ${pollId} updated by host ${user.userId}, isActive=${isActive}`
        )
      );
    } catch (err) {
      console.error(chalk.red("Error updating poll:"), err);
      socket.emit("error", { message: "Failed to update poll" });
    }
  });
}