import { betterAuth } from "better-auth";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "@better-auth/mongo-adapter";

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017/database");
const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),
});
