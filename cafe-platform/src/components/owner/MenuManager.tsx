"use client";

import { useState } from "react";
import type { ProfileRole } from "@prisma/client";
import type { CustomerCategoryDTO, CustomerItemDTO, CustomerVariantDTO } from "@/lib/menu";
import { can } from "@/lib/permissions";
import { Modal } from "@/components/owner/Modal";

/**
 * Menu manager — ported verbatim from plan/bella-admin-console.html's
 * "Menu" tab (`renderMenu`/`catCard`/`dishRow`/`catForm`/`dishForm`, Phase
 * H #1). Mock `CATS`/`CATALOG` arrays are replaced by real CRUD against
 * `Category`/`MenuItem`/`ItemVariant` (`POST/DELETE /api/menu/categories`,
 * `POST/PATCH/DELETE /api/menu/items`). Price/label/description inputs
 * commit `onChange` (blur), matching the prototype's own `onchange` (not
 * `oninput`) — only the auto-growing description textarea updates live.
 */
const SIZE_WORDS = ["Regular", "Large", "Half", "Full", "Small", "Glass", "Pitcher", "Single"];
function nextSizeLabel(used: string[]): string {
  return SIZE_WORDS.find((w) => !used.includes(w)) ?? `Size ${used.length + 1}`;
}

