import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: { type: Number, default: 0 },
});

const voterSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    optionIndex: { type: Number, required: true },
    votedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const pollSchema = new mongoose.Schema(
  {
    scheduleId: { type: String, required: true, index: true },
    occurrenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "scheduleOccurrences",
    },
    question: { type: String, required: true },
    options: [optionSchema],
    createdBy: { type: String, required: true },
    votedUsers: { type: [voterSchema], default: [] }, 
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const pollModel = new mongoose.model("poll", pollSchema, "poll");

export default pollModel;
