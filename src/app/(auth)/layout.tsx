import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted">
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-6 w-6" />
          Part11 eSign
        </Link>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Electronic records and signatures built for regulated industries.
          </h1>
          <p className="text-sm text-primary-foreground/70">
            Authenticated signatures, immutable audit trails, and document
            integrity controls designed around 21 CFR Part 11 — for pharma,
            biotech, medical device, and clinical research teams.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} Part11 eSign. Not a certification of regulatory compliance.
        </p>
      </div>
      <div className="flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
