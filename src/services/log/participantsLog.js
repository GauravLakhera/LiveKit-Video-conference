import participantLogModel from "../../models/meetingLogs/participentsLogs.js";
import mongoose from "mongoose";

export async function logParticipantJoin(data) {
  const now = new Date();

  const session = await participantLogModel.create({
    ...data,
    event: "joined",
    joinTime: now,
    leaveTime: null,
    duration: null,
  });

  return session;
}

export async function logParticipantLeave(data) {
  const now = new Date();

  const session = await participantLogModel
    .findOne({
      platformId: data.platformId,
      scheduleId: data.scheduleId,
      occurrenceId: data.occurrenceId,
      participantId: data.userId || data.participantId,
      leaveTime: null,
    })
    .sort({ joinTime: -1 });

  if (!session) {
    console.warn(`⚠️ No open session found for user ${data.participantId}`);
    return null;
  }

  session.event = "left";
  session.leaveTime = now;
  session.duration = Math.floor(
    (now.getTime() - session.joinTime.getTime()) / 1000
  );
  await session.save();

  return session;
}
export async function logParticipantsLeaveMany({
  platformId,
  scheduleId,
  occurrenceId,
  participantIds = [],
}) {
  const now = new Date();

  try {
    const query = {
      platformId,
      scheduleId,
      occurrenceId,
      leaveTime: null,
    };

    if (participantIds.length > 0) {
      query.participantId = { $in: participantIds };
    }

    const result = await participantLogModel.updateMany(query, [
      {
        $set: {
          event: "left",
          leaveTime: now,
          duration: {
            $toInt: {
              $divide: [{ $subtract: [now, "$joinTime"] }, 1000],
            },
          },
        },
      },
    ]);

    console.log(
      `✅ Updated ${result.modifiedCount} participant(s) as left for occurrenceId: ${occurrenceId}`
    );

    return result;
  } catch (err) {
    console.error("❌ Error in logParticipantsLeaveMany:", err);
    throw err;
  }
}

export async function fetchAllParticipantSessions(
  platformId,
  scheduleId,
  occurrenceId,
  page = 1,
  limit = 10
) {
  const skip = (page - 1) * limit;

  const pipeline = [
    {
      $match: {
        platformId,
        scheduleId,
        occurrenceId: new mongoose.Types.ObjectId(occurrenceId),
      },
    },
    {
      $group: {
        _id: "$participantId",
        participantName: { $last: "$participantName" },
        role: { $last: "$role" },
        totalDuration: { $sum: { $ifNull: ["$duration", 0] } },
        sessions: {
          $push: {
            joinTime: "$joinTime",
            leaveTime: "$leaveTime",
            duration: "$duration",
            event: "$event",
          },
        },
      },
    },
    { $sort: { participantName: 1 } },
    { $skip: skip },
    { $limit: limit },
  ];

const [results, totalCountAgg] = await Promise.all([
  participantLogModel.aggregate(pipeline),
  participantLogModel.aggregate([
    {
      $match: {
        platformId,
        scheduleId,
        occurrenceId: new mongoose.Types.ObjectId(occurrenceId),
      },
    },
    { $group: { _id: "$participantId" } },
    { $count: "total" },
  ]),
]);

const totalCount = totalCountAgg[0]?.total || 0;

return {
  participants: results,
  pagination: {
    total: totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  },
};
}


export async function fetchParticipantAttendance(
  platformId,
  scheduleId,
  occurrenceId,
  page = 1,
  limit = 10
) {
  const skip = (page - 1) * limit;

  const pipeline = [
    {
      $match: {
        platformId,
        scheduleId,
        occurrenceId: new mongoose.Types.ObjectId(occurrenceId),
      },
    },
    {
      $group: {
        _id: "$participantId",
        participantName: { $last: "$participantName" },
        role: { $last: "$role" },
        totalDuration: { $sum: { $ifNull: ["$duration", 0] } },
        sessions: {
          $push: {
            joinTime: "$joinTime",
            leaveTime: "$leaveTime",
            duration: "$duration",
            event: "$event",
          },
        },
      },
    },
    { $sort: { participantName: 1 } },
    { $skip: skip },
    { $limit: limit },
  ];

const [results, totalCountAgg] = await Promise.all([
  participantLogModel.aggregate(pipeline),
  participantLogModel.aggregate([
    {
      $match: {
        platformId,
        scheduleId,
        occurrenceId: new mongoose.Types.ObjectId(occurrenceId),
      },
    },
    { $group: { _id: "$participantId" } },
    { $count: "total" },
  ]),
]);

const totalCount = totalCountAgg[0]?.total || 0;

return {
  participants: results,
  pagination: {
    total: totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  },
};
}