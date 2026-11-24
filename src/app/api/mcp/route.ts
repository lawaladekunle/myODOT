import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { actorFromBearer, type Actor } from "@/lib/auth";
import { UserError } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { AREAS, QUADRANTS, STATUSES } from "@/lib/model";
import * as tasks from "@/lib/tasks";

const INSTRUCTIONS = `ODOT is a personal task planner built on the Eisenhower matrix.
Every task has a quadrant: ${QUADRANTS.map((q) => `${q.id} = ${q.title} (${q.sub})`).join("; ")}.
A task with quadrant null sits in the Inbox, waiting to be classified. Classifying Inbox tasks is a common job: read each one, then set quadrant, priority, area, tags and dueDate with update_task.
Status is todo, doing, done or dropped. Completing a repeating task creates its next occurrence automatically.
Deleted tasks go to the trash, where the user can restore them. Every change you make is logged under your token's name.
Dates are YYYY-MM-DD. Today's date on the server is in the response of list_tasks as "today".`;

const updateShape = Object.fromEntries(Object.entries(tasks.taskShape).map(([k, v]) => [k, v.optional()])) as {
  [K in keyof typeof tasks.taskShape]: z.ZodOptional<(typeof tasks.taskShape)[K]>;
};
const createShape = { ...updateShape, title: tasks.taskShape.title };

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

/** Runs a tool body and turns user-facing errors into tool errors the agent can read and fix. */
function tool<A>(fn: (args: A) => unknown) {
  return async (args: A) => {
    try {
      return json(await fn(args));
    } catch (e) {
      if (e instanceof UserError) return { ...json({ error: e.message }), isError: true };
      throw e;
    }
  };
}

function buildServer(actor: Actor) {
  const server = new McpServer({ name: "odot", version: "1.0.0" }, { instructions: INSTRUCTIONS });
  const id = z.number().int().positive().describe("Task id");

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: "Find tasks. With no filters, returns open tasks (todo and doing). Closed tasks need a status or completed date filter.",
      inputSchema: {
        status: z.array(z.enum(STATUSES)).optional().describe("Defaults to [\"todo\", \"doing\"]"),
        quadrant: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal("inbox")]).optional(),
        area: z.enum(AREAS).optional(),
        tag: z.string().optional(),
        search: z.string().optional().describe("Matches title or notes"),
        dueBefore: z.string().optional().describe("YYYY-MM-DD, inclusive. Use today's date to find due and overdue tasks."),
        completedFrom: z.string().optional().describe("ISO date or timestamp, inclusive"),
        completedTo: z.string().optional().describe("ISO date or timestamp, exclusive"),
        limit: z.number().int().min(1).max(500).optional().describe("Default 100"),
      },
      annotations: { readOnlyHint: true },
    },
    tool((f) => {
      const closedFilter = f.completedFrom || f.completedTo;
      const list = tasks.listTasks(actor.userId, {
        ...f,
        status: f.status ?? (closedFilter ? ["done", "dropped"] : ["todo", "doing"]),
        limit: f.limit ?? 100,
      });
      return { today: todayISO(), count: list.length, tasks: list };
    }),
  );

  server.registerTool(
    "get_task",
    { title: "Get task", description: "One task with its change history.", inputSchema: { id }, annotations: { readOnlyHint: true } },
    tool(({ id }) => {
      const task = tasks.getTask(actor.userId, id);
      if (!task) throw new UserError(`Task ${id} not found.`);
      return { task, activity: tasks.listActivity(actor.userId, id) };
    }),
  );

  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description: "Add a task. Leave quadrant out to put it in the Inbox.",
      inputSchema: createShape,
    },
    tool((input) => tasks.createTask(actor, input)),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description: "Change any fields of a task. Send only the fields you want to change. Use this to classify Inbox tasks.",
      inputSchema: { id, ...updateShape },
    },
    tool(({ id, ...patch }) => tasks.updateTask(actor, id, patch)),
  );

  server.registerTool(
    "complete_task",
    { title: "Complete task", description: "Mark a task done. A repeating task gets its next occurrence.", inputSchema: { id } },
    tool(({ id }) => tasks.updateTask(actor, id, { status: "done" })),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description: "Move a task to the trash. The user can restore it. Prefer status \"dropped\" for tasks the user decided not to do.",
      inputSchema: { id },
      annotations: { destructiveHint: true },
    },
    tool(({ id }) => {
      tasks.deleteTask(actor, id);
      return { deleted: id };
    }),
  );

  server.registerTool(
    "list_tags",
    { title: "List tags", description: "The user's tags and their colours.", inputSchema: {}, annotations: { readOnlyHint: true } },
    tool(() => tasks.listTags(actor.userId)),
  );

  return server;
}

async function handle(req: Request) {
  const actor = actorFromBearer(req);
  if (!actor) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Missing or invalid API token. Create one in ODOT under Settings, then send it as 'Authorization: Bearer <token>'." }, id: null },
      { status: 401 },
    );
  }
  // Stateless: a fresh server per request, scoped to the token's user.
  const server = buildServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
