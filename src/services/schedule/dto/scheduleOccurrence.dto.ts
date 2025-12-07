export interface ScheduleOccurrenceDTO {
    scheduleId: string;
    platformId: string;
    hostId: string;
    hostName: string;
    hosts: { hostId: string; hostName: string; role: "host" | "coHost" }[];
    group: string;
    groupId: string;
    title: string;
    startDateTime: Date | string;
    endDateTime: Date | string;
    description: string;   // <- not optional
    isPrivate: boolean;    // <- not optional, you also set default true in schema
    status?: "scheduled" | "live" | "ended" | "cancelled";
}


export interface UpdateScheduleOccurrenceDTO {
  group?: string;
  groupId: string;
  title?: string;
  description?: string;
  hosts?: { hostId: string; hostName: string; role: "host" | "coHost" }[];
  isPrivate?: boolean;
  status?: "scheduled" | "live" | "ended" | "cancelled";
  startDateTime?: string;
  endDateTime?: string;
  recurrence?: string;
  daysOfWeek?: number[];
  repeatUntil?: string;
}




export interface IfetchOccurrences {
  platformId: string;
  hostId: string;
  scheduleId?: string;
  todayDate?: string;
  type?: "upcoming" | "today" | "past";
  startDateTime?: {};
  endDateTime?: {};
}