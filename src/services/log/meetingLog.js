import meetingLogModel from "../../models/meetingLogs/meetingLogs.js";


export async function logMeetingEvent(data) {
  try {
    // 1) Validate required fields
    const requiredFields = [
      "platformId",
      "userId",
      "username",
      "scheduleId",
      "occurrenceId",
    ];
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    const platformId = data.platformId.trim();
    const scheduleId = data.scheduleId.trim();
    const occurrenceId = data.occurrenceId.trim();
    const hostId = data.userId.trim();
    const hostName = data.username.trim();
    const title = (data.title ?? "").toString().trim();
    const description = (data.description ?? "").toString().trim();
    const now = new Date();

    const filter = { scheduleId, occurrenceId, hostId };
    const update = {
      $set: {
        createdAt: now,
      },
      $setOnInsert: {
        scheduleId,
        occurrenceId,
        platformId,
        hostId,
        hostName,
        title,
        description,
        startTime: now,
        endTime: data.endTime ? new Date(data.endTime) : null,
        duration: data.duration || null,
      },
    };

    const opts = {
      upsert: true,
      new: true,
      returnDocument: "after",
      runValidators: true,
    };

    const doc = await meetingLogModel.findOneAndUpdate(filter, update, opts);
    return doc;
  } catch (error) {
    console.error("❌ Error logging meeting event:", error.message);
    throw new Error(`Failed to log meeting event: ${error.message}`);
  }
}

export async function updateMeetingEnd({
  scheduleId,
  platformId,
  occurrenceId,
}) {

  try {
    if (!scheduleId || !platformId || !occurrenceId) {
      throw new Error("scheduleId and platformId are required");
    }

    const meeting = await meetingLogModel.findOne({
      scheduleId,
      platformId,
      occurrenceId,
    });

    if (!meeting) {
      throw new Error("Meeting not found");
    }

    const endTime = new Date();
    const duration = Math.round(
      (endTime - new Date(meeting.startTime)) / 60000
    );

    meeting.endTime = endTime;
    meeting.duration = duration;

    const updatedMeeting = await meeting.save();
    return updatedMeeting;
  } catch (error) {
    console.error("❌ Error updating meeting end:", error.message);
    throw new Error(`Failed to update meeting end: ${error.message}`);
  }
}
