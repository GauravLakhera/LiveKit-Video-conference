import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  fetchOlderMessagesFromMongo,
  getOlderPollsFromDB,
  getPollDetailsService
} from "../../services/message/messageService.js";
import messageModel from "../../models/message/message.js";

export const getOlderMessage = asyncHandler(async (req, res) => {
  const { scheduleId, occurrenceId, before, page = "1", limit = "50" } = req.query;

  if (!scheduleId || !occurrenceId) {
    return res.status(400).json({
      success: false,
      message: "scheduleId and occurrenceId are required",
    });
  }

  const parsedPage = Number.parseInt(page, 10);
  const parsedLimit = Number.parseInt(limit, 10);

  if (!Number.isFinite(parsedPage) || parsedPage <= 0) {
    return res.status(400).json({
      success: false,
      message: "page must be a positive integer",
    });
  }

  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return res.status(400).json({
      success: false,
      message: "limit must be a positive integer",
    });
  }

  const result = await fetchOlderMessagesFromMongo(
    scheduleId,
    occurrenceId,
    before ?? "",
    parsedPage,
    parsedLimit
  );

  if (result?.error) {
    return res.status(result.status ?? 400).json({
      success: false,
      message: result.error,
    });
  }

  return res.status(200).json({
    success: true,
    messages: result.data,
    pagination: result.pagination,
  });
});


export const getOlderPoll = asyncHandler(async (req, res) => {
  const { scheduleId, occurrenceId, skip = 0, limit = "10" } = req.query;

  if (!scheduleId || !occurrenceId) {
    return res.status(400).json({
      success: false,
      message: "scheduleId and occurrenceId are required",
    });
  }

  const parsedSkip = Number.parseInt(skip, 10);
  if (!Number.isFinite(parsedSkip) || parsedSkip < 0) {
    return res.status(400).json({
      success: false,
      message: "skip must be a non-negative integer",
    });
  }

  const parsedLimit = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
    return res.status(400).json({
      success: false,
      message: "limit must be a positive integer between 1 and 100",
    });
  }

  try {
    const result = await getOlderPollsFromDB(
      scheduleId,
      parsedSkip,
      parsedLimit
    );

    return res.status(200).json({
      success: true,
      data: result,
      pagination: {
        skip: parsedSkip,
        limit: parsedLimit,
        count: result.length,
      },
      message: "Polls fetched successfully",
    });
  } catch (error) {
    console.error("Error in getOlderPoll controller:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch polls",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export async function getPollDetails(req, res) {
  try {
    const { id: pollId } = req.params;

    const poll = await getPollDetailsService(pollId);

    return res.status(200).json({ success: true, poll });
  } catch (err) {
    console.error("❌ getPollDetails error:", err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to fetch poll details",
    });
  }
}