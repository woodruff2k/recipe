import { asyncHandler } from "../utils/asyncHandler";
import { badRequest } from "../utils/errors";
import { storage } from "../storage";

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw badRequest('No file provided (expected multipart field "image")');
  }

  const { key, url } = await storage.save(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
  );

  res.status(201).json({ key, url });
});
