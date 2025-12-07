import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  addParticipant,
  fetchParticipantsBySchedule,
  deleteParticipant,
  updateParticipant
} from "../../services/participant/participant.js";
import { fetchSchedule } from "../../services/schedule/schedule.js";

export const getParticipantsBySchedule = asyncHandler(async (req, res) => {
  const { scheduleId, platformId, hostId } = req.query;

  if (!scheduleId || !platformId || !hostId) {
    return res
      .status(400)
      .json({
        status: false,
        message: "scheduleId, hostId & participantId are required.",
      });
  }

  const schedule = await fetchSchedule(scheduleId, platformId, hostId);

  if (!schedule) {
    return res
      .status(400)
      .json({
        status: false,
        message:
          "Schedule for this host & platform does not exist, please check combination of IDs you sent.",
      });
  }

  const result = await fetchParticipantsBySchedule(scheduleId);
  if (result.length <= 0) {
    return res
      .status(200)
      .json({ status: true, message: "No Participants found.", data: [] });
  }

  return res
    .status(200)
    .json({ status: true, message: "Participants Found.", data: result });
});

export const createParticipant = asyncHandler(async (req, res) => {
  const role = req?.body?.role || "participant";
  const { platformId, participantId, participantName, scheduleId } = req.body;

  if (!platformId || !participantId || !participantName || !scheduleId) {
    return res
      .status(400)
      .json({
        status: false,
        message:
          "Platform ID , Participant ID, Participant Name & Schedule ID are required.",
      });
  }

  const participant = {
    platformId,
    participantId,
    participantName,
    scheduleId,
    role: role,
  };

  const result = await addParticipant(participant);

  if (result) {
    return res
      .status(201)
      .json({
        message: `Participant Added for schedule ${scheduleId} `,
        data: result,
      });
  } else {
    res
      .status(400)
      .json({
        status: false,
        message: `Participant already exists in schedule id: ${scheduleId}`,
      });
  }
});

export const updateParticipantController = asyncHandler(async (req, res) => {
  const { platformId, participantId, scheduleId, data } = req.body;

  if (!platformId || !participantId || !scheduleId) {
    return res.status(400).json({
      status: false,
      message: "Platform ID, Participant ID & Schedule ID are required.",
    });
  }

  const result = await updateParticipant(participantId, platformId, scheduleId, data);

  if (result) {
    return res.status(200).json({
      status: true,
      message: `Participant with ID: ${participantId} has been updated in schedule ID: ${scheduleId}`,
      data: result,
    });
  } else {
    return res.status(400).json({
      status: false,
      message: "Failed to update participant. Please check the IDs and try again.",
    });
  }
});




export const deleteParticipantController = asyncHandler(async (req, res) => {
  const { platformId, participantId, scheduleId } = req.params;

  if (!platformId || !participantId || !scheduleId) {
    return res.status(400).json({
      status: false,
      message: "Platform ID, Participant ID & Schedule ID are required.",
    });
  }

  const result = await deleteParticipant(platformId, participantId, scheduleId);

  if (result) {
    return res.status(200).json({
      status: true,
      message: `Participant with ID: ${participantId} has been removed from schedule ID: ${scheduleId}`,
      data: result,
    });
  } else {
    return res.status(400).json({
      status: false,
      message:
        "Failed to remove participant. Please check the IDs and try again.",
    });
  }
});
