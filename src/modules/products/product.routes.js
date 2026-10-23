import { Router } from "express";
import { productController } from "./product.controller.js";
import { requireOwner, requireStaff } from "../../middleware/auth.js";

const router = Router();

// Staff (Owner and Cashier) can view and search products
router.get("/", ...requireStaff, productController.list);
router.get("/:id", ...requireStaff, productController.getById);

// Owner-only actions: Create and Update products
router.post("/", ...requireOwner, productController.create);
router.patch("/:id", ...requireOwner, productController.update);

export default router;
