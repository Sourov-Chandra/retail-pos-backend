import { ObjectId } from "mongodb";
import { client, db } from "../../config/db.js";
import { stockMovementService } from "../inventory/stockMovement.service.js";

export const salesService = {
  /**
   * Completes a checkout transaction.
   * Performs server-side price calculation, discount verification,
   * atomic conditional stock deduction, idempotency guarantee, and sale recording.
   */
  async checkout(payload, cashier) {
    const { items, discount = {}, paymentMethod = "cash", idempotencyKey } = payload;

    // 1. Idempotency Check
    if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim()) {
      const existingSale = await db.collection("sales").findOne({ idempotencyKey: idempotencyKey.trim() });
      if (existingSale) {
        return {
          sale: existingSale,
          isIdempotentReplay: true,
        };
      }
    }

    // 2. Validate Items Array
    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error("Checkout cart must contain at least one item.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    // 3. Normalize & Merge Duplicate Product IDs
    const itemMap = new Map();
    for (const item of items) {
      if (!item.productId || !ObjectId.isValid(item.productId)) {
        const err = new Error(`Invalid productId in cart: ${item.productId}`);
        err.code = "VALIDATION_ERROR";
        err.statusCode = 400;
        throw err;
      }
      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        const err = new Error("Each cart item must have a positive integer quantity.");
        err.code = "VALIDATION_ERROR";
        err.statusCode = 400;
        throw err;
      }

      const key = item.productId.toString();
      if (itemMap.has(key)) {
        itemMap.set(key, itemMap.get(key) + qty);
      } else {
        itemMap.set(key, qty);
      }
    }

    // 4. Fetch Products from Database
    const productIds = Array.from(itemMap.keys()).map((id) => new ObjectId(id));
    const products = await db
      .collection("products")
      .find({ _id: { $in: productIds } })
      .toArray();

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    // 5. Verify Products, Active Status, and Build Item Snapshots
    let subtotal = 0;
    const itemSnapshots = [];

    for (const [productIdStr, requestedQty] of itemMap.entries()) {
      const product = productMap.get(productIdStr);

      if (!product) {
        const err = new Error(`Product not found with ID: ${productIdStr}`);
        err.code = "PRODUCT_NOT_FOUND";
        err.statusCode = 404;
        throw err;
      }

      if (!product.isActive) {
        const err = new Error(`Product '${product.name}' is inactive and cannot be sold.`);
        err.code = "PRODUCT_INACTIVE";
        err.statusCode = 400;
        throw err;
      }

      if (product.stockQuantity < requestedQty) {
        const err = new Error(
          `Insufficient stock for '${product.name}'. Available: ${product.stockQuantity}, Requested: ${requestedQty}`
        );
        err.code = "INSUFFICIENT_STOCK";
        err.statusCode = 400;
        throw err;
      }

      const unitPrice = product.sellingPrice; // Authoritative price from DB in minor units
      const lineTotal = unitPrice * requestedQty;
      subtotal += lineTotal;

      itemSnapshots.push({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: requestedQty,
        unitPrice,
        lineTotal,
      });
    }

    // 6. Validate & Calculate Discount
    let discountAmount = 0;
    const discountSnapshot = {
      type: "none",
      value: 0,
      amount: 0,
    };

    if (discount && discount.type && discount.type !== "none") {
      const discountType = discount.type.toLowerCase();
      const discountVal = parseFloat(discount.value);

      if (isNaN(discountVal) || discountVal < 0) {
        const err = new Error("Discount value cannot be negative or invalid.");
        err.code = "INVALID_DISCOUNT";
        err.statusCode = 400;
        throw err;
      }

      if (discountType === "percentage") {
        if (discountVal > 100) {
          const err = new Error("Percentage discount cannot exceed 100%.");
          err.code = "INVALID_DISCOUNT";
          err.statusCode = 400;
          throw err;
        }
        discountAmount = Math.round((subtotal * discountVal) / 100);
        discountSnapshot.type = "percentage";
        discountSnapshot.value = discountVal;
        discountSnapshot.amount = discountAmount;
      } else if (discountType === "fixed") {
        // Fixed amount in minor units
        const fixedVal = Math.round(discountVal);
        if (fixedVal > subtotal) {
          const err = new Error("Fixed discount amount cannot exceed subtotal.");
          err.code = "INVALID_DISCOUNT";
          err.statusCode = 400;
          throw err;
        }
        discountAmount = fixedVal;
        discountSnapshot.type = "fixed";
        discountSnapshot.value = fixedVal;
        discountSnapshot.amount = fixedVal;
      } else {
        const err = new Error(`Unsupported discount type: ${discount.type}`);
        err.code = "INVALID_DISCOUNT";
        err.statusCode = 400;
        throw err;
      }
    }

    // 7. Calculate Total Amount
    const totalAmount = Math.max(0, subtotal - discountAmount);

    // 8. Validate Payment Method
    const allowedPaymentMethods = ["cash", "card", "mobile_payment"];
    const normalizedPaymentMethod = String(paymentMethod).toLowerCase();
    if (!allowedPaymentMethods.includes(normalizedPaymentMethod)) {
      const err = new Error(`Invalid payment method: ${paymentMethod}. Allowed: ${allowedPaymentMethods.join(", ")}`);
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    // 9. Generate Unique Sale Number (e.g. SALE-20261023-48192)
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomPart = Math.floor(10000 + Math.random() * 90000);
    const saleNumber = `SALE-${datePart}-${randomPart}`;

    const now = new Date();
    const cashierId = cashier && cashier.id ? cashier.id : "system";
    const cashierName = cashier && cashier.name ? cashier.name : "Cashier";

    const saleDocument = {
      saleNumber,
      items: itemSnapshots,
      subtotal,
      discount: discountSnapshot,
      totalAmount,
      paymentMethod: normalizedPaymentMethod,
      paymentStatus: "paid",
      cashierId,
      cashierName,
      idempotencyKey: idempotencyKey ? idempotencyKey.trim() : null,
      createdAt: now,
    };

    // 10. Execute Atomic Multi-Document Transaction
    const session = client.startSession();
    try {
      let completedSale = null;
      await session.withTransaction(async () => {
        // A. Conditionally decrement stock for each item atomically
        for (const item of itemSnapshots) {
          const updateResult = await db.collection("products").findOneAndUpdate(
            {
              _id: item.productId,
              isActive: true,
              stockQuantity: { $gte: item.quantity },
            },
            {
              $inc: { stockQuantity: -item.quantity },
              $set: { updatedAt: now },
            },
            { session, returnDocument: "before" }
          );

          if (!updateResult) {
            const err = new Error(
              `Checkout conflict: Insufficient stock or item inactive for '${item.productName}'.`
            );
            err.code = "INSUFFICIENT_STOCK";
            err.statusCode = 400;
            throw err;
          }

          const stockBefore = updateResult.stockQuantity;
          const stockAfter = stockBefore - item.quantity;

          // B. Record Stock Movement for Sale
          await stockMovementService.recordMovement({
            productId: item.productId,
            movementType: "sale",
            quantityChange: -item.quantity,
            stockBefore,
            stockAfter,
            referenceType: "sale",
            referenceId: saleNumber,
            performedBy: cashierId,
            note: `Stock deducted during checkout (${saleNumber})`,
            session,
          });
        }

        // C. Insert Completed Sale Record
        const insertSaleResult = await db.collection("sales").insertOne(saleDocument, { session });
        saleDocument._id = insertSaleResult.insertedId;
        completedSale = saleDocument;
      });

      return {
        sale: completedSale,
        isIdempotentReplay: false,
      };
    } finally {
      await session.endSession();
    }
  },

  /**
   * Retrieves paginated sales history with optional date range and filtering.
   */
  async listSales({
    page = 1,
    limit = 20,
    startDate,
    endDate,
    cashierId,
    paymentMethod,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = {}) {
    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (cashierId) {
      filter.cashierId = cashierId;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod.toLowerCase();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortDirection };

    const total = await db.collection("sales").countDocuments(filter);
    const sales = await db
      .collection("sales")
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .toArray();

    return {
      sales,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  },

  /**
   * Finds a completed sale by its ID.
   */
  async getSaleById(id) {
    if (!ObjectId.isValid(id)) {
      const err = new Error("Invalid sale ID.");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const sale = await db.collection("sales").findOne({ _id: new ObjectId(id) });
    if (!sale) {
      const err = new Error("Sale transaction not found.");
      err.code = "SALE_NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    return sale;
  },
};
