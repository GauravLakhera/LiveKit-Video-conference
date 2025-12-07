import redisClient from "../../configs/redis.js";
import chalk from "chalk";
import { logParticipantJoin, logParticipantLeave,logParticipantsLeaveMany  } from "../log/participantsLog.js";
import { formatRedisUserId } from "../../utils/redis/redis.js";

const USERS_HASH = "users_by_id";
const SOCKET_USER_HASH = "socket_to_user";

const defaultAvatar =
  "https://media.istockphoto.com/id/1300845620/vector/user-icon-flat-isolated-on-white-background-user-symbol-vector-illustration.jpg?s=612x612&w=0&k=20&c=yBeyba0hUkh14_jgv1OKqIH0CCSWU_4ckRkAoy2p73o=";

export async function addUser(
  { userId, platformId, role,occurrenceId, scheduleId, username, avatar = defaultAvatar },
  socketId
) {
  try {
    const redisUserId = formatRedisUserId(occurrenceId, userId, platformId);

    const userData = {
      userId: redisUserId,
      rawId:userId,
      socketId,
      occurrenceId,
      username: username || `User_${socketId.slice(0, 6)}`,
      platformId,
      role,
      avatar: avatar || null,
      scheduleId,
      joinedAt: new Date().toISOString(),
    };

    await redisClient.hSet(USERS_HASH, redisUserId, JSON.stringify(userData));
    await redisClient.hSet(
      SOCKET_USER_HASH,
      socketId,
      JSON.stringify(userData)
    );

    await logParticipantJoin({
      platformId,
      scheduleId,
      occurrenceId,
      participantId:userId,
      participantName:username,
      role,
    });
    console.log(
      chalk.green(
        `👤 User added to log: ${userId} (${username}) - Platform: ${platformId} - Role: ${role}`
      )
    );

    return userData;
  } catch (error) {
    console.error(chalk.red(`❌ Failed to add user ${userId}:`), error);
    throw error;
  }
}

export async function getUserById(id) {
  try {
    const userData = await redisClient.hGet(USERS_HASH, id);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error(chalk.red(`❌ Failed to get user with ID: ${id}`), error);
    throw error;
  }
}

export async function getUserBySocketId(socketId) {
  try {
    const userData = await redisClient.hGet(SOCKET_USER_HASH, socketId);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error(
      chalk.red(`❌ Failed to get user with Socket ID ${socketId}:`),
      error
    );
    throw error;
  }
}

export async function updateUser(
  updates,
  id = undefined,
  socketId = undefined
) {
  try {
    if (!id && !socketId) {
      console.error(
        chalk.red(`❌ Formatted Redis User ID or a SocketId is required.`)
      );
      throw new Error("❌ Formatted Redis User ID or a SocketId is required.");
    }

    const userData = id
      ? await getUserById(id)
      : await getUserBySocketId(socketId);
    if (!userData) {
      return { success: false, error: "User not found" };
    }

    const updatedUser = {
      ...userData,
      ...updates,
      lastActivity: new Date().toISOString(),
    };

    await redisClient.hSet(
      USERS_HASH,
      userData.userId,
      JSON.stringify(updatedUser)
    );
    await redisClient.hSet(
      SOCKET_USER_HASH,
      userData.socketId,
      JSON.stringify(updatedUser)
    );

    console.log(chalk.blue(`🔄 User updated: ${id ? id : userData.socketId}`));

    return { success: true, user: updatedUser };
  } catch (error) {
    console.error(
      chalk.red(`❌ Failed to update user ${id ? id : userData.socketId}:`),
      error
    );
    throw error;
  }
}

export async function removeUser(id = undefined, socketId = undefined, options = {}) {
  const { skipLog = false } = options;
  try {
    if (!id && !socketId) {
      throw new Error("❌ Formatted Redis User ID or a SocketId is required.");
    }

    const userData = id
      ? await getUserById(id)
      : await getUserBySocketId(socketId);

    if (!userData) {
      return { success: false, error: "User not found" };
    }

    if (!skipLog) {
      try {
        await logParticipantLeave({
          platformId: userData.platformId,
          scheduleId: userData.scheduleId,
          occurrenceId: userData.occurrenceId,
          participantId: userData.rawId,
        });
      } catch (err) {
        console.warn(`⚠️ Could not log leave for ${userData.userId}`, err);
      }
    }

    await redisClient.hDel(USERS_HASH, userData.userId);
    await redisClient.hDel(SOCKET_USER_HASH, userData.socketId);

    console.log(
      chalk.yellow(
        `👋 User removed: ${userData.userId} (${userData.username}) socketId: ${userData.socketId}`
      )
    );

    return { success: true, user: userData };
  } catch (error) {
    console.error(
      chalk.red(`❌ Failed to remove user ${id || socketId}:`),
      error
    );
    throw error;
  }
}

