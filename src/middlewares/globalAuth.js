import {authCheck} from "../utils/authCheck.js";

const globalAuth = (req, res, next) => {
	const token =
		req.header("Authorization")?.replace("Bearer ", "") ||
		req.header("x-auth-token") ||
		req.header("authorization")?.replace("Bearer ", "");

	const decoded = authCheck(token);

	if (!decoded) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	req.tokenData = decoded;

	next();
};

export default globalAuth;
