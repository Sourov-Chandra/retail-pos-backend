import { db } from "../../config/db.js";
import { getDhakaTodayRange } from "../../utils/date.js";

export const dashboardService = {
  /**
   * Computes business summary metrics from persisted database records.
   * Timezone: Asia/Dhaka.
   */
  async getSummary() {
    const { start, end, timezone } = getDhakaTodayRange();

    // 1. Today's Sales Aggregation (Revenue, Count, Discounts, Items)
    const todayStatsPipeline = [
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          salesCount: { $sum: 1 },
          totalDiscount: { $sum: "$discount.amount" },
          subtotal: { $sum: "$subtotal" },
        },
      },
    ];

    const todayStatsResult = await db.collection("sales").aggregate(todayStatsPipeline).toArray();
    const todayStats = todayStatsResult[0] || {
      totalRevenue: 0,
      salesCount: 0,
      totalDiscount: 0,
      subtotal: 0,
    };

    // 2. Active Products Count
    const activeProductsCount = await db.collection("products").countDocuments({ isActive: true });

    // 3. Low-Stock Products Count (active items with stockQuantity <= lowStockThreshold)
    const lowStockFilter = {
      isActive: true,
      $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] },
    };

    const lowStockCount = await db.collection("products").countDocuments(lowStockFilter);

    // List of low-stock items for alert preview (up to 5 items)
    const lowStockItems = await db
      .collection("products")
      .find(lowStockFilter)
      .project({ name: 1, sku: 1, stockQuantity: 1, lowStockThreshold: 1, category: 1 })
      .sort({ stockQuantity: 1 })
      .limit(5)
      .toArray();

    // 4. Best-Selling Products (Aggregated from line-item snapshots)
    const bestSellersPipeline = [
      { $match: { paymentStatus: "paid" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          sku: { $first: "$items.sku" },
          quantitySold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.lineTotal" },
        },
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 5 },
    ];

    const bestSellingProducts = await db.collection("sales").aggregate(bestSellersPipeline).toArray();

    // 5. Recent Completed Sales (Last 5 transactions)
    const recentSales = await db
      .collection("sales")
      .find({ paymentStatus: "paid" })
      .sort({ createdAt: -1 })
      .limit(5)
      .project({
        saleNumber: 1,
        totalAmount: 1,
        paymentMethod: 1,
        cashierName: 1,
        itemsCount: { $size: "$items" },
        createdAt: 1,
      })
      .toArray();

    return {
      today: {
        date: new Date().toISOString().slice(0, 10),
        timezone,
        salesCount: todayStats.salesCount,
        totalRevenue: todayStats.totalRevenue, // in minor units
        totalDiscount: todayStats.totalDiscount, // in minor units
      },
      inventory: {
        activeProductsCount,
        lowStockCount,
        lowStockItems,
      },
      bestSellingProducts,
      recentSales,
    };
  },
};
