import mongoose from 'mongoose'

const participantSchema = new mongoose.Schema({
    scheduleId: {
        type: String,
        required: [true, "Schedule ID is required."],
    }, // Unique room identifier (indexed)

    platformId: {
        type: String,
        required: true
    },

    participantId: {
        type: String,
        required: true
    },

    participantName: {
        type: String,
        required: true
    },

    role: {
        type: String,
        enum: ["host", "coHost", "speaker", "viewer", "participant"],
        default: "participant",
        required: true,
    },
    status: {
        type: String,
        enum: ["active", "inactive", "ban"],
        default: "active"
    }


}, { timestamps: true })

participantSchema.index({ platformId: 1, scheduleId: 1, participantId: 1 }, { unique: true })

const participantModel = new mongoose.model("participants", participantSchema, "participants")

export default participantModel