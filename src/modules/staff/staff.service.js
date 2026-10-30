import { ObjectId } from "mongodb";
import { db } from "../../config/db.js";
import { auth } from "../../config/auth.js";

function toMongoId(id) {
  if (!id) return null;
  if (ObjectId.isValid(id)) {
    return new ObjectId(id);
  }
  return id;
}

export class StaffService {
  /**
   * List all staff members with their role, status, and performance statistics
   */
  async listStaff() {
    const users = await db
      .collection("user")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Aggregate completed sales by cashierId
    const salesStats = await db
      .collection("sales")
      .aggregate([
        {
          $group: {
            _id: "$cashierId",
            salesCount: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" },
          },
        },
      ])
      .toArray();

    const statsMap = new Map();
    for (const stat of salesStats) {
      if (stat._id) {
        statsMap.set(String(stat._id), {
          salesCount: stat.salesCount || 0,
          totalAmount: stat.totalAmount || 0,
        });
      }
    }

    return users.map((u) => {
      const uid = String(u._id);
      const userStats =
        statsMap.get(uid) || statsMap.get(u.id) || { salesCount: 0, totalAmount: 0 };

      return {
        id: uid,
        name: u.name,
        email: u.email,
        role: u.role || "cashier",
        banned: Boolean(u.banned),
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        totalSalesCount: userStats.salesCount,
        totalSalesAmountBDT: Number((userStats.totalAmount / 100).toFixed(2)),
        totalSalesAmountPoisha: userStats.totalAmount,
      };
    });
  }

  /**
   * Create a new staff account (cashier or owner)
   */
  async createStaff({ name, email, password, role = "cashier" }) {
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      const err = new Error("Staff name is required and must be at least 2 characters.");
      err.statusCode = 400;
      err.code = "INVALID_NAME";
      throw err;
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      const err = new Error("A valid email address is required.");
      err.statusCode = 400;
      err.code = "INVALID_EMAIL";
      throw err;
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      const err = new Error("Password must be at least 6 characters long.");
      err.statusCode = 400;
      err.code = "INVALID_PASSWORD";
      throw err;
    }

    const cleanRole = role === "owner" ? "owner" : "cashier";
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    // Check if email already exists
    const existing = await db.collection("user").findOne({ email: cleanEmail });
    if (existing) {
      const err = new Error(`An account with email '${cleanEmail}' already exists.`);
      err.statusCode = 409;
      err.code = "STAFF_EMAIL_EXISTS";
      throw err;
    }

    // Create via Better Auth API
    const response = await auth.api.signUpEmail({
      body: {
        name: cleanName,
        email: cleanEmail,
        password,
      },
    });

    if (!response || !response.user) {
      const err = new Error("Failed to register staff account via auth service.");
      err.statusCode = 500;
      err.code = "AUTH_CREATION_FAILED";
      throw err;
    }

    // Set role and initial status in user collection
    const now = new Date();
    await db.collection("user").updateOne(
      { email: cleanEmail },
      {
        $set: {
          role: cleanRole,
          banned: false,
          updatedAt: now,
        },
      }
    );

    const createdUser = await db.collection("user").findOne({ email: cleanEmail });

