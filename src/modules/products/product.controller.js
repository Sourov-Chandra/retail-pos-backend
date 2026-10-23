import { productService } from "./product.service.js";

export const productController = {
  async create(req, res, next) {
    try {
      const product = await productService.createProduct(req.body, req.user.id);
      res.status(201).json({
        success: true,
        product,
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const result = await productService.listProducts(req.query);
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
      const product = await productService.getProductById(req.params.id);
      res.json({
        success: true,
        product,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const product = await productService.updateProduct(req.params.id, req.body);
      res.json({
        success: true,
        product,
      });
    } catch (error) {
      next(error);
    }
  },
};
