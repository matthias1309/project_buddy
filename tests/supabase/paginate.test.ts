import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { fetchAllTimesheets, fetchAllTimesheetsForProjects } from "@/lib/supabase/paginate";

const PAGE_SIZE = 1000;

type Row = Record<string, unknown>;
type MockResponse = { data: Row[] | null; error: { message: string } | null };

function buildClient(responses: MockResponse[]) {
  let callCount = 0;
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation(() => {
      const res = responses[callCount] ?? { data: [], error: null };
      callCount++;
      return Promise.resolve(res);
    }),
  };
  return { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient<Database>;
}

describe("paginateTimesheets", () => {
  describe("fetchAllTimesheets", () => {
    it("returns empty array when the first page is empty", async () => {
      const client = buildClient([{ data: [], error: null }]);
      await expect(fetchAllTimesheets(client, "proj-1")).resolves.toEqual([]);
    });

    it("returns rows when the page is smaller than PAGE_SIZE", async () => {
      const rows: Row[] = [{ id: "ts-1", project_id: "proj-1" }];
      const client = buildClient([{ data: rows, error: null }]);
      const result = await fetchAllTimesheets(client, "proj-1");
      expect(result).toHaveLength(1);
    });

    it("fetches a second page when the first page is exactly PAGE_SIZE", async () => {
      const page1: Row[] = Array.from({ length: PAGE_SIZE }, (_, i) => ({
        id: `ts-${i}`,
        project_id: "proj-1",
      }));
      const page2: Row[] = [{ id: "ts-last", project_id: "proj-1" }];
      const client = buildClient([
        { data: page1, error: null },
        { data: page2, error: null },
      ]);
      const result = await fetchAllTimesheets(client, "proj-1");
      expect(result).toHaveLength(PAGE_SIZE + 1);
    });

    it("throws when Supabase returns an error", async () => {
      const client = buildClient([{ data: null, error: { message: "DB error" } }]);
      await expect(fetchAllTimesheets(client, "proj-1")).rejects.toThrow("DB error");
    });
  });

  describe("fetchAllTimesheetsForProjects", () => {
    it("returns empty array immediately when projectIds is empty", async () => {
      const client = buildClient([]);
      await expect(fetchAllTimesheetsForProjects(client, [])).resolves.toEqual([]);
    });

    it("fetches and flattens rows for multiple project IDs", async () => {
      const rows1: Row[] = [{ id: "ts-a", project_id: "proj-1" }];
      const rows2: Row[] = [{ id: "ts-b", project_id: "proj-2" }];
      const client = buildClient([
        { data: rows1, error: null },
        { data: rows2, error: null },
      ]);
      const result = await fetchAllTimesheetsForProjects(client, ["proj-1", "proj-2"]);
      expect(result).toHaveLength(2);
    });
  });
});
