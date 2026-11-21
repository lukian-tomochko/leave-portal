// Секрет обходу захисту Vercel надсилаємо лише на довірені адреси (WS11, scripts/lib/bypass-host.mjs).
import { describe, expect, it } from "vitest";
import { bypassHostAllowed, httpsHost } from "../../scripts/lib/bypass-host.mjs";

const PROD = "https://leave-portal-blush.vercel.app";
const SUFFIX = "-ai-automation-team1.vercel.app";

describe("httpsHost", () => {
  it("віддає хост лише для https і ігнорує облікові дані перед @", () => {
    expect(httpsHost("https://Leave-Portal.vercel.app/path?x=1")).toBe("leave-portal.vercel.app");
    expect(httpsHost("http://leave-portal.vercel.app")).toBe("");
    expect(httpsHost("https://good.vercel.app:pw@evil.example.com")).toBe("evil.example.com");
    expect(httpsHost("не адреса")).toBe("");
    expect(httpsHost(undefined)).toBe("");
  });
});

describe("bypassHostAllowed", () => {
  it("довіряє прод-хосту і хостам із суфіксом команди Vercel", () => {
    expect(bypassHostAllowed(PROD, PROD, SUFFIX)).toBe(true);
    expect(bypassHostAllowed(`${PROD}/`, PROD)).toBe(true);
    expect(bypassHostAllowed(`https://leave-portal-git-staging${SUFFIX}`, PROD, SUFFIX)).toBe(true);
    expect(bypassHostAllowed(`https://leave-portal-abc123${SUFFIX}`, PROD, SUFFIX)).toBe(true);
  });

  it("не довіряє чужому хосту, http, обліковим даним і хосту без суфікса", () => {
    expect(bypassHostAllowed("https://evil.example.com", PROD, SUFFIX)).toBe(false);
    expect(bypassHostAllowed(`https://leave-portal-git-staging${SUFFIX}.evil.example.com`, PROD, SUFFIX)).toBe(false);
    expect(bypassHostAllowed(`https://leave-portal-blush.vercel.app:pw@evil.example.com`, PROD, SUFFIX)).toBe(false);
    expect(bypassHostAllowed(`http://leave-portal-git-staging${SUFFIX}`, PROD, SUFFIX)).toBe(false);
    expect(bypassHostAllowed("https://other-project.vercel.app", PROD, SUFFIX)).toBe(false);
    // preview без налаштованого суфікса не довіряємо: лише прод-хост
    expect(bypassHostAllowed(`https://leave-portal-git-staging${SUFFIX}`, PROD)).toBe(false);
  });

  it("відкидає порожню адресу, порожній PROD_URL і суфікс без дефіса чи сам суфікс як хост", () => {
    expect(bypassHostAllowed("", PROD, SUFFIX)).toBe(false);
    expect(bypassHostAllowed(PROD, "", SUFFIX)).toBe(false);
    expect(bypassHostAllowed(`https://leave-portal-git-staging${SUFFIX}`, PROD, "vercel.app")).toBe(false);
    expect(bypassHostAllowed(`https://${SUFFIX.slice(1)}`, PROD, SUFFIX)).toBe(false);
  });
});
