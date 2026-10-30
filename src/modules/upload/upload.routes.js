import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { requireStaff } from "../../middleware/auth.js";
import { config } from "../../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../../uploads");

// Ensure local uploads directory exists
fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 }, // 32MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg", ".bmp"];
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/gif",
      "image/svg+xml",
      "image/bmp",
      "application/octet-stream",
    ];

    if (allowedExtensions.includes(ext) || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`File type '${ext}' is not supported. Please upload an image.`);
      err.code = "UNSUPPORTED_MEDIA_TYPE";
      err.statusCode = 415;
      cb(err, false);
    }
  },
});

const router = Router();

// Staff (both Owner and Cashier) can upload product photos / camera snapshots
// Supports dual storage: saves locally for offline/instant access and syncs to ImgBB cloud when available
router.post("/", ...requireStaff, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "No image file was received.",
        },
      });
    }

    // 1. Always save a copy to local uploads folder
    const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
    const fileHash = crypto.randomBytes(8).toString("hex");
    const localFilename = `${Date.now()}-${fileHash}${ext}`;
    const localFilePath = path.join(uploadsDir, localFilename);

    await fs.writeFile(localFilePath, req.file.buffer);

    const backendHost = req.get("host") || "localhost:5000";
    const protocol = req.protocol || "http";
    const localUrl = `${protocol}://${backendHost}/uploads/${localFilename}`;

    let finalUrl = localUrl;

    // 2. Try uploading to ImgBB cloud if API key is present
    if (config.imgbbApiKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout guard

        const base64Image = req.file.buffer.toString("base64");
        const imgbbForm = new FormData();
        imgbbForm.append("image", base64Image);
        if (req.file.originalname) {
          const safeName = path.parse(req.file.originalname).name.replace(/[^a-zA-Z0-9_-]/g, "_");
          imgbbForm.append("name", safeName);
        }

        const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${config.imgbbApiKey}`, {
          method: "POST",
          body: imgbbForm,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (imgbbResponse.ok) {
          const imgbbData = await imgbbResponse.json();
          if (imgbbData?.success && imgbbData?.data) {
            // Note: Use display_url or direct url
            finalUrl = imgbbData.data.display_url || imgbbData.data.url || localUrl;
          }
        }
      } catch (cloudErr) {
        console.warn(
          "[Upload] ImgBB cloud upload timed out or ISP blocked; gracefully using local storage URL:",
          cloudErr.message
        );
      }
    }

    res.status(201).json({
      success: true,
      url: finalUrl,
      localUrl,
      size: req.file.size,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
