import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { FacebookSettingsClient } from "./FacebookSettingsClient";

export default async function FacebookAISettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) redirect("/setup-organization");

  return <FacebookSettingsClient orgId={organization.id} />;
}
