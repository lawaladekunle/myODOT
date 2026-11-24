import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listTasks } from "@/lib/tasks";
import { TrashList } from "./TrashList";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  const user = await requireUser();
  return <TrashList initialTasks={listTasks(user.id, { deleted: true })} />;
}
