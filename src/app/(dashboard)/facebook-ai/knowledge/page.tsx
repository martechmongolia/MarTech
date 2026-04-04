import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { KnowledgeBaseClient } from "./KnowledgeBaseClient";

export default async function KnowledgeBasePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) redirect("/setup-organization");

  return <KnowledgeBaseClient orgId={organization.id} />;
}
