import mongoose from 'mongoose'
import { nanoid } from 'nanoid'

const scheduleSchema = new mongoose.Schema({
    scheduleId: {
        type: String,
        required: true,
        default: () => nanoid(10)
    }, // Unique schedule identifier

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
                role: {type: String, enum: ["host", "coHost"], required: true}
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

    // Recurrence base pattern
    startDate: { type: Date, required: true },   // first day recurrence starts
    endDate: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true,
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid startTime format"]
    },
    endTime: {
        type: String,
        required: true,
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid endTime format"]
    },   // "HH:mm" format
    timeZone: { type: String, default: "Asia/Kolkata" },

    // Room configuration
    settings: {
        type: {
            requireApproval: { type: Boolean, default: false }
        },
        default: {}   // 👈 ensures `settings` is never undefined
    },

    // Status of the master schedule (not occurrences)
    status: {
        type: String,
        enum: ["active", "inactive", "cancelled", "completed"],
        default: "active"
    },

    // Recurrence settings
    recurrence: {
        type: String,
        enum: ["none", "daily", "custom"],
        required: true
    },

    // For "custom" recurrence (days of week)
    daysOfWeek: {
        type: [Number], // 0=Sunday ... 6=Saturday
        default: [],
        validate: {
            validator: arr => arr.every(d => d >= 0 && d <= 6),
            message: "daysOfWeek must be between 0 (Sunday) and 6 (Saturday)"
        }
    }

}, { timestamps: true })

// Indexes for querying schedules
scheduleSchema.index({ platformId: 1, scheduleId: 1 }, { unique: true })
scheduleSchema.index({ platformId: 1, "hosts.hostId": 1, status: 1 })
scheduleSchema.index({ platformId: 1, status: 1 })

scheduleSchema.pre("validate", function (next) {
    if (!this.endTime && this.startTime) {
        const [hours, minutes] = this.startTime.split(":").map(Number);
        const end = new Date();
        end.setHours(hours + 2, minutes, 0, 0);

        // format as "HH:mm" in local 24-hour
        this.endTime = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
    }

    if (!this.endDate) {
        this.endDate = this.startDate
    }

    if (this.endDate && this.startDate && this.endDate < this.startDate) {
        return next(new Error("endDate cannot be before startDate"));
    }

    if (!this.recurrence) {
        if (this.daysOfWeek?.length > 0) {
            this.recurrence = "custom";
        } else if (this.endDate && this.endDate.getTime() !== this.startDate.getTime()) {
            this.recurrence = "daily";
        } else {
            this.recurrence = "none";
        }
    }


    if (this.recurrence === "custom" && (!this.daysOfWeek || this.daysOfWeek.length === 0)) {
        return next(new Error("daysOfWeek required for custom recurrence"));
    }
    if (this.recurrence === "daily" && this.daysOfWeek.length > 0) {
        return next(new Error("daysOfWeek must be empty for daily recurrence"));
    }

    next();
});

if (mongoose.models.schedules) {
    delete mongoose.models.schedules;
}


const scheduleModel = mongoose.model("schedules", scheduleSchema, "schedules")

export default scheduleModel
