import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { VALIDATION_DOCS, isValidationDocFile, readValidationDoc, type ValidationDocFile } from "@/lib/validation-docs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_DOC: ValidationDocFile = "README.md";

export default async function ValidationDocsPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  await requireAuthenticatedContext();
  const { doc: requested } = await searchParams;
  const activeFile: ValidationDocFile = requested && isValidationDocFile(requested) ? requested : DEFAULT_DOC;
  const content = await readValidationDoc(activeFile);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Validation &amp; quality documentation</h1>
        <p className="text-sm text-muted-foreground">
          The GAMP 5-aligned validation package (URS, functional/technical specs, risk assessment, IQ/OQ/PQ,
          software test plan, and change/incident/release SOPs) referenced from the{" "}
          <Link href="/compliance/matrix" className="underline">
            compliance traceability matrix
          </Link>
          .
        </p>
      </div>

      <Alert>
        <AlertDescription>
          These documents describe real technical controls and real automated/manual testing performed in this
          development environment, clearly marked where that is the case. Sections marked{" "}
          <code className="rounded bg-muted px-1">[CUSTOMER TO COMPLETE]</code> require your organization&apos;s own
          input and are not filled in on your behalf — nothing here is a claim that validation has been performed
          or that this system is certified or compliant.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardHeader>
            <CardTitle className="text-sm">Documents</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-2 pt-0">
            {VALIDATION_DOCS.map((d) => (
              <Button
                key={d.file}
                variant={d.file === activeFile ? "secondary" : "ghost"}
                size="sm"
                className={cn("justify-start text-left h-auto whitespace-normal py-2")}
                render={<Link href={`/compliance/validation?doc=${encodeURIComponent(d.file)}`} />}
                nativeButton={false}
              >
                {d.title}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="prose-container p-6">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: (p) => <h1 className="mb-4 text-xl font-semibold tracking-tight" {...p} />,
                h2: (p) => <h2 className="mb-3 mt-6 text-lg font-semibold tracking-tight" {...p} />,
                h3: (p) => <h3 className="mb-2 mt-4 text-base font-semibold" {...p} />,
                p: (p) => <p className="mb-3 text-sm leading-relaxed" {...p} />,
                ul: (p) => <ul className="mb-3 ml-5 list-disc space-y-1 text-sm" {...p} />,
                ol: (p) => <ol className="mb-3 ml-5 list-decimal space-y-1 text-sm" {...p} />,
                li: (p) => <li {...p} />,
                a: (p) => <a className="underline" {...p} />,
                code: (p) => <code className="rounded bg-muted px-1 py-0.5 text-xs" {...p} />,
                pre: (p) => <pre className="mb-3 overflow-x-auto rounded bg-muted p-3 text-xs" {...p} />,
                strong: (p) => <strong className="font-semibold" {...p} />,
                table: (p) => (
                  <div className="mb-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm" {...p} />
                  </div>
                ),
                thead: (p) => <thead className="border-b" {...p} />,
                th: (p) => <th className="border-b px-2 py-1.5 text-left font-medium" {...p} />,
                td: (p) => <td className="border-b px-2 py-1.5 align-top" {...p} />,
                hr: (p) => <hr className="my-4 border-border" {...p} />,
              }}
            >
              {content}
            </ReactMarkdown>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
