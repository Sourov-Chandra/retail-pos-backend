import { ObjectId } from "mongodb";
import { client, db } from "../../config/db.js";
import { stockMovementService } from "./stockMovement.service.js";

export const inventoryService = {
  /**
   * Records a manual stock adjustment.
   * Authorized for both Owner and Cashier, with mandatory audit trail and negative stock prevention.
   */
  async adjustStock({ productId, quantityChange, reason }, actorId) {
    if (!productId || !ObjectId.isValid(productId)) {
      const err = new Error("A valid productId is required for inventory adjustment.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const change = parseInt(quantityChange, 10);
    if (isNaN(change) || change === 0) {
      const err = new Error("Quantity change must be a non-zero integer.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      const err = new Error("A mandatory reason must be provided for manual stock adjustment.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const objectId = new ObjectId(productId);
    const product = await db.collection("products").findOne({ _id: objectId });
    if (!product) {
      const err = new Error("Product not found.");
      err.code = "PRODUCT_NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    // Check if decrease exceeds current stock
    if (change < 0 && product.stockQuantity < Math.abs(change)) {
      const err = new Error(
        `Cannot reduce stock by ${Math.abs(change)}. Current available stock is only ${product.stockQuantity}.`
      );
      err.code = "INSUFFICIENT_STOCK";
      err.statusCode = 400;
      throw err;
    }

    const movementType = change > 0 ? "adjustment_increase" : "adjustment_decrease";
    const now = new Date();

    const session = client.startSession();
    try {
      let result = null;
      await session.withTransaction(async () => {
        const updateCondition = { _id: objectId };
        if (change < 0) {
          updateCondition.stockQuantity = { $gte: Math.abs(change) };
        }

        const updateDoc = await db.collection("products").findOneAndUpdate(
          updateCondition,
          {
            $inc: { stockQuantity: change },
            $set: { updatedAt: now },
          },
          { session, returnDocument: "before" }
        );

        if (!updateDoc) {
          const err = new Error("Stock update failed due to concurrent modification or insufficient stock.");
          err.code = "INSUFFICIENT_STOCK";
          err.statusCode = 400;
          throw err;
        }

        const stockBefore = updateDoc.stockQuantity;
        const stockAfter = stockBefore + change;

        const movement = await stockMovementService.recordMovement({
          productId: objectId,
          movementType,
          quantityChange: change,
          stockBefore,
          stockAfter,
          referenceType: "manual_adjustment",
          performedBy: actorId,
          note: reason.trim(),
          session,
        });

        result = {
          productId: objectId,
          productName: product.name,
          sku: product.sku,
          stockBefore,
          stockAfter,
          quantityChange: change,
          movement,
        };
      });

      return result;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Retrieves stock movements audit log.
   */
  async listMovements(query) {
    const { productId, page = 1, limit = 50 } = query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const { total, movements } = await stockMovementService.listMovements({
      productId,
      limit: limitNum,
      skip,
    });

    return {
      movements,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  },
};