export async function removeAllUserFromRoom(scheduleId, occurrenceId) {
  try {
    // 1. Get all users for this occurrence
    const allUsers = await getUsersByOccurrence(occurrenceId);

    // 2. Filter by scheduleId
    const targetUsers = allUsers.filter(
      (user) => user.scheduleId === scheduleId
    );

    if (!targetUsers.length) {
      console.log(
        chalk.yellow(
          `⚠️ No users found for scheduleId: ${scheduleId}, occurrenceId: ${occurrenceId}`
        )
      );
      return { success: true, removedUsers: [], failedUsers: [] };
    }

    // 3. Remove each user (but don’t call logParticipantLeave individually)
    const results = await Promise.allSettled(
      targetUsers.map((user) => removeUser(user.userId, undefined, { skipLog: true }))
    );

    const removedUsers = results
      .filter((r) => r.status === "fulfilled")
      .map((r, i) => targetUsers[i]);

    const failedUsers = results
      .filter((r) => r.status === "rejected")
      .map((_, i) => targetUsers[i]);

    console.log(
      chalk.green(
        `🗑️ Removed ${removedUsers.length} users from scheduleId: ${scheduleId}, occurrenceId: ${occurrenceId}`
      )
    );

    if (failedUsers.length > 0) {
      console.warn(
        chalk.red(
          `❌ Failed to remove ${failedUsers.length} users for scheduleId: ${scheduleId}, occurrenceId: ${occurrenceId}`
        )
      );
    }

    // 4. Batch log leave events in Mongo (only for successfully removed users)
    if (removedUsers.length > 0) {
      const participantIds = removedUsers.map((u) => u.rawId);
      const platformId = removedUsers[0].platformId;

      await logParticipantsLeaveMany({
        platformId,
        scheduleId,
        occurrenceId,
        participantIds,
      });
    }

    return { success: true, removedUsers, failedUsers };
  } catch (error) {
    console.error(
      chalk.red(
        `❌ Error in removeUsersByScheduleAndOccurrence for scheduleId: ${scheduleId}, occurrenceId: ${occurrenceId}`
      ),
      error
    );
    throw error;
  }
}



export async function getAllUsers() {
  try {
    const usersData = await redisClient.hGetAll(USERS_HASH);
    return Object.values(usersData).map((userData) => JSON.parse(userData));
  } catch (error) {
    console.error(chalk.red("❌ Failed to get all users:"), error);
    throw error;
  }
}

export async function getUsersByOccurrence(occurrenceId) {
  try {
    const allUsers = await getAllUsers();
    // console.log(allUsers)
    return allUsers.filter(
      (user) => user.occurrenceId === occurrenceId
    );

  } catch (error) {
    console.error(
      chalk.red(`❌ Failed to get users by occurrence: ${occurrenceId}:`),
      error
    );
    throw error;
  }
}

//later
export async function getUserStatistics() {
  try {
    const allUsers = await getAllUsers();
    const activeUsers = allUsers.filter((user) => user.isActive);

    const stats = {
      totalUsers: allUsers.length,
      activeUsers: activeUsers.length,
      usersByRole: {},
      usersByPlatform: {},
      usersByService: {},
    };

    // Group by role
    activeUsers.forEach((user) => {
      stats.usersByRole[user.role] = (stats.usersByRole[user.role] || 0) + 1;
    });

    // Group by platform
    activeUsers.forEach((user) => {
      stats.usersByPlatform[user.platformId] =
        (stats.usersByPlatform[user.platformId] || 0) + 1;
    });

    // Group by service
    activeUsers.forEach((user) => {
      if (user.serviceId) {
        stats.usersByService[user.serviceId] =
          (stats.usersByService[user.serviceId] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    console.error(chalk.red("❌ Failed to get user statistics:"), error);
    throw error;
  }
}

export async function cleanupInactiveUsers(inactiveThresholdMinutes = 60) {
  try {
    const allUsers = await getAllUsers();
    const now = new Date();
    const removedUsers = [];

    for (const user of allUsers) {
      const lastActivity = new Date(user.lastActivity);
      const inactiveMinutes = (now - lastActivity) / (1000 * 60);

      if (inactiveMinutes > inactiveThresholdMinutes) {
        await removeUser(user.userId);
        removedUsers.push(user.userId);
      }
    }

    if (removedUsers.length > 0) {
      console.log(
        chalk.gray(`🧹 Cleaned up ${removedUsers.length} inactive users`)
      );
    }

    return removedUsers.length;
  } catch (error) {
    console.error(chalk.red("❌ Failed to cleanup inactive users:"), error);
    throw error;
  }
}

console.log(chalk.blue("🚀 User Manager initialized"));
