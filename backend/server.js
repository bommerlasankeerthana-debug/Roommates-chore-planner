require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const householdRoutes = require("./routes/households");
const choreRoutes = require("./routes/chores");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.warn("WARNING: Set JWT_SECRET to a random secret at least 32 characters long in backend/.env.");
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: "20kb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "Roommates Chore Planner API" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }), authRoutes);
app.use("/api/households", householdRoutes);
app.use("/api/chores", choreRoutes);

app.use(express.static(path.join(__dirname, "..", "frontend")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.use((req, res) => res.status(404).json({ error: "Route not found." }));
app.use((err, req, res, next) => {
  console.error("Request failed:", err.message || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Something went wrong. Check server configuration and logs." });
});

app.listen(PORT, () => console.log(`Roommates Chore Planner running at http://localhost:${PORT}`));