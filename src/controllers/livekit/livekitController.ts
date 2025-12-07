
import { WebhookReceiver } from 'livekit-server-sdk';  // or whatever version you're using
import { asyncHandler } from '../../utils/asyncHandler.js';
import { Request, Response } from 'express';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from '../../configs/livekit.js';
import uploadToGDrive from '../../utils/uploadToGDrive.js';


const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET );

export const livekitWebhook =  asyncHandler(async (req: Request, res: Response) => {
  try {
      console.log('✅ livekit-webhook hit ✅')
      const event = await receiver.receive(req.body, req.header('Authorization'));
      console.log("livekit event",event)
    // event.event would be something like "egress_ended"
    if (event.event === 'egress_ended') {
      // here you know upload/recording/export is done
      const egressInfo = event.egressInfo; 
      uploadToGDrive()

      // Run your logic here: e.g. process the file, move, notify, etc.
    }
    res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook validation or processing error', err);
    res.status(400).send('error');
  }
});
