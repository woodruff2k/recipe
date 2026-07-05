import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { upload } from "../middlewares/upload";
import * as uploadController from "../controllers/upload.controller";

const router = Router();

// multipart field name: "image"
router.post("/image", requireAuth, upload.single("image"), uploadController.uploadImage);

export default router;
