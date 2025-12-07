import jwt from "jsonwebtoken";
import platformModel from "../../models/platform/platform.js";

export const createPlatform = async (name) => {
  const token = jwt.sign({ name }, process.env.JWT_SECRET, {
    expiresIn: "20y",
  });

  const platform = new platformModel({ name, token });
  return await platform.save();
};

export const getPlatforms = async () => {
  return await platformModel.find();
};

export const getPlatformById = async (id) => {
  return await platformModel.findById(id);
};

export const updatePlatform = async (id, data) => {
  return await platformModel.findByIdAndUpdate(id, data, { new: true });
};

export const deletePlatform = async (id) => {
  return await platformModel.findByIdAndDelete(id);
};
