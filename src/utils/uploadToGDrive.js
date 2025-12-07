import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import pLimit from "p-limit";
import { addRecording } from "../services/recording/recording.js";
import { mongoConnect, mongoDisconnect } from "../configs/db.js";
import mongoose from "mongoose";

const limit = pLimit(3); // max 3 uploads at once

dotenv.config();

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
// `drive.file` = only files you create/upload
// use "https://www.googleapis.com/auth/drive" if you want full access

const CREDENTIALS_PATH = path.resolve(`keys/${process.env.GDRIVE_OAUTH_JSON}`);
const TOKEN_PATH = path.resolve("keys/oauth-token.json");

/**
 * Load OAuth2 credentials
 */
function loadCredentials() {
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
}

/**
 * Save token for reuse
 */
function saveToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
  console.log("✅ Token stored to", TOKEN_PATH);
}

/**
 * Authorize user with OAuth2
 */
async function authorize() {
  const credentials = loadCredentials();
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0] // e.g. "http://localhost"
  );

  // If we have a stored token, use it
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  // Otherwise, generate consent screen URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("⚠️ Authorize this app by visiting this URL:\n", authUrl);

  // Wait for user input
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) =>
    rl.question("Enter the code from that page here: ", (c) => {
      rl.close();
      resolve(c);
    })
  );

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  saveToken(tokens);
  return oAuth2Client;
}

/**
 * Upload a file to Drive
 */
async function uploadFile(auth, filePath) {
  const drive = google.drive({ version: "v3", auth });
  const fileName = path.basename(filePath);

  const fileMetadata = {
    name: fileName,
    parents: process.env.GDRIVE_FOLDER_ID ? [process.env.GDRIVE_FOLDER_ID] : [],
  };
  const media = { mimeType: "video/mp4", body: fs.createReadStream(filePath) };

  const res = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: "id, webViewLink",
  });


  console.log("✅ Uploaded File ID:", res.data);
  console.log("🔗 View Link:", res.data.webViewLink);

  const occurrenceId = fileName?.split("-")[1]

  if (!occurrenceId) {
    throw new Error("Error extracting occurrenceId from file.")
  }
  console.log(`🤞file occurrenceId: ${occurrenceId}`)
  try {
    const newRecording = await addRecording({ occurrenceId: new mongoose.Types.ObjectId(`${occurrenceId}`), url: res.data.webViewLink, meta: res.data })
    console.log(`😎 Recording ${newRecording?.occurrenceId} data saved to MongoDB Successfully.`)
  } catch (error) {
    console.error(`❌ Failed to save recording metadata: ${error.message}`);
  }

  return res.data;
}

/**
 * Main
*/
async function uploadToGDrive ()  {
  try {
    // await mongoConnect()
    const auth = await authorize();

    const recordingsDir = path.resolve("./recordings");
    const files = fs.readdirSync(recordingsDir).filter((f) => f.endsWith(".mp4"));

    if (files.length === 0) {
      console.log("No recordings found.");
      return;
    }

    const sortedFiles = files
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(recordingsDir, f)).mtime,
      }))
      .sort((a, b) => a.time - b.time);

    const promises = sortedFiles.map((file) => {
      const filePath = path.join(recordingsDir, file.name);
      return limit(async () => {
        console.log("📤 Uploading:", filePath);
        try {
          const result = await uploadFile(auth, filePath);
          if (result?.id) {
            console.log(`🗑️ Deleting local file after upload: ${filePath}`);
            fs.unlinkSync(filePath);
          } else {
            console.warn("⚠️ Upload did not return an ID, keeping file locally.");
          }
        } catch (err) {
          console.error(`❌ Failed to upload ${filePath}:`, err.message);
        }
      });
    });

    await Promise.all(promises);
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
  } finally {
    console.log(`Upload to GDrive function completed`)
  }
};

export default uploadToGDrive
