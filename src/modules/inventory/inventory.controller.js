import { inventoryService } from "./inventory.service.js";

export const inventoryController = {
  async adjustStock(req, res, next) {
    try {
      const result = await inventoryService.adjustStock(req.body, req.user.id);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  async listMovements(req, res, next) {
    try {
      const result = await inventoryService.listMovements(req.query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },
};
