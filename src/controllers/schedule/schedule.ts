import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  addSchedule,
  fetchSchedules,
  fetchAllSchedules,
  fetchSchedule,
  scheduleUpdate,
  deleteScheduleService,
  searchScheduleService,
  getScheduleStatsService,
} from "../../services/schedule/schedule.js";
import { Request, Response } from "express";
import {
  CreateScheduleDTO,
  UpdateScheduleDTO,
} from "../../services/schedule/dto/schedule.dto.js";
import {
  createOccurrence,
  createOccurrencesFromSchedule,
  fetchOccurrencesByGroup,
} from "../../services/schedule/scheduleOccurrences.js";
import { ScheduleOccurrenceDTO } from "../../services/schedule/dto/scheduleOccurrence.dto.js";
import {
  compareTime,
  dateDiffInDays,
  generateUTCDate,
  isPastDateTime,
} from "../../utils/schedule/schedule.js";
import { differenceInMinutes, isBefore, isWithinInterval } from "date-fns";

export const getSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { scheduleId } = req.params;
  const { platformId, hostId } = req.query as {
    platformId: string;
    hostId: string;
  };

  if (!scheduleId || !platformId || !hostId) {
    return res.status(400).json({
      status: false,
      message: "scheduleId, platformID & hostId are required.",
    });
  }

  const result = await fetchSchedule(scheduleId, platformId, hostId);
  if (!result) {
    return res
      .status(200)
      .json({ status: true, message: "No schedule found.", data: [] });
  }

  return res
    .status(200)
    .json({ status: true, message: "Schedule found.", data: result });
});

export const getSchedules = asyncHandler(
  async (req: Request, res: Response) => {
    const { platformId, hostId } = req.query as {
      platformId: string;
      hostId: string;
    };
    const pageParam = req?.query?.page as string | undefined;
    const limitParam = req?.query?.limit as string | undefined;

    if (!platformId || !hostId) {
      return res.status(400).json({
        status: false,
        message: "Platform ID & Host ID are required.",
      });
    }

    const page =
      pageParam && !isNaN(Number(pageParam)) && Number(pageParam) > 0
        ? Number(pageParam)
        : 1;

    const limit =
      limitParam && !isNaN(Number(limitParam)) && Number(limitParam) > 0
        ? Number(limitParam)
        : 25;

    const skip = (page - 1) * limit;

    const result = await fetchSchedules(platformId, hostId, skip, limit);

    if (!result.schedules || result.schedules.length === 0) {
      return res.status(200).json({
        status: true,
        message: "No schedules found.",
        data: [],
        pagination: result.pagination,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Schedules found.",
      data: result.schedules,
      pagination: result.pagination,
    });
  }
);

export const getAllSchedules = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const pageParam = req?.query?.page as string | undefined;
      const limitParam = req?.query?.limit as string | undefined;
      const platformId = req?.query?.platformId as string | undefined;

      if (!platformId) {
        return res.status(400).json({
          status: false,
          message: "Platform ID is required.",
        });
      }

const page =
  pageParam && !isNaN(Number(pageParam)) && Number(pageParam) > 0
    ? Number(pageParam)
    : 1; 

const limit =
  limitParam && !isNaN(Number(limitParam)) && Number(limitParam) > 0
    ? Number(limitParam)
    : 25;

const skip = (page - 1) * limit; 
      const result = await fetchAllSchedules(skip, limit, platformId);
      // console.log(result);
      if (!result || result.schedules.length === 0) {
        return res.status(200).json({
          status: true,
          message: "No schedules found.",
          data: [],
          pagination: result?.pagination || null,
        });
      }

      return res.status(200).json({
        status: true,
        message: "Schedules found.",
        data: result.schedules,
        pagination: result.pagination,
      });
    } catch (error: any) {
      return res.status(500).json({
        status: false,
        message: "Error fetching schedules.",
        error: error.message,
      });
    }
  }
);

