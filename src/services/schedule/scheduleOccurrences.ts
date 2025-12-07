import scheduleModel from "../../models/schedule/schedule.js";
import scheduleOccurrenceModel from "../../models/schedule/scheduleOccurrences.js";
import participantModel from "../../models/participant/participant.js";
import {
  IfetchOccurrences,
  ScheduleOccurrenceDTO,
  UpdateScheduleOccurrenceDTO
} from "./dto/scheduleOccurrence.dto.js";
import { addDays, endOfDay, isBefore, startOfDay } from "date-fns";
import { CreatedOccurrenceSummary } from "./response/scheduleOccurrence.response.js";
import { generateUTCDate, isPastDateTime } from "../../utils/schedule/schedule.js";
import mongoose, { PipelineStage } from "mongoose";
import { ScheduleSummary } from "./response/schedule.response.js";
import { UpdateScheduleDTO } from "./dto/schedule.dto.js";

export const createOccurrence = async (
  data: ScheduleOccurrenceDTO
): Promise<any> => {
  const result = await scheduleOccurrenceModel.create(data);
  return result;
};

export const createOccurrencesFromSchedule = async (
  schedule: ScheduleSummary,
  fromDate?: Date
): Promise<CreatedOccurrenceSummary[]> => {
  // const schedule = await scheduleModel.findOne({ scheduleId })
  if (!schedule) throw new Error("Schedule not found");

  const {
    scheduleId,
    platformId,
    hostId,
    hostName,
    hosts,
    group,
    groupId,
    title,
    description,
    isPrivate,
    startDate,
    endDate,
    startTime,
    endTime,
    timeZone,
    recurrence,
    daysOfWeek,
  } = schedule;

  const start = fromDate ? new Date(Math.max(new Date(startDate).getTime(), fromDate?.getTime())) : new Date(startDate);
  console.log('createOccurrences From Schedule => start', start)
  console.log("createOccurrences => ", endDate)
  const end = endDate ? new Date(endDate) : addDays(start, 30); // fallback 30 days ahead
  console.log('createOccurrences From Schedule => end', end)

  const promises: Promise<CreatedOccurrenceSummary>[] = [];

  // Loop over days between start and end
  for (
    let d = new Date(start);
    isBefore(d, end) || d.getTime() === end.getTime();
    d = addDays(d, 1)
  ) {
    const dayOfWeek = d.getDay();

    if (recurrence === "none" && d.getTime() !== start.getTime()) {
      break; // only one occurrence
    }

    if (recurrence === "custom" && !daysOfWeek.includes(dayOfWeek)) {
      continue; // skip if not in recurrence pattern
    }

    // Convert from local tz → UTC
    const startDateTime = generateUTCDate({
      date: d,
      time: startTime,
      timeZone: timeZone,
    });

    if (isPastDateTime(
      d,
      startTime,
      schedule.timeZone ?? "Asia/Kolkata"
    )) {
      continue
    }


    const endDateTime = generateUTCDate({
      date: d,
      time: endTime!,
      timeZone: timeZone,
      compareWith: startDateTime,
    });

    const data: ScheduleOccurrenceDTO = {
      scheduleId,
      platformId,
      hostId,
      hostName,
      hosts,
      group,
      groupId,
      title,
      description,
      isPrivate,
      status: "scheduled",
      startDateTime,
      endDateTime,
    };

    promises.push(
      createOccurrence(data).then(occ => ({
        _id: occ._id.toString(),
        scheduleId: occ.scheduleId,
        startDateTime: occ.startDateTime,
        endDateTime: occ.endDateTime,
      }))
    );
  }

  return await Promise.all(promises);
};

export const fetchOccurrences = async ({
  scheduleId,
  platformId,
  hostId,
  todayDate,
  type,
  page,
  limit,
}: IfetchOccurrences & { page: number; limit: number }) => {
  if (type && !todayDate) {
    throw new Error(
      "todayDate in YYYY-mm-dd format is required with type parameter."
    );
  }

  const query: any = { platformId, "hosts.hostId": hostId };

  if (scheduleId) query.scheduleId = scheduleId;

  switch (type) {
    case "upcoming":
      query.startDateTime = {
        $gt: typeof todayDate === "string" && endOfDay(todayDate),
      };
      break;
    case "past":
      query.startDateTime = {
        $lt: typeof todayDate === "string" && startOfDay(todayDate),
      };
      break;
    case "today":
      query.startDateTime = {
        $gt: typeof todayDate === "string" && startOfDay(todayDate),
      };
      query.endDateTime = {
        $lt: typeof todayDate === "string" && endOfDay(todayDate),
      };
      break;
    default:
      break;
  }


  const skip = (page - 1) * limit;

  const [occurrences, totalCount] = await Promise.all([
    scheduleOccurrenceModel
      .find(query)
      .sort({ startDateTime: 1 })
      .skip(skip)
      .limit(limit),
    scheduleOccurrenceModel.countDocuments(query),
  ]);

  return { occurrences, totalCount };
};


