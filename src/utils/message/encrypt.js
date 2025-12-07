import crypto from "crypto";

const algorithm = "aes-256-cbc";

const rawKey = "fallback-secret-mohjay#hyed";
const secretKey = crypto.createHash("sha256").update(rawKey).digest();
const ivLength = 16;

export function encrypt(text) {
  if (typeof text !== "string") {
    text = String(text ?? "");
  }

  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText) {
  if (!encryptedText) return "";

  try {
    const cleanedText = (encryptedText || "").trim();
    const [ivHex, encryptedData] = cleanedText.split(":");
    if (!ivHex || !encryptedData) return "";

    const iv = Buffer.from(ivHex, "hex");

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    // console.log(decipher);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");

    decrypted += decipher.final("utf8");
    // console.log("dec", decrypted);

    return decrypted;
  } catch (err) {
    console.log("❌ Decryption failed:", err.message);
    return "[decryption error]";
  }
}
