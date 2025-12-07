import * as platformService from "../../services/platform/platform.js";

export const createPlatform = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Platform name is required" });
    }

    const platform = await platformService.createPlatform(name);
    res.status(201).json(platform);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPlatforms = async (req, res) => {
  try {
    const platforms = await platformService.getPlatforms();
    if (!platforms || platforms.length === 0) {
      return res.status(404).json({ message: "No platforms found" });
    }
    res.status(200).json(platforms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPlatformById = async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: "Platform ID is required" });
    }

    const platform = await platformService.getPlatformById(req.params.id);
    if (!platform) {
      return res.status(404).json({ message: "Platform not found" });
    }
    res.status(200).json(platform);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePlatform = async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: "Platform ID is required" });
    }
    if (!req.body || !req.body.name) {
      return res
        .status(400)
        .json({ message: "Platform name is required to update" });
    }

    const platform = await platformService.updatePlatform(
      req.params.id,
      req.body
    );
    if (!platform) {
      return res.status(404).json({ message: "Platform not found" });
    }
    res.status(200).json(platform);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePlatform = async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: "Platform ID is required" });
    }

    const platform = await platformService.deletePlatform(req.params.id);
    if (!platform) {
      return res.status(404).json({ message: "Platform not found" });
    }
    res.status(200).json({ message: "Platform deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
