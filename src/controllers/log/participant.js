// controllers/participantsLogController.js
import { fetchAllParticipantSessions } from "../../services/log/participantsLog.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const getParticipantLogDetail = asyncHandler(async (req, res) => {
  const { scheduleId, platformId, occurrenceId, page = 1, limit = 10 } = req.query;

  if (!scheduleId || !platformId || !occurrenceId) {
    return res.status(400).json({
      status: false,
      message: "scheduleId, platformId and occurrenceId are required.",
    });
  }

  const result = await fetchAllParticipantSessions(platformId, scheduleId, occurrenceId, parseInt(page), parseInt(limit));

  return res.status(200).json({
    status: true,
    message: "Participant logs fetched successfully",
    data: result.participants,
    pagination: result.pagination,
  });
});



export const getParticipantAttendance = asyncHandler(async (req, res) => {
  const { scheduleId, platformId, occurrenceId, page = 1, limit = 10 } = req.query;

  if (!scheduleId || !platformId || !occurrenceId) {
    return res.status(400).json({
      status: false,
      message: "scheduleId, platformId and occurrenceId are required.",
    });
  }

  const result = await fetchAllParticipantSessions(platformId, scheduleId, occurrenceId, parseInt(page), parseInt(limit));

  return res.status(200).json({
    status: true,
    message: "Participant logs fetched successfully",
    data: result.participants,
    pagination: result.pagination,
  });
});

