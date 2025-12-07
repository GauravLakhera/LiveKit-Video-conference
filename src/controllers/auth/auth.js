import { loginService, registerUserService } from "../../services/auth/auth.js";

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const result = await loginService(username, password);

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { username, role, password } = req.body;
    if (!username || !role || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, password and role are required",
      });
    }

    const result = await registerUserService(username, role, password);
    if (!result) return res.status(401).json(result);

    return res.status(201).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
