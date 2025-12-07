import mongoose from "mongoose";
import { fetchOccurrence, updateOccurrence } from "../schedule/scheduleOccurrences.js";
import { endLivekitRoom } from "../../utils/livekit/livekit.js";
import { updateMeetingEnd } from "../log/meetingLog.js";
import { logParticipantLeave } from "../log/participantsLog.js";
import { deleteAllMessages, deleteAllPolls } from "../message/messageService.js";
import redisClient from "../../configs/redis.js";
import chalk from "chalk";
import * as userManager from "../../services/socket/userManager.js"


export const endMeetingService = async (data: { occurrenceId: string; scheduleId: string; platformId: string; userId: string }, namespace: any, socket?: any) => {
    const { occurrenceId, scheduleId, platformId, userId } = data;

    // console.log("meeting service start: ", data)
    try {
        if (!occurrenceId || !scheduleId || !platformId || !userId) {
            if (!socket) {
                throw new Error("Missing one or more of the required fields: occurrenceId, scheduleId, platformId or userId")
            }
            socket?.emit("error", {
                message:
                    "Missing one or more of the required fields: occurrenceId, scheduleId, platformId or userId",
            });
            return;
        }

        if (!mongoose.Types.ObjectId.isValid(occurrenceId)) {
            if (!socket) {
                throw new Error("Invalid occurrenceId, please check and try again")
            }
            socket?.emit("error", {
                message: "Invalid occurrenceId, please check and try again.",
            });
            return;
        }

        const occurrenceObjectId = new mongoose.Types.ObjectId(`${occurrenceId}`)

        const occurrence = await fetchOccurrence({
            scheduleId,
            platformId,
            occurrenceId: occurrenceObjectId,
        });

        if (!occurrence) {
            if (!socket) {
                throw new Error("Schedule occurrence not found")
            }
            socket?.emit("endRoomDenied", {
                code: "NOT_FOUND",
                reason: "Schedule occurrence not found",
            });
            return;
        }

        const isHost = occurrence.hosts.some((host) => host.hostId === userId);

        if (!isHost) {
            if (!socket) {
                throw new Error("Only hosts can end the room")
            }
            socket?.emit("endRoomDenied", {
                code: "NOT_ALLOWED",
                reason: "Only hosts can end the room",
            });
            return;
        }
        await updateOccurrence({
            occurrenceId: occurrenceObjectId,
            hostId: userId,
            platformId: occurrence.platformId,
            scheduleId: occurrence.scheduleId,
            data: { status: "ended" },
        });

        await endLivekitRoom(occurrenceId);
        await updateMeetingEnd(data);
        await logParticipantLeave(data);

        namespace
            .to(occurrenceId)
            .emit("roomClosed", { message: "Room closed by host" });

        namespace.in(occurrenceId).socketsLeave(occurrenceId);

        try {
            await Promise.all([
                deleteAllMessages(scheduleId, occurrenceId),
                deleteAllPolls(scheduleId, occurrenceId),
                userManager.removeAllUserFromRoom(scheduleId, occurrenceId),
                redisClient.del(`handraise:${scheduleId}:${occurrenceId}`),
            ]);
            console.log("✅ Messages cleanup completed!");
        } catch (err: any) {
            console.error("❌ Error during meeting cleanup:", err.message);
        }
    } catch (err) {
        console.error(chalk.red("Error in endRoom:", err));
        socket?.emit("error", { message: "Failed to close room" });
    }

}