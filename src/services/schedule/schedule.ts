import { differenceInDays, differenceInMinutes, isBefore } from "date-fns";
import meetingLogModel from "../../models/meetingLogs/meetingLogs.js";
import participantLogModel from "../../models/meetingLogs/participentsLogs.js";
import scheduleModel from "../../models/schedule/schedule.js";
import scheduleOccurrenceModel from "../../models/schedule/scheduleOccurrences.js";
import {
  compareTime,
  dateDiffInDays,
  generateUTCDate,
  isPastDateTime,
} from "../../utils/schedule/schedule.js";
import { addParticipant } from "../participant/participant.js";
import mongoose from "mongoose";
import { CreateScheduleDTO, UpdateScheduleDTO } from "./dto/schedule.dto.js";
import { updateOccurrences } from "./scheduleOccurrences.js";
// import { ScheduleSummary } from "./response/schedule.response.js";

// 🔎 Check if schedule already exists (exact time match)
export const checkScheduleExists = async ({
  platformId,
  hostId,
  startDate,
  startTime,
}: {
  platformId: String;
  hostId: String;
  startDate: Date;
  startTime: String;
}) => {
  return await scheduleModel.findOne({
    platformId,
    hostId,
    startDate: startDate,
    startTime: startTime,
  });
};

export const countSchedules = async ({
  platformId,
  hostId,
}: {
  platformId?: string | undefined;
  hostId?: string | undefined;
}) => {
  const query = {
    ...(platformId ? { platformId: platformId } : {}),
    ...(hostId ? { hostId: hostId } : {}),
  };
  return await scheduleModel.countDocuments(query);
};

// ➕ Add schedule and auto-add host as participant
export const addSchedule = async (createScheduleDTO: CreateScheduleDTO) => {
  const isExisting = await checkScheduleExists({
    platformId: createScheduleDTO.platformId,
    hostId: createScheduleDTO.hostId,
    startDate: new Date(createScheduleDTO.startDate),
    startTime: createScheduleDTO.startTime,
  });

  if (isExisting) return null;

  const schedule = await scheduleModel.create(createScheduleDTO);

  const promises = [];

  for (const h of schedule.hosts) {
    const promise = await addParticipant({
      platformId: schedule.platformId,
      participantId: h.hostId,
      participantName: h.hostName,
      scheduleId: schedule.scheduleId,
      role: h.role,
    })
      .then((res) => {
        console.log(res);
        console.log(
          `hostId: ${h.hostId}, scheduleId: ${schedule.scheduleId}, role: ${h.role} added successfully`
        );
      })
      .catch((err) => `Error adding participant: ${err}`);

    promises.push(promise);
  }

  await Promise.all(promises);

  return schedule;
};

// 📌 Fetch a single schedule
export const fetchSchedule = async (
  scheduleId: string,
  platformId: string,
  hostId: string
) => {
  return await scheduleModel.findOne(
    { scheduleId, platformId, hostId }
    // { participants: 1, hostId: 1, status: 1, scheduleId: 1, platformId: 1, hosts: 1 }
  );
};

// 📌 Fetch all schedules for a host on a platform
export const fetchSchedules = async (
  platformId: string,
  hostId: string,
  skip: number,
  limit: number
) => {
  const totalCount = await countSchedules({ platformId, hostId });

  const schedules = await scheduleModel
    .find({ platformId, "hosts.hostId": hostId })
    .sort({ startDate: 1 })
    .skip(skip)
    .limit(limit);

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / limit);

  return {
    schedules,
    pagination: {
      totalCount,
      totalPages,
      currentPage: Math.floor(skip / limit) + 1,
      pageSize: limit,
    },
  };
};

// 📌 Fetch all schedules across platform (paginated)
export const fetchAllSchedules = async (
  skip: number,
  limit: number,
  platformId: string
) => {
  const filter = platformId ? { platformId } : {};

  const totalCount = await countSchedules(filter);

  const schedules = await scheduleModel
    .find(filter)
    .sort({ startDate: -1 })
    .skip(skip)
    .limit(limit);

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / limit);

  return {
    schedules,
    pagination: {
      totalCount,
      totalPages,
      currentPage: Math.floor(skip / limit) + 1,
      pageSize: limit,
    },
  };
};

