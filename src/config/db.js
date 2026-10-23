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
  }
  return db;
}
