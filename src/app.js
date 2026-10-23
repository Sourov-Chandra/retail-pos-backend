import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import { config } from "./config/env.js";

const app = express();

// 1. CORS Configuration
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

// 2. Mount Better Auth Handler before JSON body parser (Express 5 wildcard syntax)
app.all(["/api/auth", "/api/auth/*splat"], toNodeHandler(auth));

// 3. Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Base / Health Check Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "retail-pos-backend",
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// 5. 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
});

// 6. Global Error Handler
app.use((err, req, res, next) => {
  console.error("[ServerError]", err);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "An unexpected error occurred",
    },
  });
});

export default app;
