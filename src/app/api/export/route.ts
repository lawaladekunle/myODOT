import { getUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { exportData } from "@/lib/tasks";

export async function GET() {
  const user = await getUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  return new Response(JSON.stringify(exportData(user.id), null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="odot-export-${todayISO()}.json"`,
    },
  });
}
