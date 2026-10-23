import { ObjectId } from "mongodb";
import { client, db } from "../../config/db.js";
import { stockMovementService } from "../inventory/stockMovement.service.js";

export const productService = {
  /**
   * Creates a new product and records initial stock movement if quantity > 0.
   * Runs inside a MongoDB transaction for atomicity.
   */
  async createProduct(data, actorId) {
    const {
      name,
      sku,
      category = "General",
      sellingPrice,
      stockQuantity = 0,
      lowStockThreshold = 10,
      isActive = true,
    } = data;

    if (!name || typeof name !== "string" || !name.trim()) {
      const err = new Error("Product name is required.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    if (!sku || typeof sku !== "string" || !sku.trim()) {
      const err = new Error("Product SKU is required.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const normalizedSku = sku.trim().toUpperCase();

    // Check unique SKU
    const existing = await db.collection("products").findOne({ sku: normalizedSku });
    if (existing) {
      const err = new Error(`Product with SKU '${normalizedSku}' already exists.`);
      err.code = "DUPLICATE_SKU";
      err.statusCode = 409;
      throw err;
    }

    const price = parseInt(sellingPrice, 10);
    if (isNaN(price) || price < 0) {
      const err = new Error("Selling price must be a non-negative integer (minor units).");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const stock = parseInt(stockQuantity, 10);
    if (isNaN(stock) || stock < 0) {
      const err = new Error("Stock quantity must be a non-negative integer.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const threshold = parseInt(lowStockThreshold, 10);
    if (isNaN(threshold) || threshold < 0) {
      const err = new Error("Low stock threshold must be a non-negative integer.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const newProduct = {
      name: name.trim(),
      sku: normalizedSku,
      category: category.trim(),
      sellingPrice: price,
      stockQuantity: stock,
      lowStockThreshold: threshold,
      isActive: Boolean(isActive),
      createdAt: now,
      updatedAt: now,
    };

    // Use MongoDB Transaction for atomic product + initial stock movement insertion
    const session = client.startSession();
    try {
      let createdProduct = null;
      await session.withTransaction(async () => {
        const insertResult = await db.collection("products").insertOne(newProduct, { session });
        newProduct._id = insertResult.insertedId;
        createdProduct = newProduct;

        // If initial stock was provided, record an initial_stock movement
        if (stock > 0) {
          await stockMovementService.recordMovement({
            productId: insertResult.insertedId,
            movementType: "initial_stock",
            quantityChange: stock,
            stockBefore: 0,
            stockAfter: stock,
            referenceType: "product_creation",
            referenceId: insertResult.insertedId,
            performedBy: actorId,
            note: "Initial stock on product creation",
            session,
          });
        }
      });
      return createdProduct;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Retrieves paginated products with search, category, and status filters.
   */
  async listProducts({
    search = "",
    category = "",
    isActive = null,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = {}) {
    const filter = {};

    if (isActive !== null && isActive !== undefined && isActive !== "") {
      filter.isActive = isActive === "true" || isActive === true;
    }

    if (category && category.trim()) {
      filter.category = { $regex: `^${category.trim()}$`, $options: "i" };
    }

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      filter.$or = [{ name: searchRegex }, { sku: searchRegex }, { category: searchRegex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortDirection };

    const total = await db.collection("products").countDocuments(filter);
    const products = await db
      .collection("products")
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .toArray();

    return {
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  },

  /**
   * Finds a product by its ID.
   */
  async getProductById(id) {
    if (!ObjectId.isValid(id)) {
      const err = new Error("Invalid product ID.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const product = await db.collection("products").findOne({ _id: new ObjectId(id) });
    if (!product) {
      const err = new Error("Product not found.");
      err.code = "PRODUCT_NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    return product;
  },

  /**
   * Updates product details (name, sku, category, sellingPrice, lowStockThreshold, isActive).
   * Note: Direct stock updates are not allowed here (must go through inventory movements/sales).
   */
  async updateProduct(id, updateData) {
    if (!ObjectId.isValid(id)) {
      const err = new Error("Invalid product ID.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const objectId = new ObjectId(id);
    const existing = await db.collection("products").findOne({ _id: objectId });
    if (!existing) {
      const err = new Error("Product not found.");
      err.code = "PRODUCT_NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    const updates = { updatedAt: new Date() };

    if (updateData.name !== undefined) {
      if (!updateData.name || typeof updateData.name !== "string" || !updateData.name.trim()) {
        const err = new Error("Product name cannot be empty.");
        err.code = "VALIDATION_ERROR";
        err.statusCode = 400;
        throw err;
      }
      updates.name = updateData.name.trim();
    }

    if (updateData.sku !== undefined) {
      const newSku = updateData.sku.trim().toUpperCase();
      if (!newSku) {
        const err = new Error("Product SKU cannot be empty.");
        err.code = "VALIDATION_ERROR";
        err.statusCode = 400;
        throw err;
      }
      if (newSku !== existing.sku) {
        const duplicate = await db.collection("products").findOne({
          _id: { $ne: objectId },
          sku: newSku,
        });
        if (duplicate) {
          const err = new Error(`Product with SKU '${newSku}' already exists.`);
          err.code = "DUPLICATE_SKU";
          err.statusCode = 409;
          throw err;
        }
        updates.sku = newSku;
      }
    }

    if (updateData.category !== undefined) {
      updates.category = String(updateData.category).trim();
    }

    if (updateData.sellingPrice !== undefined) {
      const price = parseInt(updateData.sellingPrice, 10);
      if (isNaN(price) || price < 0) {
        const err = new Error("Selling price must be a non-negative integer (minor units).");
        err.code = "VALIDATION_ERROR";
        err.statusCode = 400;
        throw err;
      }
      updates.sellingPrice = price;
    }

    if (updateData.lowStockThreshold !== undefined) {
      const threshold = parseInt(updateData.lowStockThreshold, 10);
      if (isNaN(threshold) || threshold < 0) {
        const err = new Error("Low stock threshold must be a non-negative integer.");
        err.code = "VALIDATION_ERROR";
        err.statusCode = 400;
        throw err;
      }
      updates.lowStockThreshold = threshold;
    }

    if (updateData.isActive !== undefined) {
      updates.isActive = Boolean(updateData.isActive);
    }

    await db.collection("products").updateOne({ _id: objectId }, { $set: updates });
    return await db.collection("products").findOne({ _id: objectId });
  },
};
