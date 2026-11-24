import { z } from "zod";
import type { SQLInputValue } from "node:sqlite";
import { db, nowISO, tx, UserError } from "./db";
import type { Actor } from "./auth";
import { nextDue, parseISODate, toISODate, todayISO } from "./dates";
import {
  MAX_AREAS,
  PRIORITIES,
  REPEATS,
  STATUSES,
  TAG_COLORS,
  isClosed,
  type Activity,
  type Area,
  type Status,
  type Tag,
  type TagColor,
  type Task,
} from "./model";

// ---- validation (the trust boundary for the web UI and the agent) ----

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
  .refine((s) => toISODate(parseISODate(s)) === s, "not a real date");

/** Field schemas, with descriptions the MCP server shows to agents. */
export const taskShape = {
  title: z.string().trim().min(1, "can't be empty").max(300).describe("Short task title"),
  notes: z.string().max(20_000).describe("Longer description or notes"),
  quadrant: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .nullable()
    .describe("Eisenhower quadrant. 1 Do First (urgent, important). 2 Schedule (important, not urgent). 3 Delegate (urgent, not important). 4 Eliminate (neither). null puts the task in the Inbox, unclassified."),
  status: z.enum(STATUSES).describe("todo, doing (in progress), done, or dropped (decided not to do it)"),
  priority: z.enum(PRIORITIES).describe("high, medium or low"),
  area: z.string().trim().min(1).max(40).describe("Area name, such as Work or Personal. Must be one of the person's areas from list_areas. Each task has exactly one."),
  dueDate: isoDate.nullable().describe("Due date as YYYY-MM-DD, or null for no date"),
  repeat: z.enum(REPEATS).nullable().describe("Repeat rule. Completing a repeating task creates the next occurrence. null for one-off tasks."),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).describe("Tag names. Unknown names create new tags. Replaces the task's whole tag list."),
};

const patchSchema = z.object(taskShape).partial().strict();
const createSchema = patchSchema.required({ title: true });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new UserError(r.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
  return r.data;
}

// ---- reads ----

const SELECT = `
  SELECT t.*, (
    SELECT json_group_array(name) FROM (
      SELECT g.name FROM task_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.task_id = t.id ORDER BY g.name
    )
  ) AS tag_names, (SELECT name FROM areas a WHERE a.id = t.area_id) AS area_name
  FROM tasks t`;

type Row = Record<string, string | number | null>;

function toTask(r: Row): Task {
  return {
    id: r.id as number,
    title: r.title as string,
    notes: r.notes as string,
    quadrant: (r.quadrant as Task["quadrant"]) ?? null,
    status: r.status as Status,
    priority: r.priority as Task["priority"],
    area: (r.area_name as string) ?? "",
    dueDate: (r.due_date as string) ?? null,
    repeat: (r.repeat as Task["repeat"]) ?? null,
    tags: JSON.parse((r.tag_names as string) ?? "[]"),
    createdBy: r.created_by as Task["createdBy"],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    startedAt: (r.started_at as string) ?? null,
    completedAt: (r.completed_at as string) ?? null,
    deletedAt: (r.deleted_at as string) ?? null,
  };
}

export type TaskFilter = {
  status?: Status[];
  quadrant?: 1 | 2 | 3 | 4 | "inbox";
  /** Area name. */
  area?: string;
  tag?: string;
  search?: string;
  /** Due on or before this YYYY-MM-DD date. */
  dueBefore?: string;
  /** Closed at or after this ISO timestamp. */
  completedFrom?: string;
  /** Closed before this ISO timestamp. */
  completedTo?: string;
  /** Open tasks, plus tasks closed at or after this ISO timestamp. */
  openOrClosedSince?: string;
  deleted?: boolean;
  limit?: number;
};

export function listTasks(userId: number, f: TaskFilter = {}): Task[] {
  const where = ["t.user_id = :uid", f.deleted ? "t.deleted_at IS NOT NULL" : "t.deleted_at IS NULL"];
  const p: Record<string, SQLInputValue> = { uid: userId, limit: f.limit ?? 5000 };
  if (f.status?.length) {
    where.push(`t.status IN (${f.status.map((_, i) => `:s${i}`).join(", ")})`);
    f.status.forEach((s, i) => (p[`s${i}`] = s));
  }
  if (f.quadrant === "inbox") where.push("t.quadrant IS NULL");
  else if (f.quadrant) {
    where.push("t.quadrant = :q");
    p.q = f.quadrant;
  }
  if (f.area) {
    where.push("t.area_id = (SELECT id FROM areas WHERE user_id = :uid AND name = :area)");
    p.area = f.area;
  }
  if (f.tag) {
    where.push("EXISTS (SELECT 1 FROM task_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.task_id = t.id AND g.name = :tag)");
    p.tag = f.tag;
  }
  if (f.search) {
    where.push(`(t.title LIKE :search ESCAPE '\\' OR t.notes LIKE :search ESCAPE '\\')`);
    p.search = `%${f.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  }
  if (f.dueBefore) {
    where.push("t.due_date <= :due");
    p.due = f.dueBefore;
  }
  if (f.completedFrom) {
    where.push("t.completed_at >= :cf");
    p.cf = f.completedFrom;
  }
  if (f.completedTo) {
    where.push("t.completed_at < :ct");
    p.ct = f.completedTo;
  }
  if (f.openOrClosedSince) {
    where.push("(t.status IN ('todo', 'doing') OR t.completed_at >= :since)");
    p.since = f.openOrClosedSince;
  }
  const order = f.deleted ? "t.deleted_at DESC" : f.completedFrom || f.completedTo ? "t.completed_at DESC" : "t.id";
  return (db().prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT :limit`).all(p) as Row[]).map(toTask);
}

