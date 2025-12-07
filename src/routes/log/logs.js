import express from 'express'
import {getParticipantLogDetail,getParticipantAttendance } from "../../controllers/log/participant.js"

const logRouter = express.Router()


logRouter.route("/participantLog").get(getParticipantLogDetail)
logRouter.route("/attendance").get(getParticipantAttendance)





export default logRouter