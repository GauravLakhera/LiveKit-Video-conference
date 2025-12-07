import { createPlatform,getPlatforms,updatePlatform,deletePlatform } from "../../controllers/platform/platform.js";

import { Router } from "express";

const router = Router();


router.get("/", getPlatforms);
router.post("/", createPlatform);
router.put("/:id", updatePlatform);
router.delete("/:id", deletePlatform);

export default router;