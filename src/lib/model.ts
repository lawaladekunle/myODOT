// Shared by server and browser code. Keep it free of Node and zod imports.

export const STATUSES = ["todo", "doing", "done", "dropped"] as const;
export const PRIORITIES = ["high", "medium", "low"] as const;
export const REPEATS = ["daily", "weekly", "monthly", "yearly"] as const;
export const TAG_COLORS = ["blue", "green", "purple", "red", "amber", "teal", "gray", "orange", "pink", "indigo"] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Repeat = (typeof REPEATS)[number];
export type TagColor = (typeof TAG_COLORS)[number];
/** 1 to 4 are the Eisenhower quadrants. null means the task sits in the Inbox, not yet classified. */
export type Quadrant = 1 | 2 | 3 | 4 | null;

export type Task = {
  id: number;
  title: string;
  notes: string;
  quadrant: Quadrant;
  status: Status;
  priority: Priority;
  /** Name of one of the person's areas, such as "Work". */
  area: string;
  dueDate: string | null;
  repeat: Repeat | null;
  tags: string[];
  createdBy: "user" | "agent";
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  deletedAt: string | null;
};

export type TaskPatch = Partial<Pick<Task, "title" | "notes" | "quadrant" | "status" | "priority" | "area" | "dueDate" | "repeat" | "tags">>;

export type Tag = { id: number; name: string; color: TagColor };
/** A top-level bucket shown as a planner tab. Each task belongs to exactly one. */
export type Area = { id: number; name: string; tasks: number };
export const MAX_AREAS = 8;
export const DEFAULT_AREAS = ["Work", "Personal"];

export type Activity = {
  id: number;
  actorKind: "user" | "agent";
  actorName: string;
  action: string;
  changes: Record<string, [unknown, unknown]> | null;
  at: string;
};

export const QUADRANTS = [
  { id: 1, name: "Q1", title: "Do First", sub: "Urgent & Important" },
  { id: 2, name: "Q2", title: "Schedule", sub: "Not Urgent & Important" },
  { id: 3, name: "Q3", title: "Delegate", sub: "Urgent & Not Important" },
  { id: 4, name: "Q4", title: "Eliminate", sub: "Not Urgent & Not Important" },
] as const;

export const STATUS_LABEL: Record<Status, string> = { todo: "To do", doing: "In progress", done: "Done", dropped: "Dropped" };
export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" };
export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
export const REPEAT_LABEL: Record<Repeat, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

export const DEFAULT_TAGS: [string, TagColor][] = [
  ["Dev", "blue"],
  ["Finance", "green"],
  ["Learning", "purple"],
  ["Health", "red"],
  ["Admin", "amber"],
  ["Home", "teal"],
  ["Social", "gray"],
];

export const quadrantKey = (q: Quadrant) => (q === null ? "inbox" : `q${q}`);
export const isClosed = (s: Status) => s === "done" || s === "dropped";
