import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn(),
  next: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: mocks.next,
    redirect: mocks.redirect,
  },
}));

import { middleware } from "@/middleware";

function makeRequest(pathname: string) {
  const nextUrl = {
    pathname,
    clone() {
      return {
        pathname: nextUrl.pathname,
        toString: () => `http://localhost${nextUrl.pathname}`,
      };
    },
  };
  return {
    nextUrl,
    cookies: { getAll: () => [], set: vi.fn() },
  } as unknown as NextRequest;
}

describe("middleware — FEAT-001 auth guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.next.mockReturnValue({ cookies: { set: vi.fn() } });
    mocks.redirect.mockImplementation((url: { pathname: string }) => ({
      status: 307,
      cookies: { set: vi.fn() },
      redirectedTo: url.pathname,
    }));
  });

  it("redirects unauthenticated user from protected route to /login", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await middleware(makeRequest("/"));

    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.redirect.mock.calls[0][0].pathname).toBe("/login");
  });

  it("allows authenticated user through on a protected route", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "pm@example.com" } },
    });

    await middleware(makeRequest("/"));

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects authenticated user away from /login to /", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "pm@example.com" } },
    });

    await middleware(makeRequest("/login"));

    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.redirect.mock.calls[0][0].pathname).toBe("/");
  });

  it("allows unauthenticated user to access /login without redirect", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await middleware(makeRequest("/login"));

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
