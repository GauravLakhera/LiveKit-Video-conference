import express from "express"
import { livekitWebhook } from "../../controllers/livekit/livekitController.js"

const livekitRouter = express.Router()

livekitRouter.route('/webhook').post(express.raw({ type: 'application/webhook+json' }), livekitWebhook)

export default livekitRouter