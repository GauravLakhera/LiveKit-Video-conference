import mongoose from "mongoose";
import { fetchOccurrenceById } from "../schedule/scheduleOccurrences.js";
import recordingModel from "../../models/recording/recording.js";

export const addRecording = async ({ occurrenceId, url, meta }: {occurrenceId: mongoose.Types.ObjectId; url: String; meta?: any}) => {
    
    if (!mongoose.Types.ObjectId.isValid(occurrenceId)) {
        throw new Error("Invalid occurrenceId, please check and try again.")
    }
    const schedule = await fetchOccurrenceById(occurrenceId)

    // console.log(schedule)

    if(!schedule) {
        throw new Error("No schedule found for this occurrenceId, Manual Interference required.")
    }

    const payload = {
        scheduleId: schedule.scheduleId,
        hostId: schedule.hostId,
        platformId: schedule.platformId,
        occurrenceId: occurrenceId,
        url: url,
        meta: meta || []
    }

    const newRecording = await recordingModel.create(payload)
    return newRecording

}

export const getRecordingsBySchedule = async (
  scheduleId?: string,
  platformId?: string
) => {


  try {
    const filter: any = { };
    if(scheduleId)
    {
      filter.scheduleId=scheduleId
    }
    if (platformId) {
      filter.platformId = platformId;
    }

    const recordings = await recordingModel.find(filter);
    return recordings;
  } catch (error: any) {
    throw new Error("Error fetching recordings: " + error.message);
  }
};