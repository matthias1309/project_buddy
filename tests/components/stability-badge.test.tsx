import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StabilityBadge } from "@/components/shared/stability-badge";

describe("StabilityBadge — FEAT-002 stability badge placeholder", () => {
  it('renders "Stable" label for green status', () => {
    render(<StabilityBadge status="green" />);
    expect(screen.getByText("Stable")).toBeInTheDocument();
  });

  it('renders "At Risk" label for yellow status', () => {
    render(<StabilityBadge status="yellow" />);
    expect(screen.getByText("At Risk")).toBeInTheDocument();
  });

  it('renders "Critical" label for red status', () => {
    render(<StabilityBadge status="red" />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("applies green colour classes for green status", () => {
    const { container } = render(<StabilityBadge status="green" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/green/);
  });

  it("applies yellow colour classes for yellow status", () => {
    const { container } = render(<StabilityBadge status="yellow" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/yellow/);
  });

  it("applies red colour classes for red status", () => {
    const { container } = render(<StabilityBadge status="red" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/red/);
  });
});
