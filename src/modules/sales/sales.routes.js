import { Router } from "express";
import { salesController } from "./sales.controller.js";
import { requireStaff } from "../../middleware/auth.js";

const router = Router();

// Staff (both Owner and Cashier) can process sales and view history
router.post("/checkout", ...requireStaff, salesController.checkout);
router.get("/", ...requireStaff, salesController.list);
router.get("/:id", ...requireStaff, salesController.getById);

export default router;
