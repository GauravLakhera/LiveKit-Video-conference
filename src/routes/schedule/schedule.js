import express from 'express'
import { createSchedule, getSchedules,getAllSchedules, getSchedule, updateSchedule, deleteSchedule } from '../../controllers/schedule/schedule.js'
import { getDayOccurrencesWithParticipants, getOccurrence, getOccurrences ,getOccurrencesByGroup,getOccurrencesByParticipant} from '../../controllers/schedule/scheduleOccurrences.js'

const scheduleRouter = express.Router()

scheduleRouter.route("/").get(getSchedules).post(createSchedule)
scheduleRouter.route("/all").get(getAllSchedules)
scheduleRouter.route("/occurrence").get(getOccurrence)
scheduleRouter.route("/occurrence/all").get(getOccurrences)
scheduleRouter.route("/occurrence/all/notification").get(getDayOccurrencesWithParticipants) //API for ayush to get occurrences for the day with participants
scheduleRouter.route("/:scheduleId").get(getSchedule).patch(updateSchedule).delete(deleteSchedule)
scheduleRouter.route("/occurrence/group").get(getOccurrencesByGroup)
scheduleRouter.route("/occurrence/participant").get(getOccurrencesByParticipant)


export default scheduleRouter