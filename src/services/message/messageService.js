import messageModel from "../../models/message/message.js";
import pollModel from "../../models/message/poll.js";
import client from "../../configs/redis.js";
import chalk from "chalk";
import { decrypt } from "../../utils/message/encrypt.js";
import * as userManager from "../../services/socket/userManager.js";
import mongoose from "mongoose";

export async function saveMessageToRedis(scheduleId, occurrenceId, message) {
  try {
    const key = `room:${scheduleId}:${occurrenceId}:messages`;

    await client.lPush(key, JSON.stringify(message));
    await client.lTrim(key, 0, 49);
    await client.expire(key, 9000);
  } catch (error) {
    console.error(chalk.red("❌ Failed to save message to Redis:"), error);
  }
}

export async function savePollToRedis(scheduleId, occurrenceId, poll) {
  if (!poll?.id) throw new Error("Poll ID is missing"); // [12]

  const pollKey = `poll:${poll.id}`;
  const listKey = `room:${scheduleId}:${occurrenceId}:polls`;

  const options = Array.isArray(poll.options) ? poll.options : []; // [12]

  const hashData = {
    scheduleId: String(scheduleId),
    occurrenceId: String(occurrenceId ?? ""), // include occurrenceId
    question: String(poll.question || ""),
    createdBy: String(poll.createdBy || ""),
    createdAt: String(poll.createdAt || Date.now()),
    isActive: "true",
    optionCount: String(options.length || 0),
  }; // [12]

  options.forEach((opt, idx) => {
    hashData[`option:${idx}`] = String(opt?.text || "");
    hashData[`votes:${idx}`] = String(opt?.votes ?? 0);
  }); // [12]

  try {
    const multi = client.multi();
    multi.hSet(pollKey, hashData);
    multi.expire(pollKey, 10800);
    multi.lRem(listKey, 0, String(poll.id));
    multi.lPush(listKey, String(poll.id));
    multi.lTrim(listKey, 0, 19);
    multi.expire(listKey, 10800);
    await multi.exec();
  } catch (err) {
    console.error("❌ Failed to save poll to Redis:", err);
  }
}

