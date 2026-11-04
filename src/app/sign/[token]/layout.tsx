import { ShieldCheck } from "lucide-react";

export default function SignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted">
      <header className="flex h-14 items-center gap-2 border-b bg-background px-6">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">Part11 eSign</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
