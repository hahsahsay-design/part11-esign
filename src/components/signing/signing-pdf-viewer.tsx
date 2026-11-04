"use client";

import { PdfPages } from "@/components/workflow/pdf-pages";
import type { SigningField } from "@/components/signing/signing-session";

export function SigningPdfViewer({
  token,
  fields,
  responses,
  onFieldChange,
}: {
  token: string;
  fields: SigningField[];
  responses: Record<string, string>;
  onFieldChange: (fieldId: string, value: string) => void;
}) {
  return (
    <PdfPages
      fileUrl={`/api/sign/${token}/file`}
      renderOverlay={(page) => (
        <div className="absolute inset-0">
          {fields
            .filter((f) => f.page === page)
            .map((f) => (
              <div
                key={f.id}
                className="absolute"
                style={{
                  left: `${f.xPct}%`,
                  top: `${f.yPct}%`,
                  width: `${f.widthPct}%`,
                  height: `${f.heightPct}%`,
                }}
              >
                <FieldControl field={f} value={responses[f.id] ?? ""} onChange={(v) => onFieldChange(f.id, v)} />
              </div>
            ))}
        </div>
      )}
    />
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: SigningField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "SIGNATURE" || field.type === "INITIALS") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded border-2 border-primary bg-primary/5 px-1 text-center">
        <span className="font-serif text-[11px] italic text-primary">
          {field.type === "SIGNATURE" ? "Signature" : "Initials"} — applied on sign
        </span>
        {field.defaultMeaning && <span className="text-[9px] text-primary/70">{field.defaultMeaning.label}</span>}
      </div>
    );
  }
  if (field.type === "CHECKBOX") {
    return (
      <button
        type="button"
        onClick={() => onChange(value === "true" ? "" : "true")}
        className="flex h-full w-full items-center justify-center rounded border-2 border-primary bg-white"
      >
        {value === "true" && <span className="text-primary">✓</span>}
      </button>
    );
  }
  if (field.type === "DATE") {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full rounded border-2 border-primary bg-white px-1 text-[10px]"
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      placeholder={field.label ?? "Text"}
      onChange={(e) => onChange(e.target.value)}
      className="h-full w-full rounded border-2 border-primary bg-white px-1 text-[10px]"
    />
  );
}
