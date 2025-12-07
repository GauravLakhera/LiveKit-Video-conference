import jwt from "jsonwebtoken";

export const authCheck = (token) => {
  if (!token) {
    return false;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return false;
  }
};

export const adminAuthCheck = (token) => {
  if (!token) {
    return false;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin" && decoded.role !== "superAdmin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    return decoded;
  } catch (error) {
    return false;
  }
};
