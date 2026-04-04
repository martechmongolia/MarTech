import { redirect } from "next/navigation";
import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";

export default async function SetupOrganizationPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const organization = await getCurrentUserOrganization(user.id);
  if (organization) {
    redirect("/dashboard");
  }

  return (
    <section className="ui-customer-stack">
      <PageHeader
        title="Байгууллага үүсгэх"
        description="Dashboard ашиглаж эхлэхийн тулд байгууллагаа тохируулна уу."
      />
      <CreateOrganizationForm />
    </section>
  );
}
