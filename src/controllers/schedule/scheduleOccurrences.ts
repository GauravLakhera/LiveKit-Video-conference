import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  fetchOccurrences,
  fetchOccurrence,
  fetchOccurrencesByGroup,
  fetchOccurrencesByParticipant,
  updateOccurrence,
  getOccurrenceStatsService,
  dayOccurrencesWithParticipantsService,
} from "../../services/schedule/scheduleOccurrences.js";
import mongoose from "mongoose";

//all occurrence for a host
export const getOccurrences = asyncHandler(
  async (req: Request, res: Response) => {
    const { scheduleId, platformId, hostId, type, todayDate } = req.query as {
      scheduleId: string;
      platformId: string;
      hostId: string;
      type?: "upcoming" | "today" | "past";
      todayDate?: string;
    };


    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "10", 10);

    if (!platformId || !hostId) {
      return res
        .status(400)
        .json({ status: false, message: "platformID & hostId are required." });
    }

    if (type && !todayDate) {
      return res.status(400).json({
        status: false,
        message:
          "todayDate in YYYY-mm-dd format is required with type parameter.",
      });
    }

    const { occurrences, totalCount } = await fetchOccurrences({
      scheduleId,
      platformId,
      hostId,
      todayDate,
      type,
      page,
      limit,
    });

    if (!occurrences || occurrences.length === 0) {
      return res.status(200).json({
        status: true,
        message: "No schedule occurrence found.",
        data: [],
        pagination: {
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
          pageSize: limit,
        },
      });
    }

    return res.status(200).json({
      status: true,
      message: "Schedule occurrence found.",
      data: occurrences,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        pageSize: limit,
      },
    });
  }
);


//single schedule occurrence
export const getOccurrence = asyncHandler(
  async (req: Request, res: Response) => {
    const { scheduleId, occurrenceId, platformId, hostId } = req.query as {
      scheduleId?: string;
      occurrenceId: string;
      platformId: string;
      hostId: string;
    };

    if (!scheduleId || !platformId || !hostId || !occurrenceId) {
      return res
        .status(400)
        .json({
          status: false,
          message:
            "scheduleId, platformID, hostId & occurrenceId are required.",
        });
    }

    if (!mongoose.Types.ObjectId.isValid(occurrenceId)) {
      return res
        .status(400)
        .json({
          status: false,
          message: "Invalid occurrenceId, please check and try again.",
        });
    }

    const occurrence = await fetchOccurrence({
      scheduleId,
      platformId,
      hostId,
      occurrenceId: new mongoose.Types.ObjectId(`${occurrenceId}`),
    });
    if (!occurrence) {
      return res
        .status(200)
        .json({
          status: true,
          message: "No schedule occurrence found.",
          data: [],
        });
    }

    return res
      .status(200)
      .json({
        status: true,
        message: "Schedule occurrence found.",
        data: occurrence,
      });
  }
);
export const updateOccurrenceController = asyncHandler(
  async (req: Request, res: Response) => {
    const { scheduleId, occurrenceId, platformId, hostId } = req.query as {
      scheduleId?: string;
      occurrenceId: string;
      platformId: string;
      hostId: string;
    };
    const { data } = req.body as { data: any };
    if (!scheduleId || !platformId || !hostId || !occurrenceId) {
      return res
        .status(400)
        .json({
          status: false,
          message:
            "scheduleId, platformID, hostId & occurrenceId are required.",
        });
    }
    if (!mongoose.Types.ObjectId.isValid(occurrenceId)) {
      return res
        .status(400)
        .json({
          status: false,
          message: "Invalid occurrenceId, please check and try again.",
        });
    }
    const occurrence = await updateOccurrence({
      scheduleId,
      occurrenceId: new mongoose.Types.ObjectId(`${occurrenceId}`),
      platformId,
      hostId,
      data,
    });
    if (!occurrence) {
      return res
        .status(200)
        .json({
          status: true,
          message: "No schedule occurrence found.",
          data: [],
        });
    }
    return res
      .status(200)
      .json({
        status: true,
        message: "Schedule occurrence updated successfully.",
        data: occurrence,
      });
  }
);
export const getOccurrencesByGroup = asyncHandler(
  async (req: Request, res: Response) => {
    const { platformId, hostId, group } = req.query as {
      platformId?: string;
      hostId?: string;
      group?: string;
    };

    if (!platformId) {
      return res
        .status(400)
        .json({ status: false, message: "platformId is required." });
    }

    const data = await fetchOccurrencesByGroup({
      platformId,
      hostId, // optional
      group, // optional
    });

    return res.status(200).json({
      status: true,
      message: "Occurrences fetched successfully",
      data,
    });
  }
);
export const getOccurrencesByParticipant = asyncHandler(
  async (req: Request, res: Response) => {
    const { platformId, participantId, type, todayDate } = req.query as {
      platformId?: string;
      participantId?: string;
      type?: "today" | "upcoming" | "past";
      todayDate?: string;
    };

    if (!platformId) {
      return res
        .status(400)
        .json({ status: false, message: "platformId is required." });
    }
    if (!participantId) {
      return res
        .status(400)
        .json({ status: false, message: "participantId is required." });
    }
    if (type && !todayDate) {
      return res.status(400).json({
        status: false,
        message: "todayDate in YYYY-MM-DD is required when type is provided.",
      });
    }

    const data = await fetchOccurrencesByParticipant({
      platformId,
      participantId,
      type,
      todayDate,
    });

    return res.status(200).json({
      status: true,
      message: "Occurrences by participant fetched successfully",
      data,
    });
  }
);


export const getOccurrenceStats = asyncHandler(async (req: Request, res: Response) => {
  const { platformId } = req.query as { platformId: string } // optional filter

  const stats = await getOccurrenceStatsService(platformId);

  res.status(200).json({
    success: true,
    data: stats
  });
});


export const getDayOccurrencesWithParticipants = asyncHandler(async (req: Request, res: Response) => {
  const occurrences = await dayOccurrencesWithParticipantsService()

  if (!Array.isArray(occurrences) || occurrences.length === 0) {
    return res.status(200).json({ success: true, message: "No meeting occurrences found." })
  }

  return res.status(200).json({
    success: true,
    data: occurrences,
    message: "Meeting occurrences found."
  })
}) 