/** What the planner shows: open tasks plus anything closed in the last 8 days ("done today" and the board's Done column). */
export function listActiveTasks(userId: number) {
  return listTasks(userId, { openOrClosedSince: new Date(Date.now() - 8 * 864e5).toISOString() });
}

export function getTask(userId: number, id: number, opts: { deleted?: boolean } = {}): Task | null {
  const r = db()
    .prepare(`${SELECT} WHERE t.id = ? AND t.user_id = ? AND t.deleted_at IS ${opts.deleted ? "NOT NULL" : "NULL"}`)
    .get(id, userId) as Row | undefined;
  return r ? toTask(r) : null;
}

export function historyYears(userId: number): number[] {
  return (
    db()
      .prepare(
        "SELECT DISTINCT substr(completed_at, 1, 4) AS y FROM tasks WHERE user_id = ? AND status IN ('done', 'dropped') AND deleted_at IS NULL ORDER BY y DESC",
      )
      .all(userId) as { y: string }[]
  ).map((r) => Number(r.y));
}

export function listActivity(userId: number, taskId: number): Activity[] {
  return (
    db()
      .prepare(
        "SELECT a.* FROM activity a JOIN tasks t ON t.id = a.task_id WHERE a.task_id = ? AND t.user_id = ? ORDER BY a.id DESC LIMIT 200",
      )
      .all(taskId, userId) as Row[]
  ).map((r) => ({
    id: r.id as number,
    actorKind: r.actor_kind as Activity["actorKind"],
    actorName: r.actor_name as string,
    action: r.action as string,
    changes: r.changes ? JSON.parse(r.changes as string) : null,
    at: r.at as string,
  }));
}

// ---- writes ----

function log(actor: Actor, taskId: number, action: string, changes: Record<string, [unknown, unknown]> | null) {
  db()
    .prepare("INSERT INTO activity (task_id, actor_kind, actor_name, action, changes) VALUES (?, ?, ?, ?, ?)")
    .run(taskId, actor.kind, actor.name, action, changes ? JSON.stringify(changes) : null);
}

const DIFF_FIELDS = ["title", "notes", "quadrant", "status", "priority", "area", "dueDate", "repeat", "tags"] as const;

function diff(a: Task, b: Task) {
  const out: Record<string, [unknown, unknown]> = {};
  for (const k of DIFF_FIELDS) {
    if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
    out[k] = k === "notes" ? [a.notes.slice(0, 200), b.notes.slice(0, 200)] : [a[k], b[k]];
  }
  return out;
}

function setTags(userId: number, taskId: number, names: string[]) {
  const ids = ensureTags(userId, names).map((t) => t.id);
  db().prepare("DELETE FROM task_tags WHERE task_id = ?").run(taskId);
  const add = db().prepare("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)");
  for (const id of ids) add.run(taskId, id);
}

function insertTask(actor: Actor, d: z.infer<typeof createSchema>, repeatedFrom: number | null) {
  const now = nowISO();
  const status = d.status ?? "todo";
  const { lastInsertRowid } = db()
    .prepare(
      `INSERT INTO tasks (user_id, title, notes, quadrant, status, priority, area_id, due_date, repeat, repeated_from, created_by, created_at, updated_at, started_at, completed_at)
       VALUES (:uid, :title, :notes, :quadrant, :status, :priority, :area, :due, :repeat, :from, :by, :now, :now, :started, :completed)`,
    )
    .run({
      uid: actor.userId,
      title: d.title,
      notes: d.notes ?? "",
      quadrant: d.quadrant ?? null,
      status,
      priority: d.priority ?? "medium",
      area: areaId(actor.userId, d.area),
      due: d.dueDate ?? null,
      repeat: d.repeat ?? null,
      from: repeatedFrom,
      by: actor.kind,
      now,
      started: status === "doing" ? now : null,
      completed: isClosed(status) ? now : null,
    });
  const id = Number(lastInsertRowid);
  if (d.tags?.length) setTags(actor.userId, id, d.tags);
  return id;
}

