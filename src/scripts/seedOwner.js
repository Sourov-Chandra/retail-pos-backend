import { auth } from "../config/auth.js";
import { client, db, connectDB } from "../config/db.js";

// Helper to parse CLI arguments (e.g. --email test@example.com --password secret --name "My Name")
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
      result[key] = value;
    }
  }
  return result;
}

async function seedOwner() {
  const cliArgs = parseArgs();

  const name = cliArgs.name || process.env.OWNER_NAME || "Shop Owner";
  const email = (cliArgs.email || process.env.OWNER_EMAIL || "owner@retailpos.com").toLowerCase().trim();
  const password = cliArgs.password || process.env.OWNER_PASSWORD || "Owner@123456";

  console.log(`[SeedOwner] Initializing owner provisioning...`);
  console.log(`[SeedOwner] Target Email: ${email}`);
  console.log(`[SeedOwner] Target Name:  ${name}`);

  try {
    await connectDB();
    const userCollection = db.collection("user");

    // 1. Check if an owner already exists
    const existingOwner = await userCollection.findOne({ role: "owner" });
    if (existingOwner) {
      console.log(`[SeedOwner] Notice: An owner account already exists!`);
      console.log(`  - Name:  ${existingOwner.name}`);
      console.log(`  - Email: ${existingOwner.email}`);
      console.log(`  - Role:  ${existingOwner.role}`);
      console.log(`[SeedOwner] To promote a different user or change credentials, update the record directly or pass specific flags.`);
      await client.close();
      process.exit(0);
    }

    // 2. Check if a user with this email already exists
    const existingUser = await userCollection.findOne({ email });

    if (existingUser) {
      console.log(`[SeedOwner] User with email ${email} already exists. Promoting to 'owner'...`);
      await userCollection.updateOne(
        { _id: existingUser._id },
        { $set: { role: "owner", updatedAt: new Date() } }
      );
      console.log(`[SeedOwner] Successfully promoted ${email} to 'owner'!`);
    } else {
      console.log(`[SeedOwner] Creating new owner account via Better Auth...`);
      const response = await auth.api.signUpEmail({
        body: {
          name,
          email,
          password,
        },
      });

      if (!response || !response.user) {
        throw new Error("Failed to create user via Better Auth API.");
      }

      // Update role to 'owner'
      await userCollection.updateOne(
        { email },
        { $set: { role: "owner", updatedAt: new Date() } }
      );

      console.log(`[SeedOwner] Owner account created successfully!`);
      console.log(`  - User ID: ${response.user.id}`);
      console.log(`  - Name:    ${response.user.name}`);
      console.log(`  - Email:   ${response.user.email}`);
      console.log(`  - Role:    owner`);
    }

    console.log(`[SeedOwner] Initial owner setup completed successfully.`);
  } catch (error) {
    console.error(`[SeedOwner] Error provisioning owner:`, error);
    process.exit(1);
  } finally {
    await client.close();
    process.exit(0);
  }
}

seedOwner();
