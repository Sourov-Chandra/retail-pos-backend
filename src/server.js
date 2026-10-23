import app from "./app.js";
import { config } from "./config/env.js";
import { connectDB } from "./config/db.js";

async function startServer() {
  try {
    console.log("[Server] Connecting to MongoDB...");
    await connectDB();

    app.listen(config.port, () => {
      console.log(`[Server] Retail POS API is running on http://localhost:${config.port}`);
      console.log(`[Server] Better Auth mounted at http://localhost:${config.port}/api/auth`);
      console.log(`[Server] Health check available at http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error("[Server] Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
