import mongoose from 'mongoose'
import { nanoid } from 'nanoid'

const scheduleOccurrenceSchema = new mongoose.Schema({
    scheduleId: {
        type: String,
        required: [true, 'schedule id is required'],
    }, // schedule identifier

    platformId: {
        type: String,
        required: true
    },

    // Primary host (owner/creator of the schedule)
    hostId: {
        type: String,
        required: true
    },

    hostName: {
        type: String,
        required: true
    },

    // All hosts (including co-hosts)
    hosts: {
        type: [
            {
                hostId: { type: String, required: true },
                hostName: { type: String, required: true },
                role: { type: String, enum: ["host", "coHost"], required: true }
            }
        ],
        validate: {
            validator: function (arr) {
                const keys = arr.map(h => `${h.hostId}`);
                return keys.length === new Set(keys).size; // prevent duplicates
            },
            message: "Duplicate hostId found in hosts array"
        },
        default: []
    },

    group: {
        type: String,
        required: true,
    },

    groupId: {
        type: String,
        required: true,
    },

    title: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        default: ""
    },

    // Visibility
    isPrivate: {
        type: Boolean,
        default: true
    },

    // Status of the master schedule (not occurrences)
    status: {
        type: String,
        enum: ["scheduled", "live", "ended", "cancelled"],
        default: "scheduled"
    },


    startDateTime: {
        type: Date,
        required: [true, 'Start Date Time is required (UTC)']
    },
    endDateTime: {
        type: Date,
        required: [true, 'End Date Time is required (UTC)']
    }


}, { timestamps: true })

// Indexes for querying schedule occurrences
scheduleOccurrenceSchema.index({ platformId: 1, scheduleId: 1 })
scheduleOccurrenceSchema.index({ platformId: 1, "hosts.hostId": 1, status: 1 })
scheduleOccurrenceSchema.index({ platformId: 1, status: 1 })
scheduleOccurrenceSchema.index({ scheduleId: 1, startDateTime: 1 }, { unique: true })

const scheduleOccurrenceModel = mongoose.model("scheduleOccurrences", scheduleOccurrenceSchema, "scheduleOccurrences")

export default scheduleOccurrenceModel
