import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireStaff } from "../../middleware/auth.js";
import { config } from "../../config/env.js";

// Use memory storage: no local disk files created (100% Vercel & serverless ready)
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

// Staff (both Owner and Cashier) can upload product photos / camera snapshots directly to ImgBB Cloud
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

    if (!config.imgbbApiKey) {
      return res.status(500).json({
        success: false,
        error: {
          code: "CONFIG_ERROR",
          message: "ImgBB API key is not configured.",
        },
      });
    }

    // Convert memory buffer to base64 for ImgBB API
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
    });

    const imgbbData = await imgbbResponse.json();

    if (!imgbbResponse.ok || !imgbbData.success) {
      const errMsg = imgbbData.error?.message || "Failed to upload image to ImgBB CDN.";
      const err = new Error(errMsg);
      err.code = "IMGBB_UPLOAD_ERROR";
      err.statusCode = 502;
      throw err;
    }

    const cdnUrl = imgbbData.data.display_url || imgbbData.data.url;

    res.status(201).json({
      success: true,
      url: cdnUrl,
      thumbnailUrl: imgbbData.data.thumb?.url || cdnUrl,
      title: imgbbData.data.title,
      size: req.file.size,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
