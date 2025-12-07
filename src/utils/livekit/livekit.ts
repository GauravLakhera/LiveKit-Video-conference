// utils/livekit.js
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } from "../../configs/livekit.js";

export async function createLivekitToken({ occurrenceId, userId, role, username, platformId }: { occurrenceId: string; userId: string, role: string, username: string; platformId: string }) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: userId,
    name: username,
    metadata: JSON.stringify({ role, username, platformId }),
    attributes: {
      role,
      username,
      platformId
    }
  })

  const permissions = {
    roomJoin: true,
    room: occurrenceId,
    canPublish: true,
    canSubscribe: true,
    ...(role === "host" ? { recorder: true, roomAdmin: true, roomRecord: true } : {})
  }

  at.addGrant(permissions);

  return await at.toJwt();
}



const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);





// Call this when your host ends the room
export async function endLivekitRoom(roomName: string) {
  try {
    await roomService.deleteRoom(roomName);
    console.log(`✅ Room ${roomName} ended successfully.`);
  } catch (err: any) {
    console.error(`❌ Failed to end room ${roomName}:`, err?.message ?? err);
  }
}
export async function removeUserLivekit(roomName: string, userId: string) {
  try {
    await roomService.removeParticipant(roomName, userId);
    console.log(`✅ User ${userId} removed from room ${roomName} successfully.`);
  } catch (err: any) {
    console.error(
      `❌ Failed to remove user ${userId} from room ${roomName}:`);
    throw err;
  }
}
