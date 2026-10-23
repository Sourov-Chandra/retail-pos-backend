import { MongoClient } from "mongodb";
import { config } from "./env.js";

export const client = new MongoClient(config.mongodbUri);
export const db = client.db();

let isConnected = false;

export async function connectDB() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log(`[Database] Connected successfully to MongoDB: ${db.databaseName}`);

    // Ensure essential indexes
    try {
      // Products indexes
      const products = db.collection("products");
      await products.createIndex({ sku: 1 }, { unique: true });
      await products.createIndex({ name: "text", sku: "text" });
      await products.createIndex({ isActive: 1 });
      await products.createIndex({ category: 1 });

      // Stock movements indexes
      const movements = db.collection("stockMovements");
      await movements.createIndex({ productId: 1 });
      await movements.createIndex({ createdAt: -1 });
      await movements.createIndex({ referenceType: 1, referenceId: 1 });

      // Sales indexes
      const sales = db.collection("sales");
      await sales.createIndex({ saleNumber: 1 }, { unique: true });
      await sales.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });
      await sales.createIndex({ createdAt: -1 });
      await sales.createIndex({ cashierId: 1, createdAt: -1 });

      console.log("[Database] Collections indexes verified.");
    } catch (indexError) {
      console.warn("[Database] Index creation notice:", indexError.message);
    }
  }
  return db;
}
