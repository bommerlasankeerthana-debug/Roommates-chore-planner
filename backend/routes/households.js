const express = require("express");
const crypto = require("crypto");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const { cleanString } = require("../utils/validation");

const router = express.Router();
router.use(requireAuth);

async function getMembership(userId, householdId) {
  const { data, error } = await supabase.from("household_members")
    .select("household_id,user_id,role,joined_at").eq("household_id", householdId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("household_members")
      .select("role,households(id,name,invite_code,created_at)")
      .eq("user_id", req.user.sub).order("joined_at", { ascending: true });
    if (error) throw error;
    const households = (data || []).map(row => ({ ...row.households, role: row.role }));
    res.json({ households });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const name = cleanString(req.body.name, 80);
    if (name.length < 2) return res.status(400).json({ error: "Household name must contain at least 2 characters." });
    const invite_code = crypto.randomBytes(4).toString("hex").toUpperCase();
    const { data: household, error: createError } = await supabase.from("households")
      .insert({ name, invite_code, created_by: req.user.sub }).select("id,name,invite_code,created_at").single();
    if (createError) throw createError;
    const { error: memberError } = await supabase.from("household_members")
      .insert({ household_id: household.id, user_id: req.user.sub, role: "owner" });
    if (memberError) {
      await supabase.from("households").delete().eq("id", household.id);
      throw memberError;
    }
    res.status(201).json({ household: { ...household, role: "owner" } });
  } catch (err) { next(err); }
});

router.post("/join", async (req, res, next) => {
  try {
    const invite_code = cleanString(req.body.invite_code, 12).toUpperCase();
    if (!/^[A-F0-9]{8}$/.test(invite_code)) return res.status(400).json({ error: "Enter the 8-character invite code." });
    const { data: household, error } = await supabase.from("households")
      .select("id,name,invite_code,created_at").eq("invite_code", invite_code).maybeSingle();
    if (error) throw error;
    if (!household) return res.status(404).json({ error: "No household found for that invite code." });
    const current = await getMembership(req.user.sub, household.id);
    if (current) return res.status(409).json({ error: "You already belong to this household." });
    const { error: joinError } = await supabase.from("household_members")
      .insert({ household_id: household.id, user_id: req.user.sub, role: "member" });
    if (joinError) {
      if (joinError.code === "23505") return res.status(409).json({ error: "You already belong to this household." });
      throw joinError;
    }
    res.status(201).json({ household: { ...household, role: "member" } });
  } catch (err) { next(err); }
});

router.get("/:id/members", async (req, res, next) => {
  try {
    const membership = await getMembership(req.user.sub, req.params.id);
    if (!membership) return res.status(403).json({ error: "You are not a member of this household." });
    const { data, error } = await supabase.from("household_members")
      .select("role,joined_at,profiles(id,name,email)").eq("household_id", req.params.id).order("joined_at");
    if (error) throw error;
    res.json({ members: (data || []).map(row => ({ ...row.profiles, role: row.role, joined_at: row.joined_at })) });
  } catch (err) { next(err); }
});

module.exports = router;