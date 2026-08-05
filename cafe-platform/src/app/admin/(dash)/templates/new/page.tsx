import { CreateTemplateForm } from "@/components/admin/CreateTemplateForm";
import { PageHeader } from "@/components/admin/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="New template" subtitle="Theme, default menu and settings a new cafe can start from" back={{ href: "/admin/templates", label: "Templates" }} />
      <CreateTemplateForm />
    </>
  );
}