export function createTask(actor: Actor, input: unknown): Task {
  const d = parse(createSchema, input);
  return tx(() => {
    const id = insertTask(actor, d, null);
    log(actor, id, "created", null);
    return getTask(actor.userId, id)!;
  });
}

export function updateTask(actor: Actor, id: number, input: unknown): { task: Task; next?: Task } {
  const p = parse(patchSchema, input);
  return tx(() => {
    const before = getTask(actor.userId, id);
    if (!before) throw new UserError(`Task ${id} not found.`);
    const now = nowISO();
    const status = p.status ?? before.status;
    let { startedAt, completedAt } = before;
    if (status !== before.status) {
      if (status === "doing") startedAt ??= now;
      completedAt = isClosed(status) ? now : null;
    }
    const m = { ...before, ...p };
    db()
      .prepare(
        `UPDATE tasks SET title = :title, notes = :notes, quadrant = :quadrant, status = :status, priority = :priority, area_id = COALESCE(:area, area_id),
         due_date = :due, repeat = :repeat, started_at = :started, completed_at = :completed, updated_at = :now WHERE id = :id`,
      )
      .run({
        id,
        title: m.title,
        notes: m.notes,
        quadrant: m.quadrant,
        status,
        priority: m.priority,
        area: p.area === undefined ? null : areaId(actor.userId, p.area),
        due: m.dueDate,
        repeat: m.repeat,
        started: startedAt,
        completed: completedAt,
        now,
      });
    if (p.tags) setTags(actor.userId, id, p.tags);
    const task = getTask(actor.userId, id)!;

    const changes = diff(before, task);
    if (!Object.keys(changes).length) return { task };
    const action =
      status === before.status ? "updated"
      : status === "done" ? "completed"
      : status === "dropped" ? "dropped"
      : isClosed(before.status) ? "reopened"
      : status === "doing" ? "started"
      : "updated";
    log(actor, id, action, changes);

    let next: Task | undefined;
    if (status === "done" && before.status !== "done" && task.repeat) {
      const today = todayISO();
      const nextId = insertTask(
        actor,
        { ...task, status: "todo", dueDate: nextDue(task.dueDate ?? today, task.repeat, today) },
        task.id,
      );
      log(actor, nextId, "repeated", null);
      next = getTask(actor.userId, nextId)!;
    }
    // Reopening a repeating task: trash the untouched next occurrence so it isn't duplicated on the next completion.
    if (isClosed(before.status) && !isClosed(status)) {
      db()
        .prepare("UPDATE tasks SET deleted_at = ? WHERE repeated_from = ? AND user_id = ? AND status = 'todo' AND deleted_at IS NULL")
        .run(now, id, actor.userId);
    }
    return { task, next };
  });
}

export function deleteTask(actor: Actor, id: number) {
  tx(() => {
    const { changes } = db()
      .prepare("UPDATE tasks SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL")
      .run(nowISO(), id, actor.userId);
    if (!changes) throw new UserError(`Task ${id} not found.`);
    log(actor, id, "deleted", null);
  });
}

export function restoreTask(actor: Actor, id: number): Task {
  return tx(() => {
    const { changes } = db()
      .prepare("UPDATE tasks SET deleted_at = NULL WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL")
      .run(id, actor.userId);
    if (!changes) throw new UserError(`Task ${id} is not in the trash.`);
    log(actor, id, "restored", null);
    return getTask(actor.userId, id)!;
  });
}

/** Permanently deletes trashed tasks. Without an id, empties the whole trash. */
export function purgeTrash(userId: number, id?: number) {
  if (id === undefined) db().prepare("DELETE FROM tasks WHERE user_id = ? AND deleted_at IS NOT NULL").run(userId);
  else db().prepare("DELETE FROM tasks WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL").run(id, userId);
}

// ---- tags ----

export function listTags(userId: number): Tag[] {
  // node:sqlite rows have a null prototype, which React refuses to pass to client components.
  return (db().prepare("SELECT id, name, color FROM tags WHERE user_id = ? ORDER BY id").all(userId) as Tag[]).map((t) => ({ ...t }));
}

/** Returns tags for the given names, creating missing ones with the next palette colour. */
export function ensureTags(userId: number, names: string[]): Tag[] {
  const find = db().prepare("SELECT id, name, color FROM tags WHERE user_id = ? AND name = ?");
  const add = db().prepare("INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)");
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))].map((name) => {
    const found = find.get(userId, name) as Tag | undefined;
    if (found) return { ...found };
    const { n } = db().prepare("SELECT COUNT(*) AS n FROM tags WHERE user_id = ?").get(userId) as { n: number };
    const color = TAG_COLORS[n % TAG_COLORS.length];
    const { lastInsertRowid } = add.run(userId, name, color);
    return { id: Number(lastInsertRowid), name, color };
  });
}

