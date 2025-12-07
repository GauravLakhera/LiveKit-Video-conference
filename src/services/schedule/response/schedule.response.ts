import mongoose from "mongoose";

export interface ScheduleSummary {
  _id: mongoose.Types.ObjectId; // Mongo ObjectId as string
  scheduleId: string;
  platformId: string;

  hostId: string;
  hostName: string;
  hosts: { hostId: string; hostName: string; role: "host" | "coHost" }[];

  group: string;
  groupId: string;

  title: string;
  description: string;

  isPrivate: boolean;

  startDate: Date;
  endDate?: Date | null | undefined;
  startTime: string;
  endTime?: string | null | undefined;
  timeZone: string;

  settings: {
    requireApproval: boolean;
  };

  status: "active" | "inactive" | "cancelled" | "completed";
  recurrence: "none" | "daily" | "custom";
  daysOfWeek: number[];

  createdAt: NativeDate;
  updatedAt: NativeDate;
}
