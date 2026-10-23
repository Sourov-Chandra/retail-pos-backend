import { dashboardService } from "./dashboard.service.js";

export const dashboardController = {
  async getSummary(req, res, next) {
    try {
      const summary = await dashboardService.getSummary();
      res.json({
        success: true,
        summary,
      });
    } catch (error) {
      next(error);
    }
  },
};
