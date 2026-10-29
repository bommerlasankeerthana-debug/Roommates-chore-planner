const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../supabase");
const { cleanString, validEmail } = require("../utils/validation");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}

router.post("/register", async (req, res, next) => {
  try {
    const name = cleanString(req.body.name, 80);
    const email = cleanString(req.body.email, 254).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (name.length < 2) return res.status(400).json({ error: "Name must contain at least 2 characters." });
    if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must be 8–72 characters long." });

    const { data: existing, error: lookupError } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

    const password_hash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase.from("profiles")
      .insert({ name, email, password_hash }).select("id,name,email,created_at").single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "An account with this email already exists." });
      throw error;
    }
    return res.status(201).json({ token: signToken(user), user });
  } catch (err) { next(err); }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = cleanString(req.body.email, 254).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!validEmail(email) || !password) return res.status(400).json({ error: "Enter your email and password." });
    const { data: user, error } = await supabase.from("profiles")
      .select("id,name,email,password_hash,created_at").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    const safeUser = { id: user.id, name: user.name, email: user.email, created_at: user.created_at };
    return res.json({ token: signToken(safeUser), user: safeUser });
  } catch (err) { next(err); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase.from("profiles")
      .select("id,name,email,created_at").eq("id", req.user.sub).maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ error: "Account not found." });
    res.json({ user });
  } catch (err) { next(err); }
});

module.exports = router;