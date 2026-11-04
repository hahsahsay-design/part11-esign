"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";

interface Policy {
  id: string;
  name: string;
  documentCategory: string | null;
  retentionPeriodDays: number;
  actionOnExpiry: string;
}

export function RetentionPanel({ policies, canManage }: { policies: Policy[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [days, setDays] = useState("2555");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/admin/retention-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, documentCategory: category || null, retentionPeriodDays: Number(days) }),
      });
      setOpen(false);
      setName("");
      setCategory("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/retention-policies/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" />}>
            <Plus className="mr-2 h-4 w-4" />
            New retention policy
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={onSubmit}>
              <DialogHeader>
                <DialogTitle>New retention policy</DialogTitle>
                <DialogDescription>
                  Documentation only in this phase — automated enforcement (auto-archive on expiry) is tracked
                  as follow-up work; see the README.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="policyName">Policy name</Label>
                  <Input id="policyName" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Document category (optional)</Label>
                  <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Batch Records" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days">Retention period (days)</Label>
                  <Input id="days" type="number" min={1} required value={days} onChange={(e) => setDays(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy || !name.trim()}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {policies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No retention policies defined yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Retention</TableHead>
              <TableHead>On expiry</TableHead>
              {canManage && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.documentCategory ?? "All documents"}</TableCell>
                <TableCell>{Math.round(p.retentionPeriodDays / 365)} years</TableCell>
                <TableCell>{p.actionOnExpiry.replaceAll("_", " ")}</TableCell>
                {canManage && (
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(p.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
