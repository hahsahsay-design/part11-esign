"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

export function DepartmentsPanel({
  departments,
  canManage,
}: {
  departments: { id: string; name: string; memberCount: number }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addDepartment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create this department.");
        return;
      }
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeDepartment(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/departments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not delete this department.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {departments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No departments yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {departments.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted">
              <span>
                {d.name} <span className="text-xs text-muted-foreground">({d.memberCount})</span>
              </span>
              {canManage && (
                <Button variant="ghost" size="icon-sm" disabled={busy} onClick={() => removeDepartment(d.id)}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form onSubmit={addDepartment} className="flex gap-2">
          <Input placeholder="New department" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="outline" size="icon" disabled={busy || !name.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
