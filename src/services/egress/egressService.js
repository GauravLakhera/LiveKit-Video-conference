import {exec} from "child_process"

import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptionsPreset,
} from "livekit-server-sdk";
import chalk from "chalk";
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } from "../../configs/livekit.js";

class EgressService {
  constructor() {
    this.egressClient = new EgressClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    this.screenRecordings = new Map();
    this.roomRecordings = new Map();
  }



  async startScreenRecording(roomName, hostUserId) {
    try {
      if (this.screenRecordings.has(roomName)) {
        throw new Error("Already screen recording this room");
      }
      if (!roomName || roomName.trim() === "") {
        throw new Error("Room name is required");
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `screen-${roomName}-${timestamp}.mp4`;

      const fileOutput = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: `/tmp/recordings/${filename}`,
        preset: "H264_1080P_30",
      });

      console.log(
        chalk.blue("🎬 Starting host-only screen recording for room:"),
        roomName
      );

      const egress = await this.egressClient.startRoomCompositeEgress(
        roomName,
        { file: fileOutput },
        {
          layout: "single-speaker",
          participantIdentity: [hostUserId],
          audioOnly: false,
          videoOnly: false,
          encodingOptions: EncodingOptionsPreset.H264_1080P_30,
        }
      );

      this.screenRecordings.set(roomName, {
        egressId: egress.egressId,
        filename,
        startTime: new Date(),
        hostUserId,
        type: "screen",
      });

      console.log(chalk.green("✅ Host screen recording started:"), {
        egressId: egress.egressId,
        filename,
        roomName,
      });

      return {
        success: true,
        egressId: egress.egressId,
        filename,
        message: "Screen recording started successfully",
      };
    } catch (error) {
      console.error(chalk.red("❌ Screen recording failed:"), error.message);
      throw error;
    }
  }

  async startRoomRecording(roomName, hostUserId) {
    console.log("LIVEKIT URL",LIVEKIT_URL)
    try {
      if (this.roomRecordings.has(roomName)) {
        throw new Error("Already room recording this room");
      }

      if (!roomName || roomName.trim() === "") {
        throw new Error("Room name is required");
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `room-${roomName}-${timestamp}.mp4`;

      const fileOutput = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: `/tmp/recordings/${filename}`,
        preset: "H264_1080P_30",
      });

      console.log(chalk.blue("🎬 Starting room recording for room:"), roomName);

      const egress = await this.egressClient.startRoomCompositeEgress(
        roomName,
        { file: fileOutput },
        {
          layout: "custom",
          // customBaseUrl: "https://custom-templatex.netlify.app",
          customBaseUrl: "http://host.docker.internal:5174",
          audioOnly: false,
          encodingOptions: EncodingOptionsPreset.H264_1080P_30,
          videoOnly: false,
        }
      );

      this.roomRecordings.set(roomName, {
        egressId: egress.egressId,
        filename,
        startTime: new Date(),
        hostUserId,
        type: "room",
      });

      console.log(chalk.green("✅ Room recording started:"), {
        egressId: egress.egressId,
        filename,
        roomName,
      });

      return {
        success: true,
        egressId: egress.egressId,
        filename,
        message: "Room recording started successfully",
      };
    } catch (error) {
      console.error(chalk.red("❌ Room recording failed:"), error);
      throw error;
    }
  }

  async stopRecording(roomName) {
    try {
      let recording = this.screenRecordings.get(roomName);
      let recordingType = "screen";
      let recordingsMap = this.screenRecordings;

      if (!recording) {
        recording = this.roomRecordings.get(roomName);
        recordingType = "room";
        recordingsMap = this.roomRecordings;
      }

      if (!recording) {
        throw new Error("No active recording found for this room");
      }

      console.log(chalk.blue("⏹️ Stopping recording:"), recording.egressId);

      const result = await this.egressClient.stopEgress(recording.egressId);

      recordingsMap.delete(roomName);

      console.log(chalk.green("✅ Recording stopped successfully:"), {
        filename: recording.filename,
        duration: new Date() - recording.startTime,
      });

  

      return {
        success: true,
        filename: recording.filename,
        egressId: recording.egressId,
        recordingType,
        message: `${recordingType} recording stopped successfully`,
      };
    } catch (error) {
      console.error(chalk.red("❌ Stop recording failed:"), error.message);
      throw error;
    }
  }

  isRecording(roomName) {
    return this.screenRecordings.has(roomName);
  }

  isRoomRecording(roomName) {
    return this.roomRecordings.has(roomName);
  }

  getRecordingInfo(roomName) {
    return this.screenRecordings.get(roomName) || null;
  }

  getRoomRecordingInfo(roomName) {
    return this.roomRecordings.get(roomName) || null;
  }
}

export const egressService = new EgressService();