async function patchItem(itemId: string, body: unknown): Promise<{ ok: boolean; item?: CustomerItemDTO; error?: string }> {
  const res = await fetch(`/api/menu/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong" };
  return { ok: true, item: data.item };
}

export function MenuManager({ initialCategories, role }: { initialCategories: CustomerCategoryDTO[]; role: ProfileRole }) {
  const [categories, setCategories] = useState(initialCategories);
  const [filterM, setFilterM] = useState<"all" | "veg" | "nonveg">("all");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(initialCategories[0] ? [initialCategories[0].id] : []));
  const [toast, setToast] = useState<string | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [delCat, setDelCat] = useState<CustomerCategoryDTO | null>(null);
  const [addDishCat, setAddDishCat] = useState<CustomerCategoryDTO | null>(null);
  const [delDish, setDelDish] = useState<{ catId: string; item: CustomerItemDTO } | null>(null);

  const canEdit = can(role, "editMenu");
  const canToggle = can(role, "toggleAvailability");

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }
  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function replaceItem(catId: string, item: CustomerItemDTO) {
    setCategories((prev) => prev.map((c) => (c.id === catId ? { ...c, items: c.items.map((i) => (i.id === item.id ? item : i)) } : c)));
  }

  async function toggleAvailable(catId: string, item: CustomerItemDTO) {
    const result = await patchItem(item.id, { available: !item.available });
    if (!result.ok || !result.item) return flash(result.error ?? "Couldn't update");
    replaceItem(catId, result.item);
    flash(`${item.name} ${result.item.available ? "back on the menu" : "marked sold out"}`);
  }

  async function commitDescription(catId: string, item: CustomerItemDTO, value: string) {
    const description = value.trim() || null;
    const result = await patchItem(item.id, { description });
    if (!result.ok || !result.item) return flash(result.error ?? "Couldn't save");
    replaceItem(catId, result.item);
    flash(description ? `${item.name} description saved` : `${item.name} description cleared`);
  }

  async function commitVariants(catId: string, item: CustomerItemDTO, variants: CustomerVariantDTO[]) {
    const result = await patchItem(item.id, {
      variants: variants.map((v) => ({ id: v.id.startsWith("draft-") ? undefined : v.id, label: v.label, pricePaise: v.pricePaise })),
    });
    if (!result.ok || !result.item) {
      flash(result.error ?? "Couldn't save");
      return;
    }
    replaceItem(catId, result.item);
  }

  async function deleteCategory(cat: CustomerCategoryDTO) {
    const res = await fetch(`/api/menu/categories/${cat.id}`, { method: "DELETE" });
    if (!res.ok) return flash("Couldn't delete");
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    setDelCat(null);
    flash(`${cat.name} deleted`);
  }

  async function deleteDish(catId: string, item: CustomerItemDTO) {
    const res = await fetch(`/api/menu/items/${item.id}`, { method: "DELETE" });
    if (!res.ok) return flash("Couldn't delete");
    setCategories((prev) => prev.map((c) => (c.id === catId ? { ...c, items: c.items.filter((i) => i.id !== item.id) } : c)));
    setDelDish(null);
    flash(`${item.name} removed`);
  }

  const shown = categories.filter((c) => filterM === "all" || (filterM === "veg" ? c.isVeg : !c.isVeg));
  const vegShown = shown.filter((c) => c.isVeg);
  const nonvegShown = shown.filter((c) => !c.isVeg);

  return (
    <section>
      <h2 className="title">Menu</h2>
      <p className="sub-t">Categories hold dishes · toggle a dish off and it disappears from every QR menu instantly</p>
      <div className="bar">
        <button className="chip" aria-pressed={filterM === "all"} onClick={() => setFilterM("all")}>
          Both kitchens
        </button>
        <button className="chip" aria-pressed={filterM === "veg"} onClick={() => setFilterM("veg")}>
          <i className="dot" />
          Veg kitchen
        </button>
        <button className="chip" aria-pressed={filterM === "nonveg"} onClick={() => setFilterM("nonveg")}>
          <i className="dot nv" />
          Non-veg kitchen
        </button>
        {canEdit && (
          <>
            <div className="spacer" />
            <button className="chip add-c" onClick={() => setAddCatOpen(true)}>
              + Add category
            </button>
          </>
        )}
      </div>

      {!categories.length ? (
        <div className="no-dish" style={{ textAlign: "center", padding: 40 }}>
          No categories yet. Add one to start building the menu.
        </div>
      ) : !shown.length ? (
        <div className="no-dish" style={{ textAlign: "center", padding: 40 }}>
          Nothing matches this filter.
        </div>
      ) : (
        <>
          {vegShown.length > 0 && (
            <>
              <div className="kitchen-head">
                <i className="dot" />
                Veg kitchen
                <span>
                  {vegShown.length} categor{vegShown.length === 1 ? "y" : "ies"}
                </span>
              </div>
              {vegShown.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  cat={cat}
                  open={openGroups.has(cat.id)}
                  canEdit={canEdit}
                  canToggle={canToggle}
                  onToggleGroup={() => toggleGroup(cat.id)}
                  onDeleteCategory={() => setDelCat(cat)}
                  onAddDish={() => setAddDishCat(cat)}
                  onToggleAvailable={(item) => toggleAvailable(cat.id, item)}
                  onCommitDescription={(item, v) => commitDescription(cat.id, item, v)}
                  onCommitVariants={(item, v) => commitVariants(cat.id, item, v)}
                  onDeleteDish={(item) => setDelDish({ catId: cat.id, item })}
                />
              ))}
            </>
          )}
          {nonvegShown.length > 0 && (
            <>
              <div className="kitchen-head">
                <i className="dot nv" />
                Non-veg kitchen
                <span>
                  {nonvegShown.length} categor{nonvegShown.length === 1 ? "y" : "ies"}
                </span>
              </div>
              {nonvegShown.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  cat={cat}
                  open={openGroups.has(cat.id)}
                  canEdit={canEdit}
                  canToggle={canToggle}
                  onToggleGroup={() => toggleGroup(cat.id)}
                  onDeleteCategory={() => setDelCat(cat)}
                  onAddDish={() => setAddDishCat(cat)}
                  onToggleAvailable={(item) => toggleAvailable(cat.id, item)}
                  onCommitDescription={(item, v) => commitDescription(cat.id, item, v)}
                  onCommitVariants={(item, v) => commitVariants(cat.id, item, v)}
                  onDeleteDish={(item) => setDelDish({ catId: cat.id, item })}
                />
              ))}
            </>
          )}
        </>
      )}

      <Modal open={addCatOpen} onClose={() => setAddCatOpen(false)}>
        <AddCategoryForm
          existingNames={categories.map((c) => c.name)}
          onClose={() => setAddCatOpen(false)}
          onCreated={(cat) => {
            setCategories((prev) => [...prev, cat]);
            setOpenGroups((prev) => new Set(prev).add(cat.id));
            setAddCatOpen(false);
            flash(`${cat.name} added to the ${cat.isVeg ? "veg" : "non-veg"} kitchen`);
            setAddDishCat(cat);
          }}
        />
      </Modal>

      <Modal open={!!delCat} onClose={() => setDelCat(null)}>
        {delCat && (
          <>
            <h3>Delete {delCat.name}?</h3>
            <p className="hint">
              {delCat.items.length
                ? `${delCat.items.length} dish${delCat.items.length === 1 ? "" : "es"} inside will be removed from the menu too.`
                : "This category is empty."}
            </p>
            <div className="mact">
              <button className="cancel" onClick={() => setDelCat(null)}>
                Keep it
              </button>
              <button className="save" style={{ background: "var(--nonveg)", color: "#fff" }} onClick={() => deleteCategory(delCat)}>
                Delete
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!addDishCat} onClose={() => setAddDishCat(null)}>
        {addDishCat && (
          <AddDishForm
            cat={addDishCat}
            onClose={() => setAddDishCat(null)}
            onCreated={(item) => {
              setCategories((prev) => prev.map((c) => (c.id === addDishCat.id ? { ...c, items: [...c.items, item] } : c)));
              setOpenGroups((prev) => new Set(prev).add(addDishCat.id));
              setAddDishCat(null);
              flash(`${item.name} added${item.variants.length > 1 ? ` with ${item.variants.length} prices` : ""}`);
            }}
          />
        )}
      </Modal>

      <Modal open={!!delDish} onClose={() => setDelDish(null)}>
        {delDish && (
          <>
            <h3>Delete {delDish.item.name}?</h3>
            <p className="hint">This removes it from the customer menu immediately.</p>
            <div className="mact">
              <button className="cancel" onClick={() => setDelDish(null)}>
                Keep it
              </button>
              <button className="save" style={{ background: "var(--nonveg)", color: "#fff" }} onClick={() => deleteDish(delDish.catId, delDish.item)}>
                Delete
              </button>
            </div>
          </>
        )}
      </Modal>

      <div className={`toast${toast ? " show" : ""}`}>{toast ?? ""}</div>
    </section>
  );
}

function CategoryCard({
  cat,
  open,
  canEdit,
  canToggle,
  onToggleGroup,
  onDeleteCategory,
  onAddDish,
  onToggleAvailable,
  onCommitDescription,
  onCommitVariants,
  onDeleteDish,
}: {
  cat: CustomerCategoryDTO;
  open: boolean;
  canEdit: boolean;
  canToggle: boolean;
  onToggleGroup: () => void;
  onDeleteCategory: () => void;
  onAddDish: () => void;
  onToggleAvailable: (item: CustomerItemDTO) => void;
  onCommitDescription: (item: CustomerItemDTO, value: string) => void;
  onCommitVariants: (item: CustomerItemDTO, variants: CustomerVariantDTO[]) => void;
  onDeleteDish: (item: CustomerItemDTO) => void;
}) {
  const live = cat.items.filter((i) => i.available).length;
  return (
    <section className={`grp${open ? " open" : ""}`}>
      <div
        className="grp-h"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-delcat]")) return;
          onToggleGroup();
        }}
      >
        <span className="caret">▶</span>
        <i className={`dot${cat.isVeg ? "" : " nv"}`} />
        <h3>{cat.name}</h3>
        <span className="meta">
          {cat.items.length} dish{cat.items.length === 1 ? "" : "es"} · {live} live
        </span>
        {canEdit && (
          <button className="del" data-delcat title="Delete category" onClick={onDeleteCategory}>
            ×
          </button>
        )}
      </div>
      <div className="grp-body">
        {cat.items.length ? (
          <table className="tblx">
            <thead>
              <tr>
                <th>Dish</th>
                <th>Price</th>
                <th style={{ textAlign: "right" }}>Available</th>
              </tr>
            </thead>
            <tbody>
              {cat.items.map((item) => (
                <DishRow
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  canToggle={canToggle}
                  onToggleAvailable={() => onToggleAvailable(item)}
                  onCommitDescription={(v) => onCommitDescription(item, v)}
                  onCommitVariants={(v) => onCommitVariants(item, v)}
                  onDelete={() => onDeleteDish(item)}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-dish">No dishes in this category yet.</div>
        )}
        {canEdit && (
          <div className="grp-foot">
            <button className="chip add-d" onClick={onAddDish}>
              + Add {cat.isVeg ? "veg" : "non-veg"} dish to {cat.name}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function DishRow({
  item,
  canEdit,
  canToggle,
  onToggleAvailable,
  onCommitDescription,
  onCommitVariants,
  onDelete,
}: {
  item: CustomerItemDTO;
  canEdit: boolean;
  canToggle: boolean;
  onToggleAvailable: () => void;
  onCommitDescription: (value: string) => void;
  onCommitVariants: (variants: CustomerVariantDTO[]) => void;
  onDelete: () => void;
}) {
  const multi = item.variants.length > 1;

  function updateVariant(idx: number, patch: Partial<CustomerVariantDTO>) {
    const next = item.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    onCommitVariants(next);
  }
  function addVariant() {
    const last = item.variants[item.variants.length - 1];
    const used = item.variants.map((v) => v.label);
    const next = [...item.variants];
    if (next.length === 1 && !SIZE_WORDS.includes(last.label)) next[0] = { ...next[0], label: "Regular" };
    next.push({ id: `draft-${Date.now()}`, label: nextSizeLabel(used), pricePaise: Math.round((last.pricePaise * 1.25) / 5) * 5 });
    onCommitVariants(next);
  }
  function removeVariant(idx: number) {
    if (item.variants.length < 2) return;
    onCommitVariants(item.variants.filter((_, i) => i !== idx));
  }

  return (
    <tr className={item.available ? "" : "off"}>
      <td>
        <div className="dish-n">
          <i className={`dot${item.isVeg ? "" : " nv"}`} />
          {item.name}
          {multi && <span className="vcount">{item.variants.length} sizes</span>}
        </div>
        <textarea
          className="desc-in"
          rows={1}
          defaultValue={item.description ?? ""}
          placeholder="Add a description…"
          disabled={!canEdit}
          onChange={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={(e) => onCommitDescription(e.target.value)}
        />
      </td>
      <td>
        <div className="vlist">
          {item.variants.map((v, k) => (
            <div className="vrow" key={v.id}>
              <input
                className="size-in"
                defaultValue={v.label}
                placeholder="Size"
                disabled={!multi || !canEdit}
                onBlur={(e) => updateVariant(k, { label: e.target.value.trim() || "Regular" })}
              />
              <input
                className="price-in"
                type="number"
                defaultValue={Math.round(v.pricePaise / 100)}
                disabled={!canEdit}
                onBlur={(e) => updateVariant(k, { pricePaise: Math.max(0, Math.round(Number(e.target.value) || 0) * 100) })}
              />
              {multi && canEdit && (
                <button className="del" title="Remove this size" onClick={() => removeVariant(k)}>
                  ×
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <button className="addv" onClick={addVariant}>
              + add another price
            </button>
          )}
        </div>
      </td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>
        {!item.available && <span className="sold">86&rsquo;d</span>}{" "}
        {canToggle && <button className="tog" aria-pressed={item.available} aria-label="Toggle availability" onClick={onToggleAvailable} />}
        {canEdit && (
          <button className="del" title="Delete dish" onClick={onDelete}>
            ×
          </button>
        )}
      </td>
    </tr>
  );
}

function AddCategoryForm({
  existingNames,
  onClose,
  onCreated,
}: {
  existingNames: string[];
  onClose: () => void;
  onCreated: (cat: CustomerCategoryDTO) => void;
}) {
  const [name, setName] = useState("");
  const [isVeg, setIsVeg] = useState(true);
  const [busy, setBusy] = useState(false);
  const dupe = !!name.trim() && existingNames.some((n) => n.toLowerCase() === name.trim().toLowerCase());

  async function save() {
    setBusy(true);
    const res = await fetch("/api/menu/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), isVeg }),
    });
    setBusy(false);
    if (!res.ok) return;
    const { category } = await res.json();
    onCreated({ id: category.id, name: category.name, isVeg: category.isVeg, art: "leaf", items: [] });
  }

  return (
    <>
      <h3>New category</h3>
      <p className="hint">A category belongs to one kitchen — every dish inside inherits it</p>
      <label className="fld">
        <em>Category name</em>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Breakfast, Bella Bowls, Seafood" autoComplete="off" />
      </label>
      <label className="fld">
        <em>Kitchen</em>
        <div className="pick">
          <button aria-pressed={isVeg} onClick={() => setIsVeg(true)}>
            <i className="dot" />
            Veg
          </button>
          <button aria-pressed={!isVeg} onClick={() => setIsVeg(false)}>
            <i className="dot nv" />
            Non-veg
          </button>
        </div>
      </label>
      <div className={`err${dupe ? " show" : ""}`}>That category already exists.</div>
      <div className="mact">
        <button className="cancel" onClick={onClose}>
          Cancel
        </button>
        <button className="save" disabled={!name.trim() || dupe || busy} onClick={save}>
          Add category
        </button>
      </div>
    </>
  );
}

function AddDishForm({ cat, onClose, onCreated }: { cat: CustomerCategoryDTO; onClose: () => void; onCreated: (item: CustomerItemDTO) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [rows, setRows] = useState<{ label: string; price: string }[]>([{ label: "Regular", price: "" }]);
  const [busy, setBusy] = useState(false);

  const ok = name.trim() && rows.every((r) => Number(r.price) > 0 && r.label.trim()) && new Set(rows.map((r) => r.label.trim().toLowerCase())).size === rows.length;

  async function save() {
    setBusy(true);
    const res = await fetch("/api/menu/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: cat.id,
        name: name.trim(),
        description: desc.trim() || null,
        variants: rows.map((r) => ({ label: r.label.trim(), pricePaise: Math.round(Number(r.price) * 100) })),
      }),
    });
    setBusy(false);
    if (!res.ok) return;
    const { item } = await res.json();
    onCreated({
      id: item.id,
      name: item.name,
      description: item.description,
      isVeg: item.isVeg,
      available: item.available,
      variants: item.variants.map((v: CustomerVariantDTO) => ({ id: v.id, label: v.label, pricePaise: v.pricePaise })),
    });
  }

  return (
    <>
      <h3>New dish</h3>
      <p className="hint">
        Adding to <b style={{ color: "var(--accent)" }}>{cat.name}</b>
        <br />
        <i className={`dot${cat.isVeg ? "" : " nv"}`} /> {cat.isVeg ? "Veg" : "Non-veg"} kitchen — set by the category
      </p>
      <label className="fld">
        <em>Dish name</em>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paneer Tikka Pizza" autoComplete="off" />
      </label>
      <label className="fld">
        <em>Description</em>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's in it — shown under the name" />
      </label>
      <label className="fld">
        <em>Pricing</em>
        <div className="vlist">
          {rows.map((r, k) => (
            <div className="vrow" key={k}>
              <input
                className="size-in"
                value={r.label}
                placeholder="Size"
                disabled={rows.length < 2}
                onChange={(e) => setRows((prev) => prev.map((row, i) => (i === k ? { ...row, label: e.target.value } : row)))}
              />
              <input
                className="price-in"
                type="number"
                value={r.price}
                placeholder="395"
                onChange={(e) => setRows((prev) => prev.map((row, i) => (i === k ? { ...row, price: e.target.value } : row)))}
              />
              {rows.length > 1 && (
                <button className="del" onClick={() => setRows((prev) => prev.filter((_, i) => i !== k))}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          className="addv"
          style={{ marginTop: 6 }}
          onClick={() => {
            const used = rows.map((r) => r.label);
            setRows((prev) => [...prev, { label: nextSizeLabel(used), price: "" }]);
          }}
        >
          + add another price
        </button>
        <div className="hint" style={{ textAlign: "left", margin: "8px 0 0" }}>
          Two or more prices show up as size buttons on the customer menu.
        </div>
      </label>
      <div className="mact">
        <button className="cancel" onClick={onClose}>
          Cancel
        </button>
        <button className="save" disabled={!ok || busy} onClick={save}>
          Add dish
        </button>
      </div>
    </>
  );
}
