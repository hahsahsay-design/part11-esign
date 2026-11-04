"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FolderPlus, Search } from "lucide-react";

const STATUSES = ["ALL", "DRAFT", "OUT_FOR_SIGNATURE", "COMPLETED", "DECLINED", "VOIDED", "EXPIRED", "ARCHIVED"];

export function DocumentToolbar({ folders }: { folders: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [newFolderName, setNewFolderName] = useState("");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL" && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/documents/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName }),
      });
      if (res.ok) {
        setNewFolderName("");
        setFolderDialogOpen(false);
        router.refresh();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents…"
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParam("q", query);
          }}
          onBlur={() => updateParam("q", query)}
        />
      </div>

      <Select defaultValue={searchParams.get("status") ?? "ALL"} onValueChange={(v) => updateParam("status", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Status">
            {(v: string) => (v === "ALL" ? "All statuses" : v.replaceAll("_", " "))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s === "ALL" ? "All statuses" : s.replaceAll("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("folderId") ?? "ALL"}
        onValueChange={(v) => updateParam("folderId", v === "ALL" ? null : v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Folder">
            {(v: string) => (v === "ALL" ? "All folders" : v === "none" ? "Unfiled" : folders.find((f) => f.id === v)?.name ?? "Folder")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All folders</SelectItem>
          <SelectItem value="none">Unfiled</SelectItem>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogTrigger render={<Button variant="outline" />}>
          <FolderPlus className="mr-2 h-4 w-4" />
          New folder
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={createFolder}>
            <DialogHeader>
              <DialogTitle>New folder</DialogTitle>
              <DialogDescription>Organize documents by study, department, or document type.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="folderName">Folder name</Label>
              <Input id="folderName" required value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create folder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
