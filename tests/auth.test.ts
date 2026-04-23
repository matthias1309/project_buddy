import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginSchema } from "@/lib/validations/auth.schema";
import { ERRORS } from "@/lib/errors";

// ---------------------------------------------------------------------------
// LoginSchema validation
// ---------------------------------------------------------------------------
describe("LoginSchema", () => {
  it("accepts valid email and password", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = LoginSchema.safeParse({
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = LoginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// login / logout actions — mocked Supabase + next/navigation
// ---------------------------------------------------------------------------
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

import { login, logout } from "@/lib/actions/auth.actions";

describe("login action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error for invalid email format", async () => {
    const fd = new FormData();
    fd.set("email", "bad-email");
    fd.set("password", "pw");
    const result = await login(null, fd);
    expect(result).toEqual({ error: ERRORS.AUTH_INVALID_CREDENTIALS });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("returns error when Supabase rejects credentials", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login" } });
    const fd = new FormData();
    fd.set("email", "user@example.com");
    fd.set("password", "wrongpassword");
    const result = await login(null, fd);
    expect(result).toEqual({ error: ERRORS.AUTH_INVALID_CREDENTIALS });
  });

  it("does not reveal whether email or password was wrong", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login" } });
    const fd = new FormData();
    fd.set("email", "user@example.com");
    fd.set("password", "wrong");
    const result = await login(null, fd) as { error: string };
    expect(result.error).toBe(ERRORS.AUTH_INVALID_CREDENTIALS);
  });

  it("redirects to / on successful login", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const fd = new FormData();
    fd.set("email", "user@example.com");
    fd.set("password", "correctpassword");
    await expect(login(null, fd)).rejects.toThrow("REDIRECT:/");
  });
});

describe("logout action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls signOut and redirects to /login", async () => {
    mockSignOut.mockResolvedValue({});
    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});
