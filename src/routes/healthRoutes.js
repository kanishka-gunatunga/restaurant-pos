const express = require("express");
const router = express.Router();

const sequelize = require('../config/database');

router.get("/", async (req, res) => {
    try {
        // Check MySQL database connection
        await sequelize.authenticate();

        res.status(200).json({
            status: "ok",
            db: "connected",
            timestamp: new Date().toISOString(),
        });

    } catch (err) {
        console.error("Health check DB error:", err.message);

        res.status(500).json({
            status: "error",
            db: "disconnected",
            message: err.message,
            timestamp: new Date().toISOString(),
        });
    }
});

module.exports = router;