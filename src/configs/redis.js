import dotenv from "dotenv";
dotenv.config();
import { createClient } from "redis";

const url = process.env.REDIS_URL ?? "redis://default@127.0.0.1:6379"

const client = createClient({
  url: url,
  socket: {
    reconnectStrategy: (retries) => {
      console.log(`🔄 Redis reconnect attempt #${retries}`);
      return Math.min(retries * 100, 5000); // backoff up to 5s
    },
  },
});

client.on("error", (err) => {
  console.error("❌ Redis Client Error:", err);
});

client.on("end", () => {
  console.warn("⚠️ Redis connection closed, will retry...");
});


await client.connect();
console.log("✅ Redis connected");

export default client;
