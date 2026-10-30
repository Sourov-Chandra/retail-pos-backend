import { Router } from "express";
import { staffController } from "./staff.controller.js";
import { requireOwner } from "../../middleware/auth.js";

const router = Router();

// All staff management routes are owner-restricted
router.get("/", ...requireOwner, staffController.list);
router.post("/", ...requireOwner, staffController.create);
router.patch("/:id", ...requireOwner, staffController.update);
router.post("/:id/password", ...requireOwner, staffController.resetPassword);
router.delete("/:id", ...requireOwner, staffController.delete);

export default router;
