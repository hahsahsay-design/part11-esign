"use client";

import { useRef, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload } from "lucide-react";

export function UploadDocumentDialog({ folders }: { folders: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState("none");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const files = Array.from(fileInputRef.current?.files ?? []);
    if (files.length === 0) {
      setError("Choose at least one PDF file to upload.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
        const formData = new FormData();
        formData.append("file", file);
        // A custom title only makes sense for a single file; batch uploads keep each file's own name.
        formData.append("title", files.length === 1 ? title : "");
        if (folderId !== "none") formData.append("folderId", folderId);
        const res = await fetch("/api/documents", { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json();
          setError(`${file.name}: ${data.error ?? "Upload failed."}`);
          return;
        }
      }
      setOpen(false);
      setTitle("");
      setFolderId("none");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Upload className="mr-2 h-4 w-4" />
        Upload document
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Upload PDF documents</DialogTitle>
            <DialogDescription>
              Select one or more PDFs. The original file is preserved as version 1 and hashed with SHA-256 for
              integrity verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="file">PDF file(s)</Label>
              <Input id="file" type="file" accept="application/pdf" multiple ref={fileInputRef} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Document title (single-file uploads only)</Label>
              <Input
                id="title"
                placeholder="Defaults to the file name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Folder</Label>
              <Select value={folderId} onValueChange={(v) => setFolderId(v ?? "none")}>
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
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? progress ?? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
