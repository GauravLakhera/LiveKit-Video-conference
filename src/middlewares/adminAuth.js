import {adminAuthCheck} from "../utils/authCheck.js";

const adminAuth = (req, res, next) => {
    const token =
        req.header("Authorization")?.replace("Bearer ", "") ||
        req.header("x-auth-token") ||
        req.header("authorization")?.replace("Bearer ", "");

    const decoded = adminAuthCheck(token);

    if (!decoded) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    req.tokenData = decoded;

    next();
};

export default adminAuth;
