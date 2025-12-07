import express from "express";
import jwt from "jsonwebtoken";
const router = express.Router();


router.get('/', (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        error: 'JWT_SECRET is not configured in environment variables'
      });
    }

    const payload = {
      type: 'developer',
      generated: new Date().toISOString(),
      timestamp: Date.now()
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '365d'
    });

    res.json({
      success: true,
      message: 'Developer API token generated successfully',
      token: token,
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate token',
      details: error.message
    });
  }
});


export default router;
