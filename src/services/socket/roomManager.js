import chalk from "chalk";
import redisClient from "../../configs/redis.js";

const ROOMS_HASH = "rooms";
const ROOM_STATS_HASH = "room_stats";
const USER_ROOMS_HASH = "user_rooms";
const ROOM_USERS_SET_PREFIX = "room_users:";

export async function createRoom(roomId, roomData = {}) {
    try {
        const existingRoom = await redisClient.hGet(ROOMS_HASH, roomId);
        if (existingRoom) {
            return { success: false, error: "Room already exists" };
        }

        await redisClient.hSet(ROOMS_HASH, roomId, JSON.stringify(room));

        const stats = {
            totalJoins: 0,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
        await redisClient.hSet(ROOM_STATS_HASH, roomId, JSON.stringify(stats));

        console.log(chalk.blueBright(`🏠 Room created: ${roomId} by ${room.createdBy}`));

        return { success: true, room };
    } catch (error) {
        console.error(chalk.red(`❌ Failed to create room ${roomId}:`), error);
        throw error;
    }
}

export async function getRoom(roomId) {
    try {
        const roomData = await redisClient.hGet(ROOMS_HASH, roomId);
        return roomData ? JSON.parse(roomData) : null;
    } catch (error) {
        console.error(chalk.red(`❌ Failed to get room ${roomId}:`), error);
        throw error;
    }
}

export async function updateRoom(roomId, updates) {
    try {
        const room = await getRoom(roomId);
        if (!room) {
            return { success: false, error: "Room not found" };
        }

        const updatedRoom = {
            ...room,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await redisClient.hSet(ROOMS_HASH, roomId, JSON.stringify(updatedRoom));

        console.log(chalk.blue(`🔧 Room updated: ${roomId}`));

        return { success: true, room: updatedRoom };
    } catch (error) {
        console.error(chalk.red(`❌ Failed to update room ${roomId}:`), error);
        throw error;
    }
}

export async function deleteRoom(roomId, force = false) {
    try {
        const room = await getRoom(roomId);
        if (!room) {
            return { success: false, error: "Room not found" };
        }

        const roomUsers = await getRoomUsers(roomId);
        if (roomUsers.length > 0 && !force) {
            return { success: false, error: "Room has active users. Use force=true to close anyway" };
        }

        if (force) {
            for (const userId of roomUsers) {
                await removeUserFromRoom(userId);
            }
        }

        await redisClient.hDel(ROOMS_HASH, roomId);
        await redisClient.hDel(ROOM_STATS_HASH, roomId);
        await redisClient.del(`${ROOM_USERS_SET_PREFIX}${roomId}`);

        console.log(chalk.red(`🗑️ Room deleted: ${roomId}`));

        return { success: true };
    } catch (error) {
        console.error(chalk.red(`❌ Failed to delete room ${roomId}:`), error);
        throw error;
    }
}

export async function addUserToRoom(userId, roomId) {
    try {
        await removeUserFromRoom(userId);

        await redisClient.hSet(USER_ROOMS_HASH, userId, roomId);
        await redisClient.sAdd(`${ROOM_USERS_SET_PREFIX}${roomId}`, userId);

        const roomUsers = await getRoomUsers(roomId);
        const statsData = await redisClient.hGet(ROOM_STATS_HASH, roomId);
        if (statsData) {
            const stats = JSON.parse(statsData);
            stats.totalJoins++;
            stats.peakUsers = Math.max(stats.peakUsers, roomUsers.length);
            stats.lastActivity = new Date().toISOString();
            await redisClient.hSet(ROOM_STATS_HASH, roomId, JSON.stringify(stats));
        }

        console.log(chalk.green(`🏠 User ${userId} added to room ${roomId}`));

        return { success: true, userCount: roomUsers.length };
    } catch (error) {
        console.error(chalk.red(`❌ Failed to add user ${userId} to room ${roomId}:`), error);
        throw error;
    }
}

export async function removeUserFromRoom(userId) {
    try {
        const roomId = await redisClient.hGet(USER_ROOMS_HASH, userId);

        if (roomId) {
            await redisClient.hDel(USER_ROOMS_HASH, userId);
            await redisClient.sRem(`${ROOM_USERS_SET_PREFIX}${roomId}`, userId);

            const roomUsers = await getRoomUsers(roomId);
            if (roomUsers.length === 0) {
                const room = await getRoom(roomId);
                if (room) {
                    room.isActive = false;
                    await redisClient.hSet(ROOMS_HASH, roomId, JSON.stringify(room));
                    console.log(chalk.gray(`💤 Room ${roomId} marked inactive (empty)`));
                }
            }

            console.log(chalk.yellow(`🚪 User ${userId} removed from room ${roomId}`));

            return { success: true, roomId, userCount: roomUsers.length };
        }

        return { success: false, error: "User not in any room" };
    } catch (error) {
        console.error(chalk.red(`❌ Failed to remove user ${userId} from room:`), error);
        throw error;
    }
}

export async function getUserRoom(userId) {
    try {
        const roomId = await redisClient.hGet(USER_ROOMS_HASH, userId);
        return roomId || null;
    } catch (error) {
        console.error(chalk.red(`❌ Failed to get room for user ${userId}:`), error);
        throw error;
    }
}

export async function getRoomUsers(roomId) {
    try {
        const userIds = await redisClient.sMembers(`${ROOM_USERS_SET_PREFIX}${roomId}`);
        return userIds;
    } catch (error) {
        console.error(chalk.red(`❌ Failed to get users for room ${roomId}:`), error);
        throw error;
    }
}

export async function getAllRooms(filters = {}) {
    try {
        const roomsData = await redisClient.hGetAll(ROOMS_HASH);
        let rooms = Object.values(roomsData).map(roomData => JSON.parse(roomData));

        if (filters.activeOnly) {
            rooms = rooms.filter(room => room.isActive);
        }

        if (filters.publicOnly) {
            rooms = rooms.filter(room => !room.isPrivate);
        }

        if (filters.hasUsers) {
            const roomsWithUsers = [];
            for (const room of rooms) {
                const users = await getRoomUsers(room.id);
                if (users.length > 0) {
                    roomsWithUsers.push(room);
                }
            }
            rooms = roomsWithUsers;
        }

        if (filters.serviceId) {
            rooms = rooms.filter(room =>
                room.externalData.serviceId === filters.serviceId
            );
        }

        for (const room of rooms) {
            const users = await getRoomUsers(room.id);
            room.userCount = users.length;
        }

        return rooms.map(room => ({
            id: room.id,
            name: room.name,
            description: room.description,
            userCount: room.userCount,
            maxUsers: room.maxUsers,
            isPrivate: room.isPrivate,
            isActive: room.isActive,
            createdAt: room.createdAt,
            createdBy: room.createdBy,
            externalData: room.externalData
        }));
    } catch (error) {
        console.error(chalk.red("❌ Failed to get all rooms:"), error);
        throw error;
    }
}

export async function getRoomDetails(roomId) {
    try {
        const room = await getRoom(roomId);
        if (!room) return null;

        const userIds = await getRoomUsers(roomId);
        const statsData = await redisClient.hGet(ROOM_STATS_HASH, roomId);
        const stats = statsData ? JSON.parse(statsData) : {};

        return {
            id: room.id,
            name: room.name,
            description: room.description,
            userCount: userIds.length,
            userIds: userIds,
            maxUsers: room.maxUsers,
            isPrivate: room.isPrivate,
            isActive: room.isActive,
            createdAt: room.createdAt,
            createdBy: room.createdBy,
            settings: room.settings,
            externalData: room.externalData,
            statistics: stats
        };
    } catch (error) {
        console.error(chalk.red(`❌ Failed to get room details for ${roomId}:`), error);
        throw error;
    }
}

export async function updateRoomActivity(roomId) {
    try {
        const statsData = await redisClient.hGet(ROOM_STATS_HASH, roomId);
        if (statsData) {
            const stats = JSON.parse(statsData);
            stats.lastActivity = new Date().toISOString();
            await redisClient.hSet(ROOM_STATS_HASH, roomId, JSON.stringify(stats));
        }
    } catch (error) {
        console.error(chalk.red(`❌ Failed to update room activity for ${roomId}:`), error);
    }
}

export async function cleanup() {
    try {
        const roomsData = await redisClient.hGetAll(ROOMS_HASH);
        const rooms = Object.values(roomsData).map(data => JSON.parse(data));
        const inactiveRooms = [];
        const now = Date.now();

        for (const room of rooms) {
            if (!room.isActive) {
                const users = await getRoomUsers(room.id);
                if (users.length === 0) {
                    const inactiveTime = now - new Date(room.createdAt).getTime();
                    if (inactiveTime > 3600000) {
                        inactiveRooms.push(room.id);
                    }
                }
            }
        }

        for (const roomId of inactiveRooms) {
            await deleteRoom(roomId, true);
        }

        if (inactiveRooms.length > 0) {
            console.log(chalk.gray(`🧹 Cleaned up ${inactiveRooms.length} inactive rooms`));
        }

        return inactiveRooms.length;
    } catch (error) {
        console.error(chalk.red("❌ Failed to cleanup rooms:"), error);
        throw error;
    }
}
