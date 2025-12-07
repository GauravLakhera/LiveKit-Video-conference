import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    scheduleId: { type: String, required: true, index: true },
    occurrenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "scheduleOccurrences",
    },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String },
    text: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    timeStamp: { type: Number , index: true},
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  {
    versionKey: false,
    timestamps: { createdAt: true, updatedAt: true },
  }
);

MessageSchema.index({ scheduleId: 1, createdAt: -1 });

const messageModel = mongoose.model("message", MessageSchema, "message");
export default messageModel;
