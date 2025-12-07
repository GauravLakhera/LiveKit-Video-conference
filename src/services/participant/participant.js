import participantModel from "../../models/participant/participant.js";

export const checkParticipantExists = async (
  platformId,
  participantId,
  scheduleId
) => {
  const result = await participantModel.findOne({
    platformId,
    participantId,
    scheduleId,
  });
  return result;
};

export const addParticipant = async (data) => {
  const isExisting = await checkParticipantExists(
    data.platformId,
    data.participantId,
    data.scheduleId
  );

  if (isExisting) {
    return;
  }

  const result = await participantModel.create(data);
  return result;
};

export const fetchParticipantsBySchedule = async (scheduleId) => {
  const result = await participantModel
    .find({ scheduleId })
    .sort({ role: 1, participantName: 1 });
  return result;
};

export const fetchParticipant = async ({
  scheduleId,
  participantId,
  platformId,
}) => {
  const result = await participantModel.findOne({
    scheduleId,
    participantId,
    platformId,
  });
  return result;
};

export const updateParticipant = async (
  participantId,
  platformId,
  scheduleId,
  data
) => {
  const { status } = data;

  const allowedUpdates = {
    ...(status !== undefined && { status })
  };

  return await participantModel.findOneAndUpdate(
    {
      scheduleId,
      platformId,
      participantId
    },
    { $set: allowedUpdates },
    { new: true }
  );
};

export const deleteParticipant = async (
  platformId,
  participantId,
  scheduleId
) => {
  const result = await participantModel.findOneAndDelete({
    platformId,
    participantId,
    scheduleId,
  });
  return result;
};
