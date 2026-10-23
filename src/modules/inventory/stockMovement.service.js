import { ObjectId } from "mongodb";
import { db } from "../../config/db.js";

/**
 * Service to record and query stock movements.
 * Stock movements are append-only audit trail records.
 */
export const stockMovementService = {
  /**
   * Records a stock movement.
   * Can be executed within an optional MongoDB session for transactions.
   */
  async recordMovement({
    productId,
    movementType,
    quantityChange,
    stockBefore,
    stockAfter,
    referenceType,
    referenceId = null,
    performedBy,
    note = "",
    session = null,
  }) {
    const movement = {
      productId: typeof productId === "string" ? new ObjectId(productId) : productId,
      movementType, // "initial_stock" | "sale" | "adjustment_increase" | "adjustment_decrease"
      quantityChange,
      stockBefore,
      stockAfter,
      referenceType, // "product_creation" | "sale" | "manual_adjustment"
      referenceId: referenceId ? (typeof referenceId === "string" ? referenceId : referenceId.toString()) : null,
      performedBy: performedBy ? (typeof performedBy === "string" ? performedBy : performedBy.toString()) : null,
      note,
      createdAt: new Date(),
    };

    const options = session ? { session } : {};
    const result = await db.collection("stockMovements").insertOne(movement, options);
    return { _id: result.insertedId, ...movement };
  },

  /**
   * Retrieves stock movements for a specific product or general audit history.
   */
  async listMovements({ productId = null, limit = 50, skip = 0 } = {}) {
    const filter = {};
    if (productId) {
      filter.productId = typeof productId === "string" ? new ObjectId(productId) : productId;
    }

    const total = await db.collection("stockMovements").countDocuments(filter);
    const movements = await db
      .collection("stockMovements")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return { total, movements };
  },
};
