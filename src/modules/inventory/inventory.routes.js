import { Router } from "express";
import { inventoryController } from "./inventory.controller.js";
import { requireStaff } from "../../middleware/auth.js";

const router = Router();

// Both Owner and Cashier can view movements and adjust stock (with mandatory audit)
router.get("/movements", ...requireStaff, inventoryController.listMovements);
router.post("/adjustments", ...requireStaff, inventoryController.adjustStock);

export default router;
