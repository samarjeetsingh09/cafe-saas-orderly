import Link from "next/link";
import { listTemplates } from "@/lib/hq-templates";
import { getPlatformUser } from "@/lib/session";
import { canHq } from "@/lib/hq-permissions";
import { DeleteTemplateButton } from "@/components/admin/DeleteTemplateButton";
import { TemplatePreview } from "@/components/admin/TemplatePreview";
import { PageHeader, Card, Empty, Badge, shortDate } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [templates, user] = await Promise.all([listTemplates(), getPlatformUser()]);
  const canManage = canHq(user!.role, "manageTemplates");

  return (
    <>
      <PageHeader title="Templates" subtitle="Starting points for provisioning — theme, default menu and settings">
        {canManage && (
          <Link href="/admin/templates/new" className="hq-btn" data-variant="accent">
            + New template
          </Link>
        )}
      </PageHeader>

      {templates.length === 0 ? (
        <Card>
          <Empty
            title="No templates yet"
            action={
              canManage ? (
                <Link href="/admin/templates/new" className="hq-btn" data-variant="accent">
                  Create one
                </Link>
              ) : undefined
            }
          >
            Create one here, or open a cafe and use &ldquo;Save as template&rdquo; to snapshot its theme and menu.
          </Empty>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {templates.map((t) => {
            const itemCount = t.categories.reduce((s, c) => s + c.items.length, 0);
            return (
              <Card key={t.id}>
                <TemplatePreview theme={t.theme} name={t.name} />
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</h3>
                    {t.cafeCount > 0 && (
                      <Badge tone="ok">
                        {t.cafeCount} cafe{t.cafeCount === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                  {t.description && <p style={{ fontSize: 12, color: "var(--hq-text-2)", marginTop: 2 }}>{t.description}</p>}
                  <p className="mono" style={{ fontSize: 11, color: "var(--hq-text-3)", marginTop: 5 }}>
                    {t.categories.length} categories · {itemCount} dishes · GST {t.settings.gstPercent}% · added {shortDate(t.createdAt)}
                  </p>
                </div>
                {canManage && (
                  <div style={{ display: "flex", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
                    <Link href={`/admin/cafes/new?templateId=${t.id}`} className="hq-btn" data-size="sm">
                      Provision from this
                    </Link>
                    <DeleteTemplateButton templateId={t.id} disabled={t.cafeCount > 0} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