// ✏️ Update schedule (only by host/co-host)

export const scheduleUpdate = async (
  scheduleId: string,
  platformId: string,
  hostId: string,
  data: UpdateScheduleDTO
) => {
  try {
    // Step 1: Fetch schedule first
    const schedule = await scheduleModel.findOne({
      scheduleId,
      platformId,
      "hosts.hostId": hostId, // only host/co-host can update
    });

    if (!schedule) {
      throw new Error("Schedule not found or not authorized");
    }

    if (schedule.status === "completed") {
      throw new Error(
        "Cannot update a schedule that has already completed, please create a new schedule"
      );
    }

    // Step 2: Whitelist allowed fields
    const {
      group,
      title,
      startDate,
      startTime,
      endDate,
      endTime,
      status,
      hosts,
      description,
      isPrivate,
      recurrence,
      daysOfWeek,
    } = data;

    const allowedUpdates: Partial<UpdateScheduleDTO> = {
      ...(group !== undefined && { group }),
      ...(title !== undefined && { title }),
      ...(startDate !== undefined && { startDate }),
      ...(startTime !== undefined && { startTime }),
      ...(endDate !== undefined && { endDate }),
      ...(endTime !== undefined && { endTime }),
      ...(status !== undefined && { status }),
      ...(hosts !== undefined && { hosts }),
      ...(description !== undefined && { description }),
      ...(isPrivate !== undefined && { isPrivate }),
      ...(recurrence !== undefined && { recurrence }),
      ...(daysOfWeek !== undefined && { daysOfWeek }),
    };

    console.log('allowedUpdate.endDate ', allowedUpdates?.endDate)

    // Step 3: Run validations manually here using schedule + allowedUpdates
    const newStartTime = allowedUpdates?.startTime ?? schedule.startTime;
    const newEndTime = allowedUpdates?.endTime ?? schedule.endTime;

    if (compareTime(newEndTime, newStartTime) <= 0) {
      throw new Error("endTime must be after startTime");
    }

    if (allowedUpdates?.startDate) {
      if (
        isPastDateTime(
          new Date(allowedUpdates.startDate),
          newStartTime,
          schedule.timeZone ?? "Asia/Kolkata"
        )
      ) {
        throw new Error("Start date/time must be now or in the future.");
      }
    }

    if (allowedUpdates?.endDate) {
      if (
        isPastDateTime(
          new Date(allowedUpdates.endDate),
          newEndTime,
          schedule.timeZone ?? "Asia/Kolkata"
        )
      ) {
        throw new Error("end date/time must be today or in the future.");
      }
    }

    const newStartDate = allowedUpdates?.startDate ?? schedule.startDate;
    const newEndDate = allowedUpdates?.endDate ? (
        typeof allowedUpdates?.endDate === "string" 
        ? new Date(allowedUpdates?.endDate) 
        : allowedUpdates.endDate
      ) 
        : schedule.endDate;

    let dateDiff = newStartDate ? dateDiffInDays(newStartDate, newEndDate) : 0;

    if (dateDiff < 0) {
      throw new Error("endDate cannot be before startDate");
    }

    const startDateTime = generateUTCDate({
      date: new Date(newStartDate),
      time: newStartTime,
      timeZone: "Asia/Kolkata", // or from req.body / schedule if dynamic
    });

    const endDateTime = generateUTCDate({
      date: new Date(newStartDate), // always use startDate (even if multi-day)
      time: newEndTime,
      timeZone: "Asia/Kolkata",
      compareWith: startDateTime, // ensures rollover if needed
    });

    const durationMinutes = differenceInMinutes(endDateTime, startDateTime);
    // console.log(durationMinutes)
    if (durationMinutes > 120) {
      throw new Error("Meeting duration cannot exceed 2 hours.");
    }

    let finalRecurrence = allowedUpdates.recurrence ?? schedule.recurrence;
    let finalDaysOfWeek = allowedUpdates.daysOfWeek ?? schedule.daysOfWeek;
    if (!finalRecurrence) {
      if (
        Array.isArray(finalDaysOfWeek) &&
        finalDaysOfWeek.length > 0 &&
        newEndDate &&
        dateDiff >= 7
      ) {
        finalRecurrence = "custom";
      } else if (newEndDate && newEndDate !== startDate) {
        finalRecurrence = "daily";
      } else {
        finalRecurrence = "none";
      }
    }

    if (finalRecurrence === "none") {
      if (Array.isArray(finalDaysOfWeek) && finalDaysOfWeek.length > 0) {
        throw new Error(
          "If recurrense is none then daysOfWeek needs to be and empty array."
        );
      }
      // if (newEndDate !== newStartDate) {
      //   throw new Error("endDate needs to be same as startDate if recurrence is none")
      // }
    }

    if (
      finalRecurrence === "custom" &&
      newStartDate &&
      newEndDate &&
      dateDiff < 7
    ) {
      throw new Error(
        "custom recurrence needs endDate to be atleast 7 days after startDate."
      );
    }

    if (
      finalRecurrence === "custom" &&
      (!Array.isArray(finalDaysOfWeek) || finalDaysOfWeek.length === 0)
    ) {
      throw new Error(
        "custom recurrence requires non-empty daysOfWeek array (0=Sun..6=Sat)"
      );
    }

    if (["custom", "daily"].includes(finalRecurrence) && !newEndDate) {
      throw new Error("daily/custom recurrence required endDate.");
    }

    if (
      finalRecurrence !== "custom" &&
      Array.isArray(finalDaysOfWeek) &&
      finalDaysOfWeek.length > 0
    ) {
      throw new Error(
        "recurrence cannot be daily/none if daysOfWeek Array is present, please change it to custom."
      );
    }

    if (daysOfWeek && !newEndDate) {
      throw new Error("endDate is required with daysOfWeek.");
    }

    if (startDate === newEndDate && finalRecurrence !== "none") {
      throw new Error("recurrence needs to be 'none' if startDate === endDate");
    }

    type Host = { hostId: string; hostName: string; role: "host" | "coHost" };
    let allHosts: Host[] = schedule.hosts
    
    
    if (allowedUpdates?.hosts) {
      // Ensure the main host is always included in hosts array
      allHosts = [
        { hostId: schedule.hostId, hostName: schedule.hostName, role: "host" },
        ...(allowedUpdates?.hosts || [])
          .filter((ho) => ho.hostId && ho.hostName)
          .map((h) => ({
            hostId: h.hostId!, // non-null assertion because we filtered
            hostName: h.hostName!,
            role: h.role === "host" || h.role === "coHost" ? h.role : "coHost",
          })),
      ];
    }


    // console.log("allowedUpdates.hosts", allowedUpdates?.hosts)

    // console.log('allHosts', allHosts)

    // Deduplicate by hostId
    const uniqueHosts: Host[] = Array.from(
      new Map(allHosts.map((h) => [h.hostId, h])).values()
    );

    allowedUpdates.hosts = uniqueHosts;

    // console.log("updated uniqueHosts are:", uniqueHosts)
    // console.log("startDate sent: ", newStartDate)
    // console.log("startDate in DB: ", schedule.startDate)
    // console.log(new Date(newStartDate), schedule.startDate,dateDiffInDays(new Date(newStartDate), schedule.startDate))

    const oldStartDate = dateDiffInDays(new Date(newStartDate), schedule.startDate) < 0 ? schedule.startDate : undefined


    console.log('newStartDate ', newStartDate)
    console.log("newEndDate ", newEndDate)

    // Step 4: Apply updates to the fetched document
    schedule.recurrence = finalRecurrence;
    Object.assign(schedule, allowedUpdates);

    // Step 5: Save updated schedule
    await schedule.save();

    //delete future occurrences and run createOccurrences API again

    let updateData = {
      ...(allowedUpdates.startDate !== undefined && { startDate: allowedUpdates.startDate }),
      ...(allowedUpdates.endDate !== undefined && { endDate: allowedUpdates.endDate }),
      ...(allowedUpdates.startTime !== undefined && { startTime: allowedUpdates.startTime }),
      ...(allowedUpdates.endTime !== undefined && { endTime: allowedUpdates.endTime }),
      ...(allowedUpdates.recurrence !== undefined && { recurrence: allowedUpdates.recurrence }),
      ...(allowedUpdates.daysOfWeek !== undefined && { daysOfWeek: allowedUpdates.daysOfWeek }),
      ...(allowedUpdates.group !== undefined && { group: allowedUpdates.group }),
      ...(allowedUpdates.title !== undefined && { title: allowedUpdates.title }),
      ...(allowedUpdates.description !== undefined && { description: allowedUpdates.description }),
      ...(uniqueHosts !== undefined && { hosts: uniqueHosts }),
      ...(allowedUpdates.isPrivate !== undefined && { isPrivate: allowedUpdates.isPrivate }),
      ...(allowedUpdates.status !== undefined && { status: allowedUpdates.status }),
      ...(oldStartDate !== undefined && { oldStartDate: oldStartDate })
    };

    const occurrences = await updateOccurrences(schedule, updateData);

    return { status: true, schedule, occurrences };
  } catch (error: any) {
    console.error(`❌ Error updating schedule: ${error}`);
    return { status: false, message: error.message };
  }
};

