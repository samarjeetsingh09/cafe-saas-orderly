"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeEditor, DEFAULT_THEME, type ThemeTokens } from "./ThemeEditor";
import { Card, Empty } from "./ui";
import { Field } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import type { TemplateCategory } from "@/lib/hq-templates";

const EMPTY_CATEGORY = (): TemplateCategory => ({ name: "", isVeg: true, items: [] });
const EMPTY_ITEM = () => ({ name: "", description: "", variants: [{ label: "Regular", pricePaise: 0 }] });

export function CreateTemplateForm() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState<ThemeTokens>(DEFAULT_THEME);
  const [gstPercent, setGstPercent] = useState(5);
  const [splitKitchen, setSplitKitchen] = useState(true);
  const [categories, setCategories] = useState<TemplateCategory[]>([EMPTY_CATEGORY()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateCategory(i: number, patch: Partial<TemplateCategory>) {
    setCategories((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  // Empty categories are dropped on save, so say so up front rather than
  // letting the operator wonder where their half-filled row went.
  const keptCategories = categories.filter((c) => c.name && c.items.length > 0);
  const droppedCount = categories.length - keptCategories.length;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        theme,
        categories: keptCategories,
        settings: { gstPercent, splitKitchen, prepMinutes: 12 },
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error ?? "Failed to save";
      setError(msg);
      return toast.push(msg, "danger");
    }
    toast.push(`Template "${name}" saved`, "ok");
    router.push("/admin/templates");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card title="Details">
        <div className="hq-formgrid">
          <Field label="Name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee Shop" />
          </Field>
          <Field label="Description">
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Default GST %">
            <input type="number" step="0.01" value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value))} />
          </Field>
          <label className="hq-check">
            <input type="checkbox" checked={splitKitchen} onChange={(e) => setSplitKitchen(e.target.checked)} />
            <span>Split kitchen by default</span>
          </label>
        </div>
      </Card>

      <Card title="Theme">
        <ThemeEditor value={theme} onChange={setTheme} />
      </Card>

      <Card
        title="Default menu"
        sub={droppedCount > 0 ? `${droppedCount} empty ${droppedCount === 1 ? "category" : "categories"} will be dropped on save` : undefined}
        action={
          <button className="hq-btn" data-size="sm" onClick={() => setCategories((c) => [...c, EMPTY_CATEGORY()])}>
            + Category
          </button>
        }
      >
        {categories.length === 0 ? (
          <Empty title="No categories">A template with no menu still carries its theme and settings.</Empty>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {categories.map((c, ci) => (
              <div key={ci} style={{ border: "1px solid var(--hq-line-soft)", borderRadius: "var(--hq-r-sm)", padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateCategory(ci, { name: e.target.value })}
                    placeholder="Category name"
                    style={{ flex: "1 1 160px", width: "auto" }}
                  />
                  <label className="hq-check" style={{ padding: 0 }}>
                    <input type="checkbox" checked={c.isVeg} onChange={(e) => updateCategory(ci, { isVeg: e.target.checked })} />
                    <span>Veg</span>
                  </label>
                  <button className="hq-btn" data-variant="danger" data-size="sm" onClick={() => setCategories((cs) => cs.filter((_, idx) => idx !== ci))}>
                    Remove
                  </button>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  {c.items.map((it, ii) => (
                    <div key={ii} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, background: "var(--hq-surface-2)", borderRadius: "var(--hq-r-sm)", padding: 6 }}>
                      <input
                        type="text"
                        value={it.name}
                        onChange={(e) => updateCategory(ci, { items: c.items.map((x, idx) => (idx === ii ? { ...x, name: e.target.value } : x)) })}
                        placeholder="Dish name"
                        style={{ flex: "1 1 160px", width: "auto" }}
                      />
                      <input
                        type="number"
                        value={it.variants[0]?.pricePaise ? it.variants[0].pricePaise / 100 : 0}
                        onChange={(e) =>
                          updateCategory(ci, {
                            items: c.items.map((x, idx) =>
                              idx === ii ? { ...x, variants: [{ label: "Regular", pricePaise: Math.round(Number(e.target.value) * 100) }] } : x
                            ),
                          })
                        }
                        placeholder="Price ₹"
                        style={{ width: 90 }}
                      />
                      <button className="hq-btn" data-variant="ghost" data-size="sm" aria-label="Remove dish" onClick={() => updateCategory(ci, { items: c.items.filter((_, idx) => idx !== ii) })}>
                        ✕
                      </button>
                    </div>
                  ))}
                  <div>
                    <button className="hq-btn" data-size="sm" onClick={() => updateCategory(ci, { items: [...c.items, EMPTY_ITEM()] })}>
                      + Dish
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {error && (
        <div className="hq-note" data-tone="danger">
          {error}
        </div>
      )}
      <div>
        <button className="hq-btn" data-variant="primary" disabled={busy || !name} onClick={save}>
          {busy ? "Saving…" : "Save template"}
        </button>
      </div>
    </div>
  );
}
