import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { historyYears, listTags, listTasks } from "@/lib/tasks";
import { History } from "./History";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const user = await requireUser();
  const thisYear = new Date().getFullYear();
  const years = [...new Set([thisYear, ...historyYears(user.id)])].sort((a, b) => b - a);
  const asked = Number((await searchParams).year);
  const year = years.includes(asked) ? asked : thisYear;
  // A day of slack each side; the browser trims to the local calendar year.
  const tasks = listTasks(user.id, {
    status: ["done", "dropped"],
    completedFrom: `${year - 1}-12-31T00:00:00.000Z`,
    completedTo: `${year + 1}-01-02T00:00:00.000Z`,
    limit: 100_000,
  });
  return <History key={year} year={year} years={years} initialTasks={tasks} tags={listTags(user.id)} />;
}