export const fetchOccurrence = async ({
  scheduleId,
  platformId,
  hostId,
  occurrenceId,
}: {
  scheduleId: string;
  platformId: string;
  occurrenceId: mongoose.Types.ObjectId;
  hostId?: string;
}) => {
  const query: {
    _id: mongoose.Types.ObjectId;
    scheduleId: string;
    platformId: string;
    hostId?: string;
  } = {
    _id: occurrenceId,
    scheduleId,
    platformId,
  };

  if (hostId) query.hostId = hostId;

  const occurrence = await scheduleOccurrenceModel.findOne(query);
  return occurrence;
};

export const fetchOccurrenceById = async (
  occurrenceId: mongoose.Types.ObjectId
) => {
  const occurrence = await scheduleOccurrenceModel.findById(occurrenceId).lean();
  return occurrence;
};

//single occurrence updates:
export const updateOccurrence = async ({
  occurrenceId,
  hostId,
  platformId,
  scheduleId,
  data,
}: {
  occurrenceId: mongoose.Types.ObjectId;
  hostId: string;
  platformId: string;
  scheduleId: string;
  data: UpdateScheduleOccurrenceDTO;
}) => {
  const {
    group,
    title,
    status,
    hosts,
    description,
    isPrivate,
    recurrence,
    daysOfWeek,
  } = data;

  const allowedUpdates = {
    ...(group !== undefined && { group }),
    ...(title !== undefined && { title }),
    ...(status !== undefined && { status }),
    ...(hosts !== undefined && { hosts }),
    ...(description !== undefined && { description }),
    ...(isPrivate !== undefined && { isPrivate }),
  };

  return await scheduleOccurrenceModel.findOneAndUpdate(
    {
      _id: occurrenceId,
      scheduleId,
      platformId,
      "hosts.hostId": hostId,
    },
    { $set: allowedUpdates },
    { new: true }
  );
};

export const updateOccurrences = async (
  schedule: ScheduleSummary,
  updateData: UpdateScheduleDTO
) => {
  const now = new Date();
  const utcMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(), // this is already UTC "today"
    0, 0, 0, 0
  ));

  if (["inactive", "completed", "cancelled"].includes(schedule.status)) {

    let status;

    switch (schedule.status) {
      case "inactive":
        status = "ended"
        break
      case "completed":
        status = "ended"
        break
      case "cancelled":
        status = "cancelled"
        break
      default:
        status = "scheduled"
    }

    await scheduleOccurrenceModel.updateMany({
      scheduleId: schedule.scheduleId,
      status: { $or: ["scheduled", "live"] }
    },
      {
        $set: { status: status }
      })

    const updatedOccurrences = await scheduleOccurrenceModel.find({
      scheduleId: schedule.scheduleId,
    });

    return updatedOccurrences
  }



  if (updateData?.oldStartDate && updateData?.startDate) {

    await scheduleOccurrenceModel.updateMany({
      scheduleId: schedule.scheduleId,
      startDateTime: { $lt: startOfDay(new Date(updateData.startDate)) }
    }, {
      status: "ended"
    })
  }

  // const timeOrRecurrenceChanged =
  //   updateData.startTime ||
  //   updateData.endTime ||
  //   updateData.recurrence ||
  //   (updateData.daysOfWeek && updateData.daysOfWeek.length > 0);

  // if (timeOrRecurrenceChanged) {

  const recurrenceChanged = schedule.recurrence !== updateData.recurrence;
  const timeChanged = updateData.startTime || updateData.endTime;

  if (timeChanged || recurrenceChanged || (updateData.daysOfWeek && updateData.daysOfWeek.length > 0)) {
    console.log('😵 deleting future occurrences')
    console.log(utcMidnight)
    // Delete all future occurrences
    await scheduleOccurrenceModel.deleteMany({
      scheduleId: schedule.scheduleId,
      startDateTime: { $gte: utcMidnight },
      status: "scheduled"
    });
    // Recreate occurrences based on updated schedule
    return await createOccurrencesFromSchedule(schedule, now);
  } else {
    // Only update metadata
    const updateFields: any = {};
    if (updateData.group !== undefined) updateFields.group = updateData.group;
    if (updateData.title !== undefined) updateFields.title = updateData.title;
    if (updateData.description !== undefined)
      updateFields.description = updateData.description;
    if (updateData.hosts) updateFields.hosts = updateData.hosts;
    if (updateData.isPrivate !== undefined)
      updateFields.isPrivate = updateData.isPrivate;
    if (updateData.status) updateFields.status = updateData.status;

    await scheduleOccurrenceModel.updateMany(
      { scheduleId: schedule.scheduleId, startDateTime: { $gte: now } },
      { $set: updateFields }
    );

    const updatedOccurrences = await scheduleOccurrenceModel.find({
      scheduleId: schedule.scheduleId,
      startDateTime: { $gte: now },
    });

    return updatedOccurrences;
  }
};

type FetchOccurrencesByGroupInput = {
  platformId: string;
  hostId?: string;
  group?: string;
};

