"use client";

import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DashboardTopbar({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="text-sm text-muted-foreground">{roleLabel}</div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="flex items-center gap-2 px-2" />}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-accent text-accent-foreground text-xs">
              {initials(userName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{userName}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/admin/profile")}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
