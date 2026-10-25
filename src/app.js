import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import { config } from "./config/env.js";
import { requireAuth, requireOwner, requireStaff } from "./middleware/auth.js";
import productRoutes from "./modules/products/product.routes.js";
import salesRoutes from "./modules/sales/sales.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import uploadRoutes from "./modules/upload/upload.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve local uploaded images statically
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

// 1. CORS Configuration (Supports localhost & 127.0.0.1 for seamless local development)
const allowedOrigins = [
  config.frontendUrl,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || config.nodeEnv === "development") {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// 2. Mount Better Auth Handler before JSON body parser (Express 5 wildcard syntax)
app.all(["/api/auth", "/api/auth/*splat"], toNodeHandler(auth));

// 3. Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Base / Health Check Routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Retail POS & Inventory System API",
    version: "1.0.0",
    description: "Bangladesh Edition Retail POS Backend (৳ BDT)",
    status: "running",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      products: "/api/products",
      sales: "/api/sales",
      inventory: "/api/inventory",
      dashboard: "/api/dashboard",
      upload: "/api/upload",
    },
    documentation: "https://github.com/Sourov-Chandra/retail-pos-backend",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "retail-pos-backend",
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// 5. Business Routes
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/upload", uploadRoutes);

// Profile / Current User Endpoint
app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role || "cashier",
    },
  });
});

// Role-protected test routes
app.get("/api/test/owner-only", ...requireOwner, (req, res) => {
  res.json({
    success: true,
    message: "Welcome Owner!",
    user: req.user,
  });
});

app.get("/api/test/staff-only", ...requireStaff, (req, res) => {
  res.json({
    success: true,
    message: "Welcome Staff!",
    user: req.user,
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
