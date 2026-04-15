import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import {
  ensureReplySettingsForConnection,
  getActiveAiPageConnections,
  getReplySettings,
} from "@/modules/facebook-ai/data";
import type { FbPageConnection, FbReplySettings } from "@/modules/facebook-ai/types";
import { FacebookSettingsClient } from "./FacebookSettingsClient";

export type PageSettingsBundle = {
  connection: FbPageConnection;
  settings: FbReplySettings;
};

export default async function FacebookAISettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) redirect("/setup-organization");

  const connections = await getActiveAiPageConnections(organization.id);

  // Lazy-ensure per-connection settings so the form always has a row to edit.
  const bundles: PageSettingsBundle[] = await Promise.all(
    connections.map(async (connection) => {
      let settings = await getReplySettings(connection.id);
      if (!settings) {
        settings = await ensureReplySettingsForConnection(connection.id);
      }
      return { connection, settings };
    }),
  );

  return <FacebookSettingsClient orgId={organization.id} bundles={bundles} />;
}
