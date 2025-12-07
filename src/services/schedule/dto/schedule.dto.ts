export interface ScheduleDTO {
    scheduleId: string;
    platformId: string;
    hostId: string;
    hostName: string;
    hosts: { hostId: string; hostName: string; role: "host" | "coHost" }[];
    group: string;
    groupId: string;
    title: string;
    startDate: Date | string;
    startTime: string;
    endDate?: Date | string;
    endTime?: string;
    description?: string;
    isPrivate?: boolean;
    status?: "active" | "inactive" | "cancelled" | "completed"
    recurrence?: string;
    daysOfWeek?: number[]
}


export interface CreateScheduleDTO {
    platformId: string;
    hostId: string;
    hostName: string;
    hosts: { hostId: string; hostName: string; role: "host" | "coHost" }[];
    group: string;
    groupId: string;
    title: string;
    startDate: Date | string;
    startTime: string;
    endDate?: Date | string;
    endTime?: string;
    description?: string;
    isPrivate?: boolean;
    status?: "active" | "inactive" | "cancelled" | "completed"
    recurrence?: string;
    daysOfWeek?: number[];
    timeZone?: string;
}



export interface UpdateScheduleDTO {
    hosts?: { hostId?: string; hostName?: string; role: "host" | "coHost" }[];
    group?: string;
    groupId: string;
    title?: string;
    description?: string;
    startDate?: Date | string;
    startTime?: string;
    endDate?: Date | string;
    endTime?: string;
    isPrivate?: boolean;
    status?: "active" | "inactive" | "cancelled" | "completed"
    recurrence?: "custom" | "daily" | "none";
    daysOfWeek?: number[];
    oldStartDate?: Date
}