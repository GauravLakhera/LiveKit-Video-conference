import express from "express";
import { login, registerUser } from "../../controllers/auth/auth.js";
import { getOccurrenceStats } from "../../controllers/schedule/scheduleOccurrences.js";
import {
  getScheduleStats,
  searchSchedule,
} from "../../controllers/schedule/schedule.js";
import adminAuth from "../../middlewares/adminAuth.js";

const adminRoute = express.Router();

adminRoute.post("/login", login);

adminRoute.use(adminAuth);

adminRoute.post("/register", registerUser);
adminRoute.get("/occurrence/stats", getOccurrenceStats);
adminRoute.get("/schedule/stats", getScheduleStats);
adminRoute.get("/search", searchSchedule);

export default adminRoute;
