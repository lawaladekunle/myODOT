import { cookies } from "next/headers";
import { Planner } from "@/components/planner/Planner";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { PREFS_COOKIE, parsePrefs } from "@/lib/prefs";
import { listActiveTasks, listTags } from "@/lib/tasks";

export default async function PlannerPage() {
  const user = await requireUser();
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  return (
    <Planner
      initialTasks={listActiveTasks(user.id)}
      initialTags={listTags(user.id)}
      initialPrefs={prefs}
      serverToday={todayISO()}
    />
  );
}
