// worker.js
import { Worker } from "bullmq";
import bullmqConnection from "../../configs/bullmq.js";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL ?? "redis://default@127.0.0.1:6379";

const pub = createClient({ url: redisUrl }); // adjust if external
await pub.connect();


// Worker that processes jobs
const worker = new Worker(
  "meetingEnded",
  async (job) => {
    console.log(`Job started at ${new Date().toISOString()}`);
    console.log("Job data:", job.data);



    // Publish instead of emitting directly
    await pub.publish("meeting-events", JSON.stringify({
      type: "meetingEnded",
      ...job.data
    }));

  },
  { connection: bullmqConnection }
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed, meeting ended.`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});
