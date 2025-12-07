import bcrypt from "bcryptjs";
import User from "../../models/user/user.js";

export const loginService = async (username, password) => {
  const user = await User.findOne({ username }).select("+password");
  if (!user) {
    return { success: false, message: "Invalid username or password" };
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return { success: false, message: "Invalid username or password" };
  }

  // Generate JWT
  const token = user.generateToken();

  return {
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
    },
  };
};

export const registerUserService = async (username, role, password) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return { success: false, message: "Username already exists" };
    }

    // Hash the password
    // const saltRounds = 10;
    // const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      username,
      role,
      password,
    });

    await newUser.save();

    return {
      success: true,
      message: "User registered successfully",
      data: {
        id: newUser._id,
        username: newUser.username,
        role: newUser.role,
      },
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
};