export async function getRecentPolls(scheduleId, occurrenceId) {
  try {
    const listKey = `room:${scheduleId}:${occurrenceId}:polls`;
    const pollIds = await client.lRange(listKey, 0, 19);

    const polls = [];
    for (const pollId of pollIds) {
      const pollKey = `poll:${pollId}`;
      const data = await client.hGetAll(pollKey);
      if (data && Object.keys(data).length > 0) {
        // Option A: robust slice-based index extraction
        const optionEntries = Object.keys(data)
          .filter((k) => k.startsWith("option:"))
          .map((k) => {
            const idx = Number.parseInt(k.slice(7), 10); // after "option:"
            return Number.isFinite(idx) ? { idx, text: data[k] } : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.idx - b.idx);

        // Option B: regex-based (correct capture index is [2])
        // const optionEntries = Object.keys(data)
        //   .filter((k) => k.startsWith("option:"))
        //   .map((k) => {
        //     const m = /^option:(\d+)$/.exec(k);
        //     if (!m) return null;
        //     const idx = Number(m[2]);
        //     return Number.isFinite(idx) ? { idx, text: data[k] } : null;
        //   })
        //   .filter(Boolean)
        //   .sort((a, b) => a.idx - b.idx);

        const options = optionEntries.map(({ idx, text }) => ({
          text,
          votes: parseInt(data[`votes:${idx}`] || "0", 10),
        }));

        polls.push({
          id: pollId,
          scheduleId: data.scheduleId,
          occurrenceId: data.occurrenceId || occurrenceId || null,
          question: data.question,
          createdBy: data.createdBy,
          createdAt: parseInt(data.createdAt || "0", 10),
          isActive: data.isActive === "true" || data.isActive === "1",
          options,
        });
      }
    }
    return polls;
  } catch (err) {
    console.error("❌ Failed to fetch polls from Redis:", err);
    return [];
  }
}

export async function getPollDetailsService(pollId) {
  if (!mongoose.Types.ObjectId.isValid(pollId)) {
    throw new Error("Invalid pollId");
  }

  const poll = await pollModel.findById(pollId);
  if (!poll) {
    throw new Error("Poll not found");
  }

  // Group voters by optionIndex
  const optionVoters = {};
  poll.votedUsers.forEach((vote) => {
    if (!optionVoters[vote.optionIndex]) optionVoters[vote.optionIndex] = [];
    optionVoters[vote.optionIndex].push({
      userId: vote.userId,
      username: vote.username,
    });
  });

  return {
    id: poll._id.toString(),
    scheduleId: poll.scheduleId,
    occurrenceId: poll.occurrenceId?.toString() || null,
    question: poll.question,
    createdBy: poll.createdBy,
    isActive: poll.isActive,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
    options: poll.options.map((opt, idx) => ({
      index: idx,
      text: opt.text,
      votes: opt.votes,
      voters: optionVoters[idx] || [],
    })),
  };
}

export async function getRecentMessages(scheduleId, occurrenceId) {
  try {
    const key = `room:${scheduleId}:${occurrenceId}:messages`;
    const messages = await client.lRange(key, 0, -1);

    const parsedMessages = messages
      .map((m) => {
        try {
          const msg = JSON.parse(m);

          if (msg.text) {
            try {
              msg.text = decrypt(msg.text);
            } catch (e) {
              console.error("❌ Failed to decrypt message:", e.message);
              msg.text = "[decryption error]";
            }
          }

          // Ensure numeric timestamp for pagination/sorting
          if (!msg.timeStamp && msg.createdAt) {
            msg.timeStamp = new Date(msg.createdAt).getTime();
          }

          return msg;
        } catch (parseError) {
          console.error("❌ Failed to parse message:", parseError);
          return null;
        }
      })
      .filter((msg) => msg !== null)
      .reverse();

    return parsedMessages;
  } catch (err) {
    console.error("❌ Failed to fetch messages from Redis:", err);
    return [];
  }
}

export async function getRaisedHands(scheduleId, occurrenceId) {
  try {
    const raised = await client.zRange(
      `handraise:${scheduleId}:${occurrenceId}`,
      0,
      -1
    );

    const raisedHands = [];
    for (const userId of raised) {
      const user = await userManager.getUserById(userId);
      // console.log("Found raised hand from user:", userId, user);
      if (user) {
        raisedHands.push({
          type: "handRaised",
          userId: user.rawId,
          username: user.username,
          scheduleId,
        });
      }
    }

    return raisedHands;
  } catch (err) {
    console.error("Error in getRaisedHands:", err);
    return [];
  }
}
export async function deleteAllMessages(scheduleId, occurrenceId) {
  try {
    const key = `room:${scheduleId}:${occurrenceId}:messages`;

    await client.del(key);

    console.log(
      chalk.yellow(`🗑️ Deleted all messages for scheduleId: ${scheduleId}`)
    );
    return { success: true, message: "All messages deleted successfully" };
  } catch (err) {
    console.error(chalk.red("❌ Failed to delete messages from Redis:"), err);
    throw new Error("Failed to delete messages from Redis");
  }
}
export async function deleteAllPolls(scheduleId, occurrenceId) {
  try {
    const listKey = `room:${scheduleId}:${occurrenceId}:polls`;
    const pollIds = await client.lRange(listKey, 0, -1);
    for (const pollId of pollIds) await client.del(`poll:${pollId}`);
    await client.del(listKey);

    console.log(
      chalk.yellow(`🗑️ Deleted all polls for scheduleId: ${scheduleId}`)
    );
    return { success: true, message: "All polls deleted successfully" };
  } catch (err) {
    console.error(chalk.red("❌ Failed to delete polls from Redis:"), err);
    throw new Error("Failed to delete polls from Redis");
  }
}
export async function saveWithRetry(fn, retries = 3, delay = 500) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      console.error(
        chalk.yellow(`⚠️ Save attempt ${attempt} failed:`, error.message)
      );
      if (attempt >= retries) {
        console.error(chalk.red("❌ All retries failed for Mongo save."));
        throw error;
      }
      await new Promise((res) => setTimeout(res, delay * attempt));
    }
  }
}
export async function getOlderPollsFromDB(scheduleId, skip = 0, limit = 20) {
  try {
    const polls = await pollModel
      .find({ scheduleId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedPolls = polls.map((pollDoc) => {
      const hashData = {
        scheduleId: pollDoc.scheduleId,
        question: pollDoc.question,
        createdBy: pollDoc.createdBy,
        createdAt:
          pollDoc.createdAt.getTime?.() ||
          new Date(pollDoc.createdAt).getTime(),
      };

      pollDoc.options.forEach((opt, idx) => {
        hashData[`option:${idx}`] = opt.text;
        hashData[`votes:${idx}`] = opt.votes || 0;
      });

      return {
        pollId: pollDoc._id.toString(),
        data: hashData,
      };
    });

    return formattedPolls;
  } catch (err) {
    console.error("Error fetching older polls:", err);
    return [];
  }
}

export async function fetchOlderMessagesFromMongo(
  scheduleId,
  occurrenceId,
  beforeTimestamp,
  page = 1,
  limit = 50
) {
  if (!scheduleId || !occurrenceId) {
    return { error: "scheduleId and occurrenceId are required", data: [], status: 400 };
  }

  const query = { scheduleId, occurrenceId };

  // If `beforeTimestamp` is passed, only fetch older than that
  if (beforeTimestamp) {
    const n = Number.parseInt(beforeTimestamp, 10);
    if (!Number.isFinite(n)) {
      return { error: "Invalid beforeTimestamp", data: [], status: 400 };
    }
    query.timeStamp = { $lt: n };
  }

  const safeLimit = Math.min(limit, 100);
  const skip = (page - 1) * safeLimit;

  try {
    const totalCount = await messageModel.countDocuments(query);

    const docs = await messageModel
      .find(query)
      .sort({ timeStamp: -1 }) // newest → oldest
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const data = docs.reverse().map((doc) => {
      let text = "";
      try {
        text = decrypt(doc.text);
      } catch (e) {
        console.error("❌ Failed to decrypt message (older):", e.message);
        text = "[decryption error]";
      }

      return {
        _id: doc._id,
        senderId: doc.senderId,
        senderName: doc.senderName,
        scheduleId: doc.scheduleId,
        occurrenceId: doc.occurrenceId,
        text,
        createdAt: doc.createdAt,
        timeStamp: doc.timeStamp,
      };
    });

    const totalPages = Math.ceil(totalCount / safeLimit);

    return {
      error: null,
      data,
      status: 200,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: safeLimit,
      },
    };
  } catch (err) {
    console.error("Error fetching messages:", err);
    return { error: "Database error", data: [], status: 500 };
  }
}


export async function deleteBanUserMessage(senderId, scheduleId, occurrenceId) {
  try {
    if (!senderId || !scheduleId || !occurrenceId) {
      return {
        error: "scheduleId, occurrenceId, senderId are required",
        data: [],
        status: 400,
      };
    }

    const mongoResult = await messageModel.deleteMany({
      senderId,
      scheduleId,
      occurrenceId,
    });

    const redisKey = `room:${scheduleId}:${occurrenceId}:messages`;

    let redisMessages = await client.lRange(redisKey, 0, -1);

    if (redisMessages.length > 0) {
      redisMessages = redisMessages.filter((msg) => {
        try {
          const parsed = JSON.parse(msg);
          return parsed.senderId !== senderId;
        } catch {
          return true;
        }
      });

      if (redisMessages.length > 0) {
        await client.del(redisKey);
        await client.rPush(redisKey, ...redisMessages);
        await client.expire(redisKey, 9000);
      } else {
        await client.del(redisKey);
      }
    }

    return {
      error: null,
      data: { deletedCount: mongoResult.deletedCount },
      status: 200,
    };
  } catch (err) {
    return {
      error: err.message || "Internal server error",
      data: [],
      status: 500,
    };
  }
}
