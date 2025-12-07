import { Queue, Worker } from "bullmq";
import bullmqConnection from "../../configs/bullmq.js";

// Create a queue
const meetingQueue = new Queue("meetingEnded", {
  connection: bullmqConnection,
});
const meetingEndingSoonQueue = new Queue("meetingEndingSoon", {
  connection: bullmqConnection,
});

export async function scheduleJobAt(
  targetTime: Date,
  payload: { platformId: string; scheduleId: string; occurrenceId: string }
) {
  const delay = Number(targetTime) - Number(new Date());

  if (delay < 0) throw new Error("Scheduled time is in the past!");

  await meetingQueue.add(
    "endMeetingJob",
    payload, 
    { delay }
  );

  console.log(`Job scheduled for ${targetTime}`);
  const reminderDelay = delay - 15 * 60 * 1000; 
  if (reminderDelay > 10) {
    await meetingEndingSoonQueue.add("reminderJob", payload, {
      delay: reminderDelay,
    });
    console.log(
      `⚠️ Reminder job scheduled 15 min before: ${new Date(
        Number(targetTime) - 15 * 60 * 1000
      )}`
    );
  } else {
    console.log("⚠️ Too close to meeting end, reminder not scheduled.");
  }
}



// Example usage:
// const payload = {platformId: "miskills", scheduleId: "sid1", occurrenceId: "oid1"}
// const runAt = new Date(Date.now() + 15_000); // 10 seconds from now

// scheduleJobAt(runAt, payload);