const tagSchema = z.object({ name: z.string().trim().min(1).max(40), color: z.enum(TAG_COLORS) }).partial().strict();

export function updateTag(userId: number, id: number, input: { name?: string; color?: TagColor }) {
  const d = parse(tagSchema, input);
  try {
    const { changes } = db()
      .prepare("UPDATE tags SET name = COALESCE(:name, name), color = COALESCE(:color, color) WHERE id = :id AND user_id = :uid")
      .run({ id, uid: userId, name: d.name ?? null, color: d.color ?? null });
    if (!changes) throw new UserError("Tag not found.");
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) throw new UserError("You already have a tag with that name.");
    throw e;
  }
}

export function deleteTag(userId: number, id: number) {
  db().prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(id, userId);
}

// ---- areas ----

export function listAreas(userId: number): Area[] {
  return (
    db()
      .prepare("SELECT a.id, a.name, (SELECT COUNT(*) FROM tasks t WHERE t.area_id = a.id) AS tasks FROM areas a WHERE a.user_id = ? ORDER BY a.position, a.id")
      .all(userId) as Area[]
  ).map((a) => ({ ...a }));
}

/** The id of the named area, or of the first area when no name is given. */
function areaId(userId: number, name?: string): number {
  const r = (
    name === undefined
      ? db().prepare("SELECT id FROM areas WHERE user_id = ? ORDER BY position, id LIMIT 1").get(userId)
      : db().prepare("SELECT id FROM areas WHERE user_id = ? AND name = ?").get(userId, name.trim())
  ) as { id: number } | undefined;
  if (r) return r.id;
  throw new UserError(`Unknown area "${name}". Use one of: ${listAreas(userId).map((a) => a.name).join(", ")}.`);
}

const areaName = z.string().trim().min(1, "Enter a name.").max(40);

function uniqueName<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) throw new UserError("You already have an area with that name.");
    throw e;
  }
}

export function createArea(userId: number, name: string) {
  const n = parse(areaName, name);
  tx(() => {
    const { count, last } = db().prepare("SELECT COUNT(*) AS count, MAX(position) AS last FROM areas WHERE user_id = ?").get(userId) as { count: number; last: number | null };
    if (count >= MAX_AREAS) throw new UserError(`You can have up to ${MAX_AREAS} areas.`);
    uniqueName(() => db().prepare("INSERT INTO areas (user_id, name, position) VALUES (?, ?, ?)").run(userId, n, (last ?? -1) + 1));
  });
}

export function renameArea(userId: number, id: number, name: string) {
  const n = parse(areaName, name);
  const { changes } = uniqueName(() => db().prepare("UPDATE areas SET name = ? WHERE id = ? AND user_id = ?").run(n, id, userId));
  if (!changes) throw new UserError("Area not found.");
}

/** Moves an area one place earlier (-1) or later (1) in the tab order. */
export function moveArea(userId: number, id: number, dir: -1 | 1) {
  tx(() => {
    const ids = listAreas(userId).map((a) => a.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const set = db().prepare("UPDATE areas SET position = ? WHERE id = ?");
    ids.forEach((aid, pos) => set.run(pos, aid));
  });
}

/** Deletes an area. Its tasks, including closed and trashed ones, move to `moveTo` first. */
export function deleteArea(userId: number, id: number, moveTo?: number) {
  tx(() => {
    const areas = listAreas(userId);
    const area = areas.find((a) => a.id === id);
    if (!area) throw new UserError("Area not found.");
    if (areas.length === 1) throw new UserError("You need at least one area.");
    if (area.tasks > 0) {
      if (moveTo === id || !areas.some((a) => a.id === moveTo)) throw new UserError(`Pick another area for its ${area.tasks} tasks.`);
      db().prepare("UPDATE tasks SET area_id = ? WHERE area_id = ? AND user_id = ?").run(moveTo!, id, userId);
    }
    db().prepare("DELETE FROM areas WHERE id = ? AND user_id = ?").run(id, userId);
  });
}

// ---- export ----

export function exportData(userId: number) {
  return {
    exportedAt: nowISO(),
    areas: listAreas(userId),
    tags: listTags(userId),
    tasks: [...listTasks(userId, { limit: 1e9 }), ...listTasks(userId, { deleted: true, limit: 1e9 })],
    activity: db()
      .prepare("SELECT a.* FROM activity a JOIN tasks t ON t.id = a.task_id WHERE t.user_id = ? ORDER BY a.id")
      .all(userId),
  };
}
