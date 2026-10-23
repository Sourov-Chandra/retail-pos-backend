import { salesService } from "./sales.service.js";

export const salesController = {
  async checkout(req, res, next) {
    try {
      const result = await salesService.checkout(req.body, req.user);
      const statusCode = result.isIdempotentReplay ? 200 : 201;
      res.status(statusCode).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const result = await salesService.listSales(req.query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const sale = await salesService.getSaleById(req.params.id);
      res.json({
        success: true,
        sale,
      });
    } catch (error) {
      next(error);
    }
  },
};
