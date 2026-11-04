"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PdfPages } from "@/components/workflow/pdf-pages";
import { PenTool, Type, Calendar, CheckSquare, Signature, X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FieldType = "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX";
type RecipientRole = "SIGNER" | "APPROVER" | "CC" | "WITNESS";

interface Recipient {
  tempId: string;
  email: string;
  fullName: string;
  recipientRole: RecipientRole;
  signingOrder: number;
}

interface FieldDraft {
  tempId: string;
  recipientTempId: string;
  type: FieldType;
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  required: boolean;
  label: string;
  meaningCode: string | null;
}

const FIELD_DEFAULTS: Record<FieldType, { widthPct: number; heightPct: number; label: string; icon: typeof PenTool }> = {
  SIGNATURE: { widthPct: 22, heightPct: 6, label: "Signature", icon: Signature },
  INITIALS: { widthPct: 9, heightPct: 5, label: "Initials", icon: PenTool },
  DATE: { widthPct: 14, heightPct: 4, label: "Date", icon: Calendar },
  TEXT: { widthPct: 20, heightPct: 4, label: "Text", icon: Type },
  CHECKBOX: { widthPct: 3.5, heightPct: 3.5, label: "Checkbox", icon: CheckSquare },
};

const RECIPIENT_COLORS = ["#1E2A5A", "#B45309", "#15803D", "#7E22CE", "#BE123C", "#0E7490"];

const ROLE_LABELS: Record<RecipientRole, string> = {
  SIGNER: "Signer",
  APPROVER: "Approver",
  WITNESS: "Witness",
  CC: "CC (no signature)",
};

function recipientColor(index: number) {
  return RECIPIENT_COLORS[index % RECIPIENT_COLORS.length];
}

export function WorkflowBuilder({
  documents,
  meanings,
}: {
  documents: { id: string; title: string; pageCount: number }[];
  meanings: { code: string; label: string }[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [documentId, setDocumentId] = useState(documents[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [signingMode, setSigningMode] = useState<"SEQUENTIAL" | "PARALLEL">("SEQUENTIAL");
  const [expiresAt, setExpiresAt] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([
    { tempId: crypto.randomUUID(), email: "", fullName: "", recipientRole: "SIGNER", signingOrder: 1 },
  ]);
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [activeRecipientTempId, setActiveRecipientTempId] = useState<string | null>(recipients[0]?.tempId ?? null);
  const [dragFieldType, setDragFieldType] = useState<FieldType | null>(null);
  const [draggingExistingId, setDraggingExistingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const selectedDocument = documents.find((d) => d.id === documentId);
  const actingRecipients = recipients.filter((r) => r.recipientRole !== "CC");

  function addRecipient() {
    const nextOrder = Math.max(0, ...recipients.map((r) => r.signingOrder)) + 1;
    const r: Recipient = { tempId: crypto.randomUUID(), email: "", fullName: "", recipientRole: "SIGNER", signingOrder: nextOrder };
    setRecipients((rs) => [...rs, r]);
    setActiveRecipientTempId(r.tempId);
  }

  function updateRecipient(tempId: string, patch: Partial<Recipient>) {
    setRecipients((rs) => rs.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)));
  }

  function removeRecipient(tempId: string) {
    setRecipients((rs) => rs.filter((r) => r.tempId !== tempId));
    setFields((fs) => fs.filter((f) => f.recipientTempId !== tempId));
    if (activeRecipientTempId === tempId) setActiveRecipientTempId(null);
  }

  function placeField(type: FieldType, page: number, xPct: number, yPct: number) {
    if (!activeRecipientTempId) {
      setError("Select a recipient on the left before placing a field.");
      return;
    }
    const defaults = FIELD_DEFAULTS[type];
    const field: FieldDraft = {
      tempId: crypto.randomUUID(),
      recipientTempId: activeRecipientTempId,
      type,
      page,
      xPct: Math.max(0, Math.min(100 - defaults.widthPct, xPct - defaults.widthPct / 2)),
      yPct: Math.max(0, Math.min(100 - defaults.heightPct, yPct - defaults.heightPct / 2)),
      widthPct: defaults.widthPct,
      heightPct: defaults.heightPct,
      required: true,
      label: defaults.label,
      meaningCode: type === "SIGNATURE" || type === "INITIALS" ? "SIGNED" : null,
    };
    setFields((fs) => [...fs, field]);
  }

  function moveField(tempId: string, page: number, xPct: number, yPct: number) {
    setFields((fs) =>
      fs.map((f) =>
        f.tempId === tempId
          ? { ...f, page, xPct: Math.max(0, Math.min(100 - f.widthPct, xPct - f.widthPct / 2)), yPct: Math.max(0, Math.min(100 - f.heightPct, yPct - f.heightPct / 2)) }
          : f,
      ),
    );
  }

  function removeField(tempId: string) {
    setFields((fs) => fs.filter((f) => f.tempId !== tempId));
  }

  function updateFieldMeaning(tempId: string, meaningCode: string) {
    setFields((fs) => fs.map((f) => (f.tempId === tempId ? { ...f, meaningCode } : f)));
  }

  function recipientIndex(tempId: string) {
    return recipients.findIndex((r) => r.tempId === tempId);
  }

  function onPageDrop(page: number, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    if (draggingExistingId) {
      moveField(draggingExistingId, page, xPct, yPct);
      setDraggingExistingId(null);
    } else if (dragFieldType) {
      placeField(dragFieldType, page, xPct, yPct);
      setDragFieldType(null);
    }
  }

  async function onSend() {
    setError(null);
    if (!title.trim()) {
      setError("Give this signature request a title.");
      setStep(1);
      return;
    }
    if (actingRecipients.some((r) => !r.email || !r.fullName)) {
      setError("Every recipient needs a name and email.");
      setStep(2);
      return;
    }
    if (fields.length === 0) {
      setError("Place at least one field on the document.");
      setStep(3);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/signature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          title,
          instructions: instructions || null,
          signingMode,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          recipients: recipients.map(({ tempId, email, fullName, recipientRole, signingOrder }) => ({
            tempId,
            email,
            fullName,
            recipientRole,
            signingOrder,
          })),
          fields: fields.map((f) => ({
            recipientTempId: f.recipientTempId,
            type: f.type,
            page: f.page,
            xPct: f.xPct,
            yPct: f.yPct,
            widthPct: f.widthPct,
            heightPct: f.heightPct,
            required: f.required,
            label: f.label,
            meaningCode: f.meaningCode,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send this signature request.");
        return;
      }
      router.push("/signatures");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const fileUrl = documentId ? `/api/documents/${documentId}/file` : null;

  const steps = [
    { n: 1, label: "Document" },
    { n: 2, label: "Recipients" },
    { n: 3, label: "Place fields" },
    { n: 4, label: "Review & send" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New signature request</h1>
        <p className="text-sm text-muted-foreground">Upload once in Documents, then build the signing workflow here.</p>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s.n)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                step === s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {s.n}
            </button>
            <span className={cn("text-sm", step === s.n ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
            {i < steps.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose a document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No draft documents available. Upload a PDF under Documents first.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Document</Label>
                <Select value={documentId} onValueChange={(v) => v && setDocumentId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => documents.find((d) => d.id === v)?.title ?? "Choose a document"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {documents.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="title">Request title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. QC-014 Rev 3 Approval" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions">Signing instructions (shown to recipients)</Label>
              <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Signing order</Label>
                <Select value={signingMode} onValueChange={(v) => v && setSigningMode(v as "SEQUENTIAL" | "PARALLEL")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => (v === "SEQUENTIAL" ? "Sequential (in order)" : "Parallel (any order)")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEQUENTIAL">Sequential (in order)</SelectItem>
                    <SelectItem value="PARALLEL">Parallel (any order)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires</Label>
                <Input id="expiresAt" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button disabled={!documentId || !title.trim()} onClick={() => setStep(2)}>
                Next: Recipients
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recipients</CardTitle>
            <CardDescription>Assign each recipient a role and, for sequential signing, an order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recipients.map((r, i) => (
              <div key={r.tempId} className="grid grid-cols-12 items-end gap-2 rounded-md border p-3">
                <div className="col-span-1 flex h-9 items-center">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: recipientColor(i) }} />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Full name</Label>
                  <Input value={r.fullName} onChange={(e) => updateRecipient(r.tempId, { fullName: e.target.value })} />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={r.email} onChange={(e) => updateRecipient(r.tempId, { email: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Select value={r.recipientRole} onValueChange={(v) => v && updateRecipient(r.tempId, { recipientRole: v as RecipientRole })}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v: RecipientRole) => ROLE_LABELS[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIGNER">Signer</SelectItem>
                      <SelectItem value="APPROVER">Approver</SelectItem>
                      <SelectItem value="WITNESS">Witness</SelectItem>
                      <SelectItem value="CC">CC (no signature)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Order</Label>
                  <Input
                    type="number"
                    min={1}
                    disabled={signingMode === "PARALLEL" || r.recipientRole === "CC"}
                    value={r.signingOrder}
                    onChange={(e) => updateRecipient(r.tempId, { signingOrder: Number(e.target.value) || 1 })}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => removeRecipient(r.tempId)} disabled={recipients.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addRecipient}>
              <Plus className="mr-2 h-4 w-4" />
              Add recipient
            </Button>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={actingRecipients.length === 0}>
                Next: Place fields
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && fileUrl && (
        <div className="grid grid-cols-[220px_1fr] gap-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recipient</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {recipients
                  .filter((r) => r.recipientRole !== "CC")
                  .map((r) => (
                    <button
                      key={r.tempId}
                      onClick={() => setActiveRecipientTempId(r.tempId)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                        activeRecipientTempId === r.tempId ? "bg-accent" : "hover:bg-muted",
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: recipientColor(recipientIndex(r.tempId)) }} />
                      {r.fullName || r.email || "Unnamed"}
                    </button>
                  ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fields</CardTitle>
                <CardDescription className="text-xs">Drag onto the document.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {(Object.keys(FIELD_DEFAULTS) as FieldType[]).map((type) => {
                  const Icon = FIELD_DEFAULTS[type].icon;
                  return (
                    <div
                      key={type}
                      draggable
                      onDragStart={() => setDragFieldType(type)}
                      className="flex cursor-grab flex-col items-center gap-1 rounded-md border p-2 text-xs hover:bg-muted active:cursor-grabbing"
                    >
                      <Icon className="h-4 w-4" />
                      {FIELD_DEFAULTS[type].label}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <div className="text-xs text-muted-foreground">
              {fields.length} field{fields.length === 1 ? "" : "s"} placed
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={() => setStep(4)} disabled={fields.length === 0}>
                Next: Review
              </Button>
            </div>
          </div>

          <div className="overflow-auto rounded-md border bg-muted p-6">
            <PdfPages
              fileUrl={fileUrl}
              onPageClick={() => {}}
              renderOverlay={(page) => (
                <div
                  className="absolute inset-0"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onPageDrop(page, e)}
                >
                  {fields
                    .filter((f) => f.page === page)
                    .map((f) => {
                      const color = recipientColor(recipientIndex(f.recipientTempId));
                      return (
                        <div
                          key={f.tempId}
                          draggable
                          onDragStart={() => setDraggingExistingId(f.tempId)}
                          className="group absolute flex cursor-move flex-col items-center justify-center gap-0.5 rounded border-2 bg-white/90 p-0.5 text-[10px] font-medium"
                          style={{
                            left: `${f.xPct}%`,
                            top: `${f.yPct}%`,
                            width: `${f.widthPct}%`,
                            height: `${f.heightPct}%`,
                            borderColor: color,
                            color,
                          }}
                        >
                          {f.type === "SIGNATURE" || f.type === "INITIALS" ? (
                            <select
                              value={f.meaningCode ?? ""}
                              onChange={(e) => updateFieldMeaning(f.tempId, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              draggable={false}
                              onDragStart={(e) => e.stopPropagation()}
                              className="w-full max-w-full border-0 bg-transparent text-[9px] font-medium outline-none"
                              style={{ color }}
                            >
                              {meanings.map((m) => (
                                <option key={m.code} value={m.code}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            FIELD_DEFAULTS[f.type].label
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeField(f.tempId);
                            }}
                            className="absolute -right-2 -top-2 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-white group-hover:flex"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            />
          </div>
        </div>
      )}
      {step === 3 && !fileUrl && <p className="text-sm text-muted-foreground">Choose a document first.</p>}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review and send</CardTitle>
            <CardDescription>{selectedDocument?.title} — {title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Recipients ({signingMode === "SEQUENTIAL" ? "sequential" : "parallel"})</h3>
              <ul className="space-y-1 text-sm">
                {recipients.map((r, i) => (
                  <li key={r.tempId} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: recipientColor(i) }} />
                    {signingMode === "SEQUENTIAL" && r.recipientRole !== "CC" && (
                      <Badge variant="secondary">#{r.signingOrder}</Badge>
                    )}
                    <span className="font-medium">{r.fullName}</span>
                    <span className="text-muted-foreground">{r.email}</span>
                    <Badge variant="outline">{r.recipientRole}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {fields.filter((f) => f.recipientTempId === r.tempId).length} field(s)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox id="confirm" />
              <Label htmlFor="confirm" className="text-sm font-normal">
                I&apos;ve reviewed the field placement and recipients and I&apos;m ready to send.
              </Label>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button onClick={onSend} disabled={sending}>
                {sending ? "Sending…" : "Send for signature"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
