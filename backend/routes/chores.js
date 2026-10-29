const express = require("express");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const { cleanString, validDate } = require("../utils/validation");

const router = express.Router();
router.use(requireAuth);

async function membership(userId, householdId) {
  const { data, error } = await supabase.from("household_members").select("role")
    .eq("user_id", userId).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data;
}

router.get("/", async (req, res, next) => {
  try {
    const householdId = cleanString(req.query.household_id, 64);
    if (!householdId) return res.status(400).json({ error: "household_id is required." });
    if (!(await membership(req.user.sub, householdId))) return res.status(403).json({ error: "You are not a member of this household." });
    let query = supabase.from("chores").select("id,household_id,title,description,assigned_to,due_date,status,created_by,created_at,updated_at,assignee:profiles!chores_assigned_to_fkey(id,name,email),creator:profiles!chores_created_by_fkey(id,name)")
      .eq("household_id", householdId).order("status", { ascending: true }).order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    if (req.query.status === "pending" || req.query.status === "completed") query = query.eq("status", req.query.status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ chores: data || [] });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const household_id = cleanString(req.body.household_id, 64);
    const title = cleanString(req.body.title, 100);
    const description = cleanString(req.body.description, 500);
    const assigned_to = cleanString(req.body.assigned_to, 64) || null;
    const due_date = req.body.due_date || null;
    if (!household_id) return res.status(400).json({ error: "Choose a household." });
    if (title.length < 2) return res.status(400).json({ error: "Chore title must contain at least 2 characters." });
    if (!validDate(due_date)) return res.status(400).json({ error: "Due date must be a valid date in YYYY-MM-DD format." });
    if (!(await membership(req.user.sub, household_id))) return res.status(403).json({ error: "You are not a member of this household." });
    if (assigned_to) {
      const assignedMember = await membership(assigned_to, household_id);
      if (!assignedMember) return res.status(400).json({ error: "Assignee must be a member of this household." });
    }
    const { data, error } = await supabase.from("chores").insert({
      household_id, title, description: description || null, assigned_to, due_date,
      created_by: req.user.sub, status: "pending"
    }).select("id,household_id,title,description,assigned_to,due_date,status,created_by,created_at,updated_at").single();
    if (error) throw error;
    res.status(201).json({ chore: data });
  } catch (err) { next(err); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase.from("chores")
      .select("id,household_id,assigned_to").eq("id", req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ error: "Chore not found." });
    if (!(await membership(req.user.sub, existing.household_id))) return res.status(403).json({ error: "You are not a member of this household." });

    const updates = {};
    if (req.body.title !== undefined) {
      const title = cleanString(req.body.title, 100);
      if (title.length < 2) return res.status(400).json({ error: "Chore title must contain at least 2 characters." });
      updates.title = title;
    }
    if (req.body.description !== undefined) updates.description = cleanString(req.body.description, 500) || null;
    if (req.body.due_date !== undefined) {
      if (!validDate(req.body.due_date)) return res.status(400).json({ error: "Due date must be YYYY-MM-DD." });
      updates.due_date = req.body.due_date || null;
    }
    if (req.body.assigned_to !== undefined) {
      const assigned_to = cleanString(req.body.assigned_to, 64) || null;
      if (assigned_to && !(await membership(assigned_to, existing.household_id))) return res.status(400).json({ error: "Assignee must be a member of this household." });
      updates.assigned_to = assigned_to;
    }
    if (req.body.status !== undefined) {
      if (!["pending", "completed"].includes(req.body.status)) return res.status(400).json({ error: "Status must be pending or completed." });
      updates.status = req.body.status;
      updates.completed_at = req.body.status === "completed" ? new Date().toISOString() : null;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid changes provided." });
    const { data, error } = await supabase.from("chores").update(updates).eq("id", req.params.id)
      .select("id,household_id,title,description,assigned_to,due_date,status,created_by,created_at,updated_at,completed_at").single();
    if (error) throw error;
    res.json({ chore: data });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase.from("chores")
      .select("id,household_id").eq("id", req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ error: "Chore not found." });
    if (!(await membership(req.user.sub, existing.household_id))) return res.status(403).json({ error: "You are not a member of this household." });
    const { error } = await supabase.from("chores").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ message: "Chore deleted." });
  } catch (err) { next(err); }
});

module.exports = router;