export const fetchOccurrencesByGroup = async ({
  platformId,
  hostId,
  group,
}: FetchOccurrencesByGroupInput) => {
  const match: Record<string, any> = {
    platformId,
  };

  if (hostId && hostId.trim()) {
    match["hosts.hostId"] = hostId.trim();
  }
  if (group && group.trim()) {
    match.group = group.trim();
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $group: {
        _id: "$group",
        occurrences: { $push: "$$ROOT" },
      },
    },
    {
      $project: {
        _id: 0,
        group: "$_id",
        occurrences: 1,
      },
    },
    { $sort: { group: 1 } },
  ];

  const result = await scheduleOccurrenceModel.aggregate(pipeline).exec();

  if (group && group.trim()) {
    return result ?? { group: group.trim(), occurrences: [] };
  }
  return result;
};

type OccurrenceType = "today" | "upcoming" | "past";
type FetchOccurrencesByParticipantInput = {
  platformId: string;
  participantId: string;
  type?: OccurrenceType;
  todayDate?: string;
};

export const fetchOccurrencesByParticipant = async ({
  platformId,
  participantId,
  type,
  todayDate,
}: FetchOccurrencesByParticipantInput) => {
  const match: Record<string, any> = { platformId, participantId };

  const buildTodayBounds = (): PipelineStage[] => {
    if (!type || !todayDate) return [];
    const start = todayDate ? startOfDay(new Date(todayDate)) : undefined;
    const end = todayDate ? endOfDay(new Date(todayDate)) : undefined;

    if (type === "upcoming") {
      return [{ $match: { startDateTime: { $gt: start } } }];
    }
    if (type === "past") {
      return [{ $match: { startDateTime: { $lt: start } } }];
    }

    return [
      { $match: { startDateTime: { $gt: start } } },
      { $match: { endDateTime: { $lt: end } } },
    ];
  };

  const lookupPipeline: PipelineStage[] = [
    { $match: { $expr: { $eq: ["$scheduleId", "$$sid"] } } },
    ...buildTodayBounds(),
    {
      $project: {
        _id: 1,
        scheduleId: 1,
        platformId: 1,
        group: 1,
        title: 1,
        description: 1,
        status: 1,
        startDateTime: 1,
        endDateTime: 1,
      },
    },
  ];

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: "scheduleOccurrences",
        let: { sid: "$scheduleId" },
        pipeline: lookupPipeline as any,
        as: "occurrences",
      },
    },
    { $project: { occurrences: 1, _id: 0 } },
    { $unwind: "$occurrences" },
    { $replaceRoot: { newRoot: "$occurrences" } },
    { $sort: { startDateTime: 1 } },
  ];

  // Cast to any or PipelineStage[] to please the aggregate signature
  const result = await participantModel.aggregate(pipeline as any).exec();
  return result;
};


export async function getOccurrenceStatsService(platformId?: string) {
  const match: any = {};
  if (platformId) match.platformId = platformId;

  const pipeline: any[] = [{ $match: match }];

  pipeline.push(
    {
      $group: {
        _id: null,
        totalOccurrences: { $sum: 1 },
        live: { $sum: { $cond: [{ $eq: ["$status", "live"] }, 1, 0] } },
        scheduled: { $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] } },
        ended: { $sum: { $cond: [{ $eq: ["$status", "ended"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
      },
    },
    { $project: { _id: 0 } }
  );

  const stats = await scheduleOccurrenceModel.aggregate(pipeline);

  return stats[0] || {
    totalOccurrences: 0,
    live: 0,
    scheduled: 0,
    ended: 0,
    cancelled: 0,

  };
}


// API to get occurrences with participants for current day

export const dayOccurrencesWithParticipantsService = async () => {

  const now = new Date()
  const startDateTime = new Date(now)
  const endDateTime = new Date(now)
  startDateTime.setHours(0, 0, 0, 0)
  endDateTime.setHours(23, 59, 59, 999)

  console.log(startDateTime, endDateTime)

  const pipeline: PipelineStage[] = [
    {
      $match: {
        startDateTime: { $gte: startDateTime, $lt: endDateTime },
        status: "scheduled"
      }
    },
    {
      $project: {
        _id: 1,
        platformId: 1,
        hostId: 1,
        hostName: 1,
        hosts: 1,
        scheduleId: 1,
        startDateTime: 1,
        endDateTime: 1
      }
    },
    {
      $lookup: {
        from: "participants",
        let: { sid: "$scheduleId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$scheduleId", "$$sid"] },
                  { $eq: ["$status", "active"] }
                ]
              }
            }
          },
          {
            $project: {
              _id: 1,
              scheduleId: 1,
              platformId: 1,
              participantId: 1,
              participantName: 1,
              status: 1
            }
          }
        ],
        as: "participants"
      }
    }
  ]

  const occurrences = await scheduleOccurrenceModel.aggregate(pipeline)
  // console.log(JSON.stringify(pipeline), occurrences)
  return occurrences


}
