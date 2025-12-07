import { Request, Response } from "express";
import {asyncHandler} from "../../utils/asyncHandler.js";
import { getRecordingsBySchedule } from "../../services/recording/recording.js";


export const getRecordingsByScheduleController = asyncHandler(
  async (req: Request, res: Response) => {
    const { scheduleId, platformId } = req.query as {
      scheduleId?: string;
      platformId?: string;
    };

    

    const recordings = await getRecordingsBySchedule(scheduleId, platformId);

    return res.status(200).json({
      status: true,
      count: recordings.length,
      data: recordings,
    });
  }
);
