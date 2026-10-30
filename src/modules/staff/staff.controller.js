import { staffService } from "./staff.service.js";

export const staffController = {
  async list(req, res, next) {
    try {
      const staffList = await staffService.listStaff();
      res.json({
        success: true,
        data: staffList,
        total: staffList.length,
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const { name, email, password, role } = req.body;
      const created = await staffService.createStaff({
        name,
        email,
        password,
        role,
      });

      res.status(201).json({
        success: true,
        data: created,
        message: "Staff account created successfully.",
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, role, banned } = req.body;
      const updated = await staffService.updateStaff(
        id,
        { name, role, banned },
        req.user.id
      );

      res.json({
        success: true,
        data: updated,
        message: "Staff member updated successfully.",
      });
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req, res, next) {
    try {
      const { id } = req.params;
      const { password } = req.body;
      const result = await staffService.resetPassword(id, password);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const result = await staffService.deleteStaff(id, req.user.id);

      res.json({
        success: true,
        data: result,
        message: `Staff member ${result.name} deleted successfully.`,
      });
    } catch (error) {
      next(error);
    }
  },
};
