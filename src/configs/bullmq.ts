import { Redis } from "ioredis";

const url = process.env.REDIS_URL! ?? "redis://default@127.0.0.1:6379"
const bullmqConnection = new Redis(
  url,
  {
    maxRetriesPerRequest: null, // BullMQ recommended
     ...(url.startsWith("rediss://") ? { tls: {} } : {}), // only enable TLS if rediss://
    retryStrategy: (times) => {
      const delay = Math.min(times * 200, 5000); 
      console.log(`🔄 Redis reconnect attempt #${times}, retrying in ${delay}ms`);
      return delay; // return null here to stop retrying
    },
  }
);

bullmqConnection.on("connect", () => {
  console.log("✅ BullMQ Redis connected");
});

bullmqConnection.on("error", (err) => {
  console.error("❌ BullMQ Redis error:", err.message);
});

bullmqConnection.on("end", () => {
  console.warn("⚠️ Redis connection closed, will retry...");
});

export default bullmqConnection;
