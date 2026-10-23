import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";

/**
 * Middleware to require authenticated user session.
 * Attaches `req.user` and `req.session` to the request object.
 */
export async function requireAuth(req, res, next) {
  try {
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!sessionData || !sessionData.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required. Please sign in.",
        },
      });
    }

    req.user = sessionData.user;
    req.session = sessionData.session;
    next();
  } catch (error) {
    console.error("[AuthMiddleware] Session extraction error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to authenticate session.",
      },
    });
  }
}

/**
 * Middleware to enforce role-based access control.
 * Can accept one or more allowed roles, e.g. requireRole("owner") or requireRole("owner", "cashier").
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required. Please sign in.",
        },
      });
    }

    const userRole = req.user.role || "cashier";

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Access denied. Requires one of roles: [${allowedRoles.join(", ")}]. Current role: ${userRole}`,
        },
      });
    }

    next();
  };
}

// Convenience middleware
export const requireOwner = [requireAuth, requireRole("owner")];
export const requireStaff = [requireAuth, requireRole("owner", "cashier")];
