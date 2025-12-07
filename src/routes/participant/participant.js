import express from "express";
import {
  createParticipant,
  getParticipantsBySchedule,
  deleteParticipantController,
  updateParticipantController
} from "../../controllers/participant/participant.js";

const participantRoute = express.Router();

participantRoute
  .route("/")
  .get(getParticipantsBySchedule)
  .post(createParticipant);
participantRoute.route("/update").patch(updateParticipantController);
participantRoute.route("/delete/:platformId/:scheduleId/:participantId").delete(deleteParticipantController);

export default participantRoute;
