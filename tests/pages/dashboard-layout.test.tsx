import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ getAll: () => [], set: vi.fn() })),
}));

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardLayout from "@/app/(dashboard)/layout";

function mockClient(user: { id: string; email: string } | null) {
  vi.mocked(createClient).mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  } as unknown as ReturnType<typeof createClient>);
}

describe("DashboardLayout — FEAT-001 navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the authenticated user's email in the navigation", async () => {
    mockClient({ id: "u1", email: "pm@example.com" });

    render(await DashboardLayout({ children: <div /> }));

    expect(screen.getByText("pm@example.com")).toBeInTheDocument();
  });

  it("renders the PM Dashboard logo link", async () => {
    mockClient({ id: "u1", email: "pm@example.com" });

    render(await DashboardLayout({ children: <div /> }));

    expect(screen.getByText("PM Dashboard")).toBeInTheDocument();
  });

  it("renders the Sign out button", async () => {
    mockClient({ id: "u1", email: "pm@example.com" });

    render(await DashboardLayout({ children: <div /> }));

    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("renders children inside the layout", async () => {
    mockClient({ id: "u1", email: "pm@example.com" });

    render(
      await DashboardLayout({ children: <div data-testid="child-content" /> })
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("redirects to /login when user has no active session", async () => {
    mockClient(null);

    await expect(DashboardLayout({ children: <div /> })).rejects.toThrow(
      "REDIRECT:/login"
    );
  });
});
