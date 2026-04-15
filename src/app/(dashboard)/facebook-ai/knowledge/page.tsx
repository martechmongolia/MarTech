import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getKnowledgeBase } from "@/modules/facebook-ai/data";
import { KnowledgeBaseClient } from "./KnowledgeBaseClient";

export default async function KnowledgeBasePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) redirect("/setup-organization");

  const items = await getKnowledgeBase(organization.id);

  return <KnowledgeBaseClient orgId={organization.id} initialItems={items} />;
}
