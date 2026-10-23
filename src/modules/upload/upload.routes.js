import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { requireStaff } from "../../middleware/auth.js";
import { config } from "../../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "../../../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const uniqueName = `prod-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

// Comprehensive image file filter (supports AVIF, WebP, PNG, JPEG, GIF, etc.)
const fileFilter = (req, file, cb) => {
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
    "application/octet-stream", // Frequently assigned by Windows for AVIF without AV1 extension
  ];

  if (allowedExtensions.includes(ext) || allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error(`File type '${ext}' is not supported. Please upload an image (AVIF, WebP, JPG, PNG).`);
    err.code = "UNSUPPORTED_MEDIA_TYPE";
    err.statusCode = 415;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter,
});

const router = Router();

// Staff (both Owner and Cashier) can upload product photos / snap camera shots
router.post("/", ...requireStaff, upload.single("image"), (req, res, next) => {
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

    const relativeUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `http://localhost:${config.port}${relativeUrl}`;

    res.status(201).json({
      success: true,
      url: fullUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
