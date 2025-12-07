import express from "express"
import {getOlderMessage,getOlderPoll,getPollDetails} from "../../controllers/message/message.js"

const messageRoute=express.Router();
messageRoute.get('/',getOlderMessage)
messageRoute.get('/poll',getOlderPoll)
messageRoute.get("/poll/:id",getPollDetails)

export default messageRoute