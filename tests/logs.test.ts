import {
  colorizeStatus,
  formatTimestamp,
  calculateDuration,
  formatRunsTable,
  formatRunDetails,
} from "../src/cli/formatting";
import type { logging } from "@digital-fluid/fluid-agent";

type TaskStatus = logging.TaskStatus;

describe("formatting utilities", () => {
  describe("colorizeStatus", () => {
    test("returns colored string for completed", () => {
      const result = colorizeStatus("completed");
      expect(result).toContain("completed");
    });

    test("returns colored string for failed", () => {
      const result = colorizeStatus("failed");
      expect(result).toContain("failed");
    });

    test("returns colored string for running", () => {
      const result = colorizeStatus("running");
      expect(result).toContain("running");
    });

    test("returns colored string for queued", () => {
      const result = colorizeStatus("queued");
      expect(result).toContain("queued");
    });

    test("returns colored string for cancelled", () => {
      const result = colorizeStatus("cancelled");
      expect(result).toContain("cancelled");
    });

    test("returns colored string for superseded", () => {
      const result = colorizeStatus("superseded");
      expect(result).toContain("superseded");
    });
  });

  describe("formatTimestamp", () => {
    test("formats recent timestamp as seconds ago", () => {
      const now = new Date();
      const fiveSecsAgo = new Date(now.getTime() - 5000);
      const result = formatTimestamp(fiveSecsAgo.toISOString());
      expect(result).toMatch(/\d+s ago/);
    });

    test("formats timestamp as minutes ago", () => {
      const now = new Date();
      const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const result = formatTimestamp(fiveMinsAgo.toISOString());
      expect(result).toMatch(/\d+m ago/);
    });

    test("formats timestamp as hours ago", () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const result = formatTimestamp(twoHoursAgo.toISOString());
      expect(result).toMatch(/\d+h ago/);
    });

    test("formats timestamp as days ago", () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const result = formatTimestamp(twoDaysAgo.toISOString());
      expect(result).toMatch(/\d+d ago/);
    });

    test("formats old timestamp as locale string", () => {
      const now = new Date();
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const result = formatTimestamp(eightDaysAgo.toISOString());
      // Should contain date components when older than 7 days
      expect(result).not.toMatch(/ago$/);
    });
  });

  describe("calculateDuration", () => {
    test("returns 'running' when no end time provided", () => {
      const start = "2025-11-29T10:00:00Z";
      expect(calculateDuration(start, undefined)).toBe("running");
    });

    test("calculates duration in milliseconds for very short durations", () => {
      const start = "2025-11-29T10:00:00.000Z";
      const end = "2025-11-29T10:00:00.500Z";
      const result = calculateDuration(start, end);
      expect(result).toBe("500ms");
    });

    test("calculates duration in seconds", () => {
      const start = "2025-11-29T10:00:00Z";
      const end = "2025-11-29T10:00:05Z";
      const result = calculateDuration(start, end);
      expect(result).toBe("5.0s");
    });

    test("calculates duration in minutes and seconds", () => {
      const start = "2025-11-29T10:00:00Z";
      const end = "2025-11-29T10:02:30Z";
      const result = calculateDuration(start, end);
      expect(result).toBe("2m 30s");
    });

    test("handles durations with fractional seconds", () => {
      const start = "2025-11-29T10:00:00Z";
      const end = "2025-11-29T10:00:03.500Z";
      const result = calculateDuration(start, end);
      expect(result).toBe("3.5s");
    });

    test("handles long durations", () => {
      const start = "2025-11-29T10:00:00Z";
      const end = "2025-11-29T10:15:45Z";
      const result = calculateDuration(start, end);
      expect(result).toBe("15m 45s");
    });
  });

  describe("formatRunsTable", () => {
    test("handles empty runs array", () => {
      const originalLog = console.log;
      console.log = jest.fn();

      // Should not throw
      expect(() => {
        formatRunsTable([]);
      }).not.toThrow();

      console.log = originalLog;
    });
  });

  describe("formatRunDetails", () => {
    test("formats run details without errors", () => {
      const mockRun = {
        id: "test-run-id-123",
        taskId: "test-task",
        runType: "spec-to-execution" as const,
        specHash: "abc123def456",
        agentVersion: "0.1.0",
        createdAt: "2025-11-29T10:00:00Z",
        status: "completed" as TaskStatus,
        warnings: [],
        attemptNumber: 1,
      };

      const originalLog = console.log;
      console.log = jest.fn();

      // Should not throw
      expect(() => {
        formatRunDetails(mockRun);
      }).not.toThrow();

      console.log = originalLog;
    });
  });
});
