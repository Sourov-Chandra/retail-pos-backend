import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { admin } from "better-auth/plugins";
import { client, db } from "./db.js";
import { config } from "./env.js";

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),
  secret: config.betterAuthSecret,
  baseURL: config.betterAuthUrl,
  trustedOrigins: [
    config.frontendUrl,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
      defaultRole: "cashier",
      adminRoles: ["owner"],
      roles: {
        owner: {},
        cashier: {},
      },
    }),
  ],
});