export async function deleteScheduleService(
  platformId: string,
  hostId: string,
  scheduleId: string
): Promise<{ success: boolean; message: string }> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schedule = await scheduleModel
      .findOne({ platformId, hostId, scheduleId })
      .session(session);
    if (!schedule) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Schedule not found or unauthorized." };
    }

    await scheduleOccurrenceModel
      .deleteMany({ platformId, scheduleId })
      .session(session);
    await meetingLogModel
      .deleteMany({ platformId, scheduleId })
      .session(session);
    await participantLogModel
      .deleteMany({ platformId, scheduleId })
      .session(session);
    await scheduleModel
      .deleteOne({ platformId, hostId, scheduleId })
      .session(session);

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: "Schedule, occurrences, and logs deleted successfully.",
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

export const searchScheduleService = async (searchParam: string) => {
  if (!searchParam || typeof searchParam !== "string") {
    throw new Error("Invalid search parameter");
  }

  // Case-insensitive regex for partial match
  const regex = new RegExp(searchParam, "i");

  const schedules = await scheduleModel.find({
    $or: [
      { group: regex },
      { hostId: regex },
      { hostName: regex },
      { scheduleId: regex },
      { title: regex },
    ],
  });

  return schedules;
};

export async function getScheduleStatsService(platformId?: string) {
  const match: any = {};
  if (platformId) match.platformId = platformId;

  try {
    const stats = await scheduleModel.aggregate([
      { $match: match },
      {
        $facet: {
          totalSchedules: [{ $count: "count" }],

          byPlatform: [
            { $group: { _id: "$platformId", count: { $sum: 1 } } },
            { $project: { platform: "$_id", count: 1, _id: 0 } },
          ],

          byRecurrence: [
            { $group: { _id: "$recurrence", count: { $sum: 1 } } },
            { $project: { recurrence: "$_id", count: 1, _id: 0 } },
          ],

          byStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { status: "$_id", count: 1, _id: 0 } },
          ],
        },
      },
      {
        $project: {
          totalSchedules: {
            $ifNull: [{ $arrayElemAt: ["$totalSchedules.count", 0] }, 0],
          },
          byPlatform: 1,
          byRecurrence: 1,
          byStatus: 1,
        },
      },
    ]);

    return stats[0];
  } catch (error) {
    return { message: "error while fetching the stats" };
  }
}