export const createSchedule = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      platformId,
      hostId,
      hostName,
      group,
      groupId,
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      hosts,
      recurrence,
      daysOfWeek,
      timeZone,
    } = req.body as CreateScheduleDTO;

    if (
      !platformId ||
      !hostId ||
      !hostName ||
      !group ||
      !groupId ||
      !title ||
      !startTime ||
      !startDate
    ) {
      return res.status(400).json({
        status: false,
        message:
          "Platform ID, Host ID, Host Name, group, groupId, title, startDate & startTime are required.",
      });
    }

    if (
      isPastDateTime(new Date(startDate), startTime, timeZone ?? "Asia/Kolkata")
    ) {
      return res.status(400).json({
        status: false,
        message: "Start date/time must be now or in the future.",
      });
    }

    const finalEndDate = !endDate ? startDate : endDate;

    let dateDiff =
      startDate && finalEndDate ? dateDiffInDays(startDate, finalEndDate) : 0;

    if (dateDiff < 0) {
      return res
        .status(400)
        .json({ status: false, message: "endDate cannot be before startDate" });
    }

    if (startDate === finalEndDate && startTime && endTime) {
      if (compareTime(endTime, startTime) <= 0) {
        return res.status(400).json({
          status: false,
          message:
            "endTime must be after startTime, as endDate defaults to startDate if not given.",
        });
      }
    }

    if (startTime && endTime) {
      const startDateTime = generateUTCDate({
        date: new Date(startDate),
        time: startTime,
        timeZone: "Asia/Kolkata", // or from req.body / schedule if dynamic
      });

      if (isBefore(startDateTime, new Date())) {
        return res.status(400).json({
          status: false,
          message: "Start date/time must be now or in the future.",
        });
      }

      const endDateTime = generateUTCDate({
        date: new Date(startDate), // always use startDate (even if multi-day)
        time: endTime,
        timeZone: "Asia/Kolkata",
        compareWith: startDateTime, // ensures rollover if needed
      });

      const durationMinutes = differenceInMinutes(endDateTime, startDateTime);

      if (durationMinutes > 120) {
        return res.status(400).json({
          status: false,
          message: "Meeting duration cannot exceed 2 hours.",
        });
      }
    }

    let finalRecurrence = recurrence;
    if (!finalRecurrence) {
      if (
        Array.isArray(daysOfWeek) &&
        daysOfWeek.length > 0 &&
        finalEndDate &&
        dateDiff >= 7
      ) {
        finalRecurrence = "custom";
      } else if (finalEndDate && finalEndDate !== startDate) {
        finalRecurrence = "daily";
      } else {
        finalRecurrence = "none";
      }
    }

    if (
      finalRecurrence === "custom" &&
      startDate &&
      finalEndDate &&
      dateDiff < 7
    ) {
      return res.status(400).json({
        status: false,
        message:
          "custom recurrence needs endDate to be atleast 7 days after startDate.",
      });
    }

    if (
      finalRecurrence === "custom" &&
      (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0)
    ) {
      return res.status(400).json({
        status: false,
        message:
          "custom recurrence requires non-empty daysOfWeek array (0=Sun..6=Sat)",
      });
    }
    if (["custom", "daily"].includes(finalRecurrence) && !finalEndDate) {
      return res.status(400).json({
        status: false,
        message: "daily/custom recurrence required endDate.",
      });
    }

    if (
      finalRecurrence !== "custom" &&
      Array.isArray(daysOfWeek) &&
      daysOfWeek.length > 0
    ) {
      return res.status(400).json({
        status: false,
        message:
          "recurrence cannot be daily/none if daysOfWeek is given, please change it to custom.",
      });
    }

    if (daysOfWeek && !finalEndDate) {
      return res.status(400).json({
        status: false,
        message: "endDate is required with daysOfWeek.",
      });
    }

    if (startDate === finalEndDate && finalRecurrence !== "none") {
      return res.status(400).json({
        status: false,
        message: "recurrence needs to be 'none' if startDate === endDate",
      });
    }

    type Host = { hostId: string; hostName: string; role: "host" | "coHost" };

    // Ensure the main host is always included in hosts array
    const allHosts: Host[] = [
      { hostId, hostName, role: "host" },
      ...(hosts || []).map((h) => ({
        hostId: h.hostId,
        hostName: h.hostName,
        role: (h.role === "host" || h.role === "coHost" ? h.role : "coHost") as
          | "host"
          | "coHost",
      })),
    ];

    // Deduplicate by hostId
    const uniqueHosts: Host[] = Array.from(
      new Map(allHosts.map((h) => [h.hostId, h])).values()
    );

    const schedule: CreateScheduleDTO = {
      platformId,
      hostId,
      hostName,
      group,
      groupId,
      title,
      description,
      startDate,
      endDate: finalEndDate,
      startTime,
      endTime,
      hosts: uniqueHosts,
      recurrence: finalRecurrence,
      daysOfWeek,
      timeZone,
    };

    const newSchedule = await addSchedule(schedule);
    let occurrences;

    if (newSchedule) {
      if (newSchedule?.recurrence === "none") {
        const startDateTime = generateUTCDate({
          date: newSchedule.startDate,
          time: newSchedule.startTime,
          timeZone: newSchedule.timeZone,
        });
        const endDateTime = generateUTCDate({
          date: newSchedule.startDate,
          time: newSchedule.endTime!,
          timeZone: newSchedule.timeZone,
          compareWith: startDateTime,
        });

        const scheduleOccurenceDTO: ScheduleOccurrenceDTO = {
          scheduleId: newSchedule.scheduleId,
          platformId: newSchedule.platformId,
          hostId: newSchedule.hostId,
          hostName: newSchedule.hostName,
          hosts: newSchedule.hosts,
          group: newSchedule.group,
          groupId: newSchedule.groupId,
          title: newSchedule.title,
          startDateTime: startDateTime,
          endDateTime: endDateTime,
          description: newSchedule.description,
          isPrivate: newSchedule.isPrivate,
        };

        occurrences = await createOccurrence(scheduleOccurenceDTO);
      } else {
        occurrences = await createOccurrencesFromSchedule(newSchedule);
      }
    }

    if (!newSchedule) {
      return res
        .status(400)
        .json({ status: false, message: "Schedule already exists" });
    }
    if (!occurrences) {
      return res
        .status(500)
        .json({ status: false, message: "Failed to generate occurrences" });
    }

    return res.status(201).json({
      message: "Meeting Scheduled",
      data: newSchedule,
      occurrences: occurrences,
    });
  }
);

