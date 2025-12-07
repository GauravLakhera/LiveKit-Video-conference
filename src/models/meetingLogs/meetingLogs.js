import mongoose from "mongoose";

const meetingLogSchema = new mongoose.Schema(
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
    hostId: {
      type: String,
      required: [true, "Host ID is required"],
      index: true,
    },
    hostName: {
      type: String,
      required: [true, "Host Name is required"],
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number, // in minutes
    },
  },
  {
    timestamps: true,
  }
);

meetingLogSchema.index({ platformId: 1, meetingId: 1 });
meetingLogSchema.index({ hostId: 1, startTime: -1 });

const meetingLogModel = new mongoose.model(
  "meetingLog",
  meetingLogSchema,
  "meetingLog"
);

export default meetingLogModel;
