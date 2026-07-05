"use client";

import { useEffect, useRef, useState } from "react";
import type { MenuCategoryDTO, MenuItemDTO } from "@/lib/menu";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/**
 * Owner menu management (M6, DESIGN_SYSTEM 2): accordion per category,
 * "Add Category" on top, "Add dish" per category, sold-out switch right on
 * the list row (zero taps deep). Photo upload waits for Supabase Storage —
 * a photo-link field stands in for it.
 */

type DishDraft = {
  id?: string; // present = editing
  categoryId: string;
  name: string;
  price: string;
  description: string;
  isVeg: boolean;
  photoUrl: string;
};

export function MenuManager({ initialCategories }: { initialCategories: MenuCategoryDTO[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(initialCategories.length === 1 ? [initialCategories[0].id] : []),
  );
  const [dishDraft, setDishDraft] = useState<DishDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<{ id?: string; name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ── Sold-out switch: optimistic, revert on failure ──────────────── */
  const setAvailability = async (item: MenuItemDTO, isAvailable: boolean) => {
    const apply = (value: boolean) =>
      setCategories((cats) =>
        cats.map((c) => ({
          ...c,
          items: c.items.map((i) => (i.id === item.id ? { ...i, isAvailable: value } : i)),
        })),
      );
    apply(isAvailable);
    try {
      const res = await fetch(`/api/owner/menu-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable }),
      });
      if (!res.ok) throw new Error();
    } catch {
      apply(!isAvailable);
      showNotice("Could not update. Check your connection and try again.");
    }
  };

  /* ── Save dish (add or edit) ─────────────────────────────────────── */
  const saveDish = async (draft: DishDraft): Promise<string | null> => {
    const payload = {
      categoryId: draft.categoryId,
      name: draft.name,
      price: draft.price,
      description: draft.description,
      isVeg: draft.isVeg,
      photoUrl: draft.photoUrl,
    };
    const res = await fetch(draft.id ? `/api/owner/menu-items/${draft.id}` : "/api/owner/menu-items", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!res) return "Network problem. Try again.";
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Could not save. Try again.";

    const item: MenuItemDTO = data.item;
    setCategories((cats) =>
      cats.map((c) => {
        if (c.id !== draft.categoryId) return c;
        const exists = c.items.some((i) => i.id === item.id);
        return { ...c, items: exists ? c.items.map((i) => (i.id === item.id ? item : i)) : [...c.items, item] };
      }),
    );
    showNotice(draft.id ? "Dish saved." : "Dish added.");
    return null;
  };

  /* ── Save category (add or rename) ───────────────────────────────── */
  const saveCategory = async (draft: { id?: string; name: string }): Promise<string | null> => {
    const res = await fetch(draft.id ? `/api/owner/categories/${draft.id}` : "/api/owner/categories", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.name }),
    }).catch(() => null);
    if (!res) return "Network problem. Try again.";
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Could not save. Try again.";

    if (draft.id) {
      setCategories((cats) => cats.map((c) => (c.id === draft.id ? { ...c, name: draft.name.trim() } : c)));
      showNotice("Category renamed.");
    } else {
      setCategories((cats) => [...cats, data.category]);
      setOpen((prev) => new Set(prev).add(data.category.id));
      showNotice("Category added.");
    }
    return null;
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Menu</h1>
          <p className="mt-1 text-sm text-slate-500">Changes show to customers right away.</p>
        </div>
        <button
          type="button"
          onClick={() => setCategoryDraft({ name: "" })}
          className="cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
        >
          Add Category
        </button>
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {notice}
        </p>
      )}

      {categories.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-base font-medium text-slate-700">Your menu is empty</p>
          <p className="mt-1 text-sm text-slate-500">Add a category first — like Snacks or Beverages.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {categories.map((cat) => (
            <li key={cat.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => toggleOpen(cat.id)}
                  aria-expanded={open.has(cat.id)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-4 text-left transition-colors duration-150 hover:bg-slate-50"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open.has(cat.id) ? "rotate-90" : ""}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span className="truncate text-base font-semibold text-slate-900">{cat.name}</span>
                  <span className="shrink-0 text-xs font-medium text-slate-400">
                    {cat.items.length} {cat.items.length === 1 ? "dish" : "dishes"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryDraft({ id: cat.id, name: cat.name })}
                  aria-label={`Rename ${cat.name}`}
                  className="cursor-pointer p-3 text-slate-400 transition-colors duration-150 hover:text-slate-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                    />
                  </svg>
                </button>
              </div>

              {open.has(cat.id) && (
                <div className="border-t border-slate-100">
                  {cat.items.length === 0 && (
                    <p className="px-4 py-4 text-sm text-slate-500">No dishes here yet.</p>
                  )}
                  <ul className="divide-y divide-slate-100">
                    {cat.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <VegMark isVeg={item.isVeg} />
                        <button
                          type="button"
                          onClick={() =>
                            setDishDraft({
                              id: item.id,
                              categoryId: cat.id,
                              name: item.name,
                              price: String(item.price),
                              description: item.description ?? "",
                              isVeg: item.isVeg,
                              photoUrl: item.photoUrl ?? "",
                            })
                          }
                          className="min-w-0 flex-1 cursor-pointer text-left"
                        >
                          <p className={`truncate font-medium ${item.isAvailable ? "text-slate-900" : "text-slate-400"}`}>
                            {item.name}
                          </p>
                          <p className="text-sm text-slate-500 tabular-nums">
                            ₹{inr.format(item.price)}
                            {!item.isAvailable && <span className="ml-2 font-semibold text-error">Sold Out</span>}
                          </p>
                        </button>
                        <AvailabilitySwitch item={item} onChange={(v) => setAvailability(item, v)} />
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-slate-100 px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDishDraft({ categoryId: cat.id, name: "", price: "", description: "", isVeg: true, photoUrl: "" })
                      }
                      className="cursor-pointer text-sm font-semibold text-primary transition-opacity duration-150 hover:opacity-80"
                    >
                      + Add dish
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {dishDraft && <DishModal draft={dishDraft} onSave={saveDish} onClose={() => setDishDraft(null)} />}
      {categoryDraft && (
        <CategoryModal draft={categoryDraft} onSave={saveCategory} onClose={() => setCategoryDraft(null)} />
      )}
    </div>
  );
}

/* ── FSSAI-style veg mark (same visual as the customer menu) ───────── */
function VegMark({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? "border-success" : "border-error";
  const dot = isVeg ? "bg-success" : "bg-error";
  return (
    <span
      role="img"
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${color}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
    </span>
  );
}

/* ── Big sold-out switch, right on the row (zero taps deep) ────────── */
function AvailabilitySwitch({ item, onChange }: { item: MenuItemDTO; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={item.isAvailable}
      aria-label={`${item.name}: ${item.isAvailable ? "available — switch off to mark sold out" : "sold out — switch on when back"}`}
      onClick={() => onChange(!item.isAvailable)}
      className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        item.isAvailable ? "bg-success" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
          item.isAvailable ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

/* ── Shared modal chrome: bottom sheet on mobile, card on desktop ──── */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-pointer bg-slate-900/40" />
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-2xl motion-safe:animate-[slideUp_200ms_ease-out]">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20";

function DishModal({
  draft,
  onSave,
  onClose,
}: {
  draft: DishDraft;
  onSave: (d: DishDraft) => Promise<string | null>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const err = await onSave(form);
    setSaving(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <ModalShell title={form.id ? "Edit dish" : "Add dish"} onClose={onClose}>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Dish name
          <input
            type="text"
            required
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={FIELD}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Price (₹)
          <input
            type="text"
            required
            inputMode="decimal"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className={FIELD}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Description <span className="font-normal text-slate-400">(optional)</span>
          <textarea
            rows={2}
            maxLength={300}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={FIELD}
          />
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Type</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {([true, false] as const).map((veg) => (
              <button
                key={String(veg)}
                type="button"
                onClick={() => setForm({ ...form, isVeg: veg })}
                aria-pressed={form.isVeg === veg}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  form.isVeg === veg
                    ? veg
                      ? "border-success bg-emerald-50 text-emerald-800"
                      : "border-error bg-red-50 text-red-800"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <VegMark isVeg={veg} />
                {veg ? "Veg" : "Non-veg"}
              </button>
            ))}
          </div>
        </fieldset>
        <PhotoField
          photoUrl={form.photoUrl}
          onChange={(url) => setForm({ ...form, photoUrl: url })}
          onError={setError}
        />

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 cursor-pointer rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-50"
          >
            {saving ? "Saving…" : form.id ? "Save changes" : "Add dish"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/** Dish photo: upload to /api/owner/photos, keep the returned URL in the form. */
function PhotoField({
  photoUrl,
  onChange,
  onError,
}: {
  photoUrl: string;
  onChange: (url: string) => void;
  onError: (msg: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    onError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/owner/photos", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error ?? "Could not upload the photo. Try again.");
        return;
      }
      onChange(data.url);
    } catch {
      onError("Network problem. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <span className="block text-sm font-medium text-slate-700">
        Photo <span className="font-normal text-slate-400">(optional, JPG/PNG/WebP up to 2 MB)</span>
      </span>
      <div className="mt-1.5 flex items-center gap-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- small preview of an uploaded file
          <img src={photoUrl} alt="Dish photo preview" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Zm10.5-11.25h.008v.008h-.008V9.75Z"
              />
            </svg>
          </span>
        )}
        <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50">
          {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {photoUrl && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="cursor-pointer text-sm font-medium text-slate-500 transition-colors duration-150 hover:text-error"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function CategoryModal({
  draft,
  onSave,
  onClose,
}: {
  draft: { id?: string; name: string };
  onSave: (d: { id?: string; name: string }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const err = await onSave({ id: draft.id, name });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <ModalShell title={draft.id ? "Rename category" : "Add category"} onClose={onClose}>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Category name
          <input
            type="text"
            required
            maxLength={80}
            autoFocus
            placeholder="Snacks, Beverages…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 cursor-pointer rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-50"
          >
            {saving ? "Saving…" : draft.id ? "Save name" : "Add category"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
