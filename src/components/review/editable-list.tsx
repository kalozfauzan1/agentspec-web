"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function ChipListEditor({
  label,
  items,
  onChange,
  placeholder,
  emptyLabel = "Belum ada",
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value || items.includes(value)) return;
    onChange([...items, value]);
    setDraft("");
  };

  return (
    <div>
      <p className="text-[13px] font-medium text-foreground-soft">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length === 0 && <span className="text-[13px] text-faint-foreground">{emptyLabel}</span>}
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-muted py-1 pl-3 pr-2 text-[12px] text-foreground-soft"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((candidate) => candidate !== item))}
              className="rounded-full p-0.5 text-faint-foreground transition-colors hover:bg-danger-soft hover:text-danger"
              aria-label={`Hapus ${item}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? "Tambah item…"}
          className="h-9"
        />
        <Button variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
          <Plus />
          Tambah
        </Button>
      </div>
    </div>
  );
}

export function ObjectListEditor({
  label,
  items,
  onChange,
  nameLabel = "Nama",
  descriptionLabel = "Deskripsi",
}: {
  label: string;
  items: { name: string; description: string }[];
  onChange: (items: { name: string; description: string }[]) => void;
  nameLabel?: string;
  descriptionLabel?: string;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "" });

  const startEdit = (index: number) => {
    setEditing(index);
    setDraft(items[index]);
  };

  const commit = () => {
    if (editing === null) return;
    const name = draft.name.trim();
    if (!name) return;
    const next = [...items];
    next[editing] = { name, description: draft.description.trim() };
    onChange(next);
    setEditing(null);
  };

  return (
    <div>
      <p className="text-[13px] font-medium text-foreground-soft">{label}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item, index) =>
          editing === index ? (
            <li key={`edit-${index}`} className="space-y-2 rounded-card border border-primary-border bg-primary-soft p-3">
              <Input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder={nameLabel}
                className="h-9 bg-surface"
              />
              <Input
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder={descriptionLabel}
                className="h-9 bg-surface"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={commit}>
                  Simpan
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                  Batal
                </Button>
              </div>
            </li>
          ) : (
            <li
              key={`${item.name}-${index}`}
              className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">{item.name}</p>
                {item.description && (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ubah"
                  onClick={() => startEdit(index)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Hapus"
                  onClick={() => onChange(items.filter((_, position) => position !== index))}
                >
                  <Trash2 className="text-danger" />
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => {
          setEditing(items.length);
          setDraft({ name: "", description: "" });
          onChange([...items, { name: "Fitur baru", description: "" }]);
        }}
      >
        <Plus />
        Tambah fitur
      </Button>
    </div>
  );
}
