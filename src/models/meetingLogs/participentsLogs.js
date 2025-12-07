import mongoose from "mongoose";

const participantLogSchema = new mongoose.Schema(
  {
    platformId: {
      type: String,
      required: [true, "Platform ID is required"],
      index: true,
    },
    scheduleId: {
      type: String,
      required: [true, "Schedule id required"],
    },
    occurrenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "scheduleOccurrences",
    },
    participantId: {
      type: String,
      required: [true, "participantID is required"],
      index: true,
    },
    participantName: {
      type: String,
      required: [true, "participantName is required"],
      trim: true,
    },
    role: {
      type: String,
      enum: ["host", "coHost", "speaker", "viewer", "participant"],
      required: [true, "Role is required"],
    },
    event: {
      type: String,
      enum: ["joined", "left", "kicked"],
      required: [true, "Event type is required"],
    },
    joinTime: { type: Date, required: true },
    leaveTime: { type: Date },
    duration: { type: Number },
  },
  {
    timestamps: true,
  }
);

participantLogSchema.index({ platformId: 1, participantId: 1, scheduleId: 1 });

const participantLogModel = mongoose.model(
  "ParticipantLog",
  participantLogSchema
);

export default participantLogModel;
