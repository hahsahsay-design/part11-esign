"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface TrainingRecord {
  id: string;
  courseName: string;
  completedAt: string | null;
  expiresAt: string | null;
  score: number | null;
  userName: string;
}

export function TrainingPanel({
  records,
  members,
  canManage,
}: {
  records: TrainingRecord[];
  members: { userId: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState(members[0]?.userId ?? "");
  const [courseName, setCourseName] = useState("");
  const [completedAt, setCompletedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/admin/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          courseName,
          completedAt: completedAt ? new Date(completedAt).toISOString() : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      setOpen(false);
      setCourseName("");
      setCompletedAt("");
      setExpiresAt("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/training/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" />}>
            <Plus className="mr-2 h-4 w-4" />
            Record training
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={onSubmit}>
              <DialogHeader>
                <DialogTitle>Record a training completion</DialogTitle>
                <DialogDescription>Keeps evidence of personnel qualification (21 CFR 11.10(i)).</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Team member</Label>
                  <Select value={userId} onValueChange={(v) => v && setUserId(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v: string) => members.find((m) => m.userId === v)?.name ?? "Choose"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courseName">Course / SOP name</Label>
                  <Input id="courseName" required value={courseName} onChange={(e) => setCourseName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="completedAt">Completed</Label>
                    <Input id="completedAt" type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiresAt">Expires</Label>
                    <Input id="expiresAt" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy || !courseName.trim() || !userId}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">No training records yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Expires</TableHead>
              {canManage && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.userName}</TableCell>
                <TableCell>{r.courseName}</TableCell>
                <TableCell>{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell>{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}</TableCell>
                {canManage && (
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(r.id)}>
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
