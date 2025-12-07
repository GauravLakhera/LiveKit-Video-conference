export function formatRedisUserId(occurrenceId, userId, platformId) {
  return `${userId}_${occurrenceId}_${platformId}`;
}

export function parseRedisUserId(redisUserId) {
  const parts = String(redisUserId || "").split("_");
  if (parts.length !== 3) throw new Error("Invalid redis user id format");
  const [userId, occurrenceId, platformId] = parts;
  return { userId, occurrenceId, platformId };
}
