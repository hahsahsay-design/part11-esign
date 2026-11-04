"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Download, Pencil, FolderInput, Archive, ArchiveRestore, History, Scale, ShieldOff } from "lucide-react";

interface DocVersion {
  id: string;
  versionNumber: number;
  kind: string;
  sha256Hash: string;
  createdAt: string;
  originalFileName: string;
}

export function DocumentRowActions({
  documentId,
  title,
  status,
  folders,
  currentFolderId,
  hasLegalHold,
  canManageRetention,
}: {
  documentId: string;
  title: string;
  status: string;
  folders: { id: string; name: string }[];
  currentFolderId: string | null;
  hasLegalHold: boolean;
  canManageRetention: boolean;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [targetFolder, setTargetFolder] = useState(currentFolderId ?? "none");
  const [holdReason, setHoldReason] = useState("");
  const [versions, setVersions] = useState<DocVersion[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function loadHistory() {
    setHistoryOpen(true);
    const res = await fetch(`/api/documents/${documentId}`);
    const data = await res.json();
    setVersions(data.document?.versions ?? []);
  }

  async function releaseLegalHold() {
    setBusy(true);
    try {
      await fetch(`/api/documents/${documentId}/legal-hold/release`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<a href={`/api/documents/${documentId}/download`} />}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMoveOpen(true)}>
            <FolderInput className="mr-2 h-4 w-4" />
            Move to folder
          </DropdownMenuItem>
          <DropdownMenuItem onClick={loadHistory}>
            <History className="mr-2 h-4 w-4" />
            Version history
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {status === "ARCHIVED" ? (
            <DropdownMenuItem onClick={() => patch({ archived: false })} disabled={busy}>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Unarchive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => patch({ archived: true })} disabled={busy || hasLegalHold}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          )}
          {canManageRetention && (
            <>
              <DropdownMenuSeparator />
              {hasLegalHold ? (
                <DropdownMenuItem onClick={releaseLegalHold} disabled={busy}>
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Release legal hold
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setHoldOpen(true)}>
                  <Scale className="mr-2 h-4 w-4" />
                  Place legal hold
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await patch({ title: newTitle });
              setRenameOpen(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>Rename document</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="newTitle">Title</Label>
              <Input id="newTitle" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Folder</Label>
            <Select value={targetFolder} onValueChange={(v) => setTargetFolder(v ?? "none")}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => (v === "none" ? "Unfiled" : folders.find((f) => f.id === v)?.name ?? "Unfiled")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unfiled</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                await patch({ folderId: targetFolder === "none" ? null : targetFolder });
                setMoveOpen(false);
              }}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const res = await fetch(`/api/documents/${documentId}/legal-hold`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reason: holdReason }),
                });
                if (res.ok) {
                  setHoldOpen(false);
                  setHoldReason("");
                  router.refresh();
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Place a legal hold</DialogTitle>
              <DialogDescription>
                Prevents archiving while the hold is active. Document retention/disposal rules are suspended
                until the hold is released.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="holdReason">Reason</Label>
              <Textarea id="holdReason" required value={holdReason} onChange={(e) => setHoldReason(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || !holdReason.trim()}>
                Place hold
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Version history — {title}</DialogTitle>
            <DialogDescription>
              Every version is immutable once created. The original upload is never overwritten.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-3 overflow-y-auto py-2">
            {versions === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {versions?.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">
                    v{v.versionNumber}{" "}
                    <Badge variant={v.kind === "SIGNED_RECORD" ? "default" : "secondary"} className="ml-1">
                      {v.kind.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{v.originalFileName}</div>
                  <div className="font-mono text-xs text-muted-foreground">{v.sha256Hash.slice(0, 24)}…</div>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
