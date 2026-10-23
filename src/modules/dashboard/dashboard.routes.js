import { Router } from "express";
import { dashboardController } from "./dashboard.controller.js";
import { requireStaff } from "../../middleware/auth.js";

const router = Router();

// Staff (both Owner and Cashier) can view dashboard summary
router.get("/summary", ...requireStaff, dashboardController.getSummary);

export default router;
