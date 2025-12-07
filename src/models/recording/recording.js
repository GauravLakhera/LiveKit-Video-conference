import mongoose from 'mongoose'

const recordingSchema = new mongoose.Schema({
    platformId: {
        type: String,
        required: [true, "platformId is required"]
    },
    hostId: {
        type: String,
        required: [true, "hostId is required"]
    },
    scheduleId: {
        type: String,
        required: [true, "scheduleId is required"]
    },
    occurrenceId: {
        type: String,
        required: [true, "occurrenceId is required"]
    },
    url: {
        type: String,
        required: [true, "URL is required"]
    },
    meta: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    }
}, {timestamps: true})


const recordingModel = mongoose.model("recordings", recordingSchema, "recordings")

export default recordingModel