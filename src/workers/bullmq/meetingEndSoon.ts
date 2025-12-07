// meetingEndingSoonWorker.js
import { Worker } from "bullmq";
import bullmqConnection from "../../configs/bullmq.js";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL ?? "redis://default@127.0.0.1:6379";


const pub = createClient({ url: redisUrl });
await pub.connect();

// Worker for notifying 15 minutes before meeting end
const worker = new Worker(
  "meetingEndingSoon",
  async (job) => {
    console.log(`⚠️ Reminder Job started at ${new Date().toISOString()}`);
    console.log("Job data:", job.data);

    // Publish reminder event
    await pub.publish(
      "meeting-events",
      JSON.stringify({
        type: "meetingEndingSoon",
        ...job.data,
        message: "Meeting will end in 15 minutes!",
      })
    );
  },
  { connection: bullmqConnection }
);

worker.on("completed", (job) => {
  console.log(`✅ Reminder Job ${job.id} completed.`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Reminder Job ${job?.id} failed:`, err);
});

export default worker;
