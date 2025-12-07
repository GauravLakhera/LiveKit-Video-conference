import { fromZonedTime } from "date-fns-tz";
import { parse, isBefore, isAfter, addDays,differenceInDays, parseISO  } from "date-fns";

// type TimeString = `${number extends infer H ? H : never}:${number extends infer M ? M : never}`;

export const generateUTCDate = (
  {
    date,
    time,
    timeZone,
    compareWith, // optional: a "start" date to compare against
  }: {
    date: Date;
    time: string;
    timeZone: string;
    compareWith?: Date; // if provided, used to detect if we need to roll over to next day
  }
): Date => {
  // Validate time format
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    throw new Error(`Invalid time format: ${time}. Expected HH:mm or HH:mm:ss`);
  }

  // Always normalize to HH:mm:ss
  const normalizedTime = time.length === 5 ? `${time}:00` : time;

  // Local datetime string
  const localDate = `${date.toISOString().split("T")[0]}T${normalizedTime}`;
  let result = fromZonedTime(localDate, timeZone);

  // 🕒 Handle midnight rollover
  if (compareWith && result <= compareWith) {
    result = addDays(result, 1);
  }

  return result;
};

export function dateDiffInDays(startDate: string | Date, endDate: string | Date): number {
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate; // parses "YYYY-MM-DD" safely
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate;
  // console.log('dateDiff', start, end)
  return differenceInDays(end, start);
}


export function compareTime(time1: string, time2: string): number {
  const t1 = parse(time1, "HH:mm", new Date());
  const t2 = parse(time2, "HH:mm", new Date());

  if (isBefore(t1, t2)) return -1;
  if (isAfter(t1, t2)) return 1;
  return 0;
}


export function isPastDateTime(date: Date, time: string, timeZone: string): boolean {
  const target = generateUTCDate({ date, time, timeZone });
  return isBefore(target, new Date());
}
