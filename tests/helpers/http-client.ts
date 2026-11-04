const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

/**
 * Minimal cookie-jar fetch wrapper for integration tests — Node's fetch
 * doesn't persist Set-Cookie across requests the way a browser does, and
 * every authenticated flow in this app is cookie-session based.
 */
export class TestClient {
  private cookies = new Map<string, string>();

  private applySetCookie(res: Response) {
    const header = res.headers.get("set-cookie");
    if (!header) return;
    // Node's fetch may fold multiple Set-Cookie headers into one
    // comma-joined string in some runtimes; split defensively.
    for (const part of splitSetCookieHeader(header)) {
      const [pair] = part.split(";");
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(name, value);
    }
  }

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    const cookieHeader = this.cookieHeader();
    if (cookieHeader) headers.set("cookie", cookieHeader);
    const res = await fetch(`${APP_URL}${path}`, { ...init, headers, redirect: "manual" });
    this.applySetCookie(res);
    return res;
  }

  async get(path: string) {
    return this.request(path, { method: "GET" });
  }

  async postJson(path: string, body: unknown) {
    return this.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async patchJson(path: string, body: unknown) {
    return this.request(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async postForm(path: string, formData: FormData) {
    return this.request(path, { method: "POST", body: formData });
  }
}

function splitSetCookieHeader(header: string): string[] {
  // A single Set-Cookie value never contains an unescaped comma before an
  // "=" for the next cookie's name, except within Expires=...GMT dates —
  // guard against splitting those by requiring a word char + "=" after the comma.
  return header.split(/,(?=\s*[A-Za-z0-9_]+=)/);
}