export const updateSchedule = asyncHandler(
  async (req: Request, res: Response) => {
    const { scheduleId } = req.params;
    const { platformId, hostId, ...rawData } = req.body;

    // 🔹 Basic required fields check
    if (!scheduleId || !platformId || !hostId) {
      return res.status(400).json({
        status: false,
        message:
          "scheduleId, platformId & hostId are required to update a schedule",
      });
    }

    // 🔹 Whitelist fields (syntactic validation only)
    const {
      group,
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      hosts,
      status,
      recurrence,
      daysOfWeek,
    } = rawData;

    const updateData: UpdateScheduleDTO = {
      ...(group && { group }),
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(hosts && { hosts }),
      ...(status && { status }),
      ...(recurrence && { recurrence }),
      ...(daysOfWeek && { daysOfWeek }),
    };

    // 🔹 Call service (all business validation & DB ops inside)
    const updatedSchedule = await scheduleUpdate(
      scheduleId,
      platformId,
      hostId,
      updateData
    );

    if (!updatedSchedule.status) {
      // console.log(updatedSchedule);
      return res.status(400).json({
        status: false,
        message: updatedSchedule.message,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Schedule & it's occurrences updated successfully",
      data: updatedSchedule.schedule,
      occurrences: updatedSchedule.occurrences,
    });
  }
);

export const deleteSchedule = asyncHandler(
  async (req: Request, res: Response) => {
    const { scheduleId } = req.params as { scheduleId: string };
    const { platformId, hostId } = req.query as {
      platformId: string;
      hostId: string;
      scheduleId: string;
    };

    if (!platformId || !hostId || !scheduleId) {
      return res.status(400).json({
        status: false,
        message: "platformId, hostId & scheduleId are required.",
      });
    }

    const result = await deleteScheduleService(platformId, hostId, scheduleId);

    if (!result.success) {
      return res.status(404).json({ status: false, message: result.message });
    }

    return res.status(200).json({ status: true, message: result.message });
  }
);

export const searchSchedule = asyncHandler(
  async (req: Request, res: Response) => {
    const { searchParam } = req.query;

    if (!searchParam || typeof searchParam !== "string") {
      return res.status(400).json({ message: "searchParam is required" });
    }

    const schedules = await searchScheduleService(searchParam);

    return res.status(200).json({
      count: schedules.length,
      schedules,
    });
  }
);

export const getScheduleStats = asyncHandler(
  async (req: Request, res: Response) => {
    const { platformId } = req.query as { platformId: string };

    const stats = await getScheduleStatsService(platformId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  }
);
