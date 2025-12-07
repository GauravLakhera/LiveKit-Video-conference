import express from "express";
import { getRecordingsByScheduleController } from "../../controllers/recording/recording.js";

const recordingRoute = express.Router();

recordingRoute.route("/").get(getRecordingsByScheduleController);

export default recordingRoute;