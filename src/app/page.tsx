import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export default async function RootPage() {
  const current = await getCurrentSession();
  redirect(current ? "/dashboard" : "/login");
}