    return {
      id: String(createdUser._id),
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      banned: false,
      createdAt: createdUser.createdAt,
      totalSalesCount: 0,
      totalSalesAmountBDT: 0,
    };
  }

  /**
   * Update staff details (name, role, active status)
   */
  async updateStaff(id, { name, role, banned }, currentUserId) {
    const mongoId = toMongoId(id);
    const user = await db.collection("user").findOne({
      $or: [{ _id: mongoId }, { _id: String(id) }, { id: String(id) }],
    });

    if (!user) {
      const err = new Error("Staff member not found.");
      err.statusCode = 404;
      err.code = "STAFF_NOT_FOUND";
      throw err;
    }

    const isTargetSelf =
      String(user._id) === String(currentUserId) || String(user.id) === String(currentUserId);

    // Prevent deactivating or demoting oneself
    if (isTargetSelf) {
      if (banned === true) {
        const err = new Error("You cannot deactivate your own account.");
        err.statusCode = 400;
        err.code = "CANNOT_DEACTIVATE_SELF";
        throw err;
      }
      if (role && role !== "owner") {
        const err = new Error("You cannot demote your own owner role.");
        err.statusCode = 400;
        err.code = "CANNOT_DEMOTE_SELF";
        throw err;
      }
    }

    // Prevent deactivating or demoting the last active owner
    if (user.role === "owner" && (role === "cashier" || banned === true)) {
      const activeOwnerCount = await db.collection("user").countDocuments({
        role: "owner",
        banned: { $ne: true },
      });

      if (activeOwnerCount <= 1) {
        const err = new Error("Cannot demote or deactivate the only remaining active store owner.");
        err.statusCode = 400;
        err.code = "LAST_OWNER_PROTECTED";
        throw err;
      }
    }

    const updateFields = { updatedAt: new Date() };

    if (name && typeof name === "string" && name.trim().length >= 2) {
      updateFields.name = name.trim();
    }

    if (role && (role === "owner" || role === "cashier")) {
      updateFields.role = role;
    }

    if (typeof banned === "boolean") {
      updateFields.banned = banned;
      // If banning user, terminate all active sessions immediately
      if (banned === true) {
        await db.collection("session").deleteMany({
          $or: [{ userId: mongoId }, { userId: String(id) }],
        });
      }
    }

    await db.collection("user").updateOne(
      { $or: [{ _id: mongoId }, { _id: String(id) }, { id: String(id) }] },
      { $set: updateFields }
    );

    const updated = await db.collection("user").findOne({
      $or: [{ _id: mongoId }, { _id: String(id) }, { id: String(id) }],
    });

    return {
      id: String(updated._id),
      name: updated.name,
      email: updated.email,
      role: updated.role,
      banned: Boolean(updated.banned),
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Reset staff password
   */
  async resetPassword(id, newPassword) {
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      const err = new Error("New password must be at least 6 characters long.");
      err.statusCode = 400;
      err.code = "INVALID_PASSWORD";
      throw err;
    }

    const mongoId = toMongoId(id);
    const user = await db.collection("user").findOne({
      $or: [{ _id: mongoId }, { _id: String(id) }, { id: String(id) }],
    });

    if (!user) {
      const err = new Error("Staff member not found.");
      err.statusCode = 404;
      err.code = "STAFF_NOT_FOUND";
      throw err;
    }

    // Hash the password using Better Auth's standard hasher
    const authContext = await auth.$context;
    const hashedPassword = await authContext.password.hash(newPassword);

    // Update password in the account collection
    const accountResult = await db.collection("account").updateMany(
      {
        $or: [
          { userId: mongoId },
          { userId: String(id) },
          { accountId: String(id) },
          { accountId: user.email },
        ],
      },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      }
    );

    // Invalidate sessions so the user logs in with new password
    await db.collection("session").deleteMany({
      $or: [{ userId: mongoId }, { userId: String(id) }],
    });

    return {
      success: true,
      message: `Password successfully updated for ${user.name} (${user.email}).`,
    };
  }

  /**
   * Delete a staff account
   */
  async deleteStaff(id, currentUserId) {
    const mongoId = toMongoId(id);
    const user = await db.collection("user").findOne({
      $or: [{ _id: mongoId }, { _id: String(id) }, { id: String(id) }],
    });

    if (!user) {
      const err = new Error("Staff member not found.");
      err.statusCode = 404;
      err.code = "STAFF_NOT_FOUND";
      throw err;
    }

    const isTargetSelf =
      String(user._id) === String(currentUserId) || String(user.id) === String(currentUserId);

    if (isTargetSelf) {
      const err = new Error("You cannot delete your own account.");
      err.statusCode = 400;
      err.code = "CANNOT_DELETE_SELF";
      throw err;
    }

    if (user.role === "owner") {
      const activeOwnerCount = await db.collection("user").countDocuments({
        role: "owner",
      });

      if (activeOwnerCount <= 1) {
        const err = new Error("Cannot delete the only remaining store owner account.");
        err.statusCode = 400;
        err.code = "LAST_OWNER_PROTECTED";
        throw err;
      }
    }

    // Delete user, credentials, and sessions
    await db.collection("user").deleteOne({ _id: user._id });
    await db.collection("account").deleteMany({
      $or: [
        { userId: mongoId },
        { userId: String(id) },
        { accountId: String(id) },
        { accountId: user.email },
      ],
    });
    await db.collection("session").deleteMany({
      $or: [{ userId: mongoId }, { userId: String(id) }],
    });

    return {
      success: true,
      deletedId: String(user._id),
      name: user.name,
      email: user.email,
    };
  }
}

export const staffService = new StaffService();
