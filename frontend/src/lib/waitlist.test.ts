import { describe, it, expect } from "vitest";
import {
  formatClock,
  formatDuration,
  waitedLabel,
  SMS_TEMPLATE,
  RESTAURANT_NAME,
  TIMEOUT_OPTIONS,
} from "./waitlist";

describe("waitlist helpers", () => {
  describe("formatDuration", () => {
    it("formats zero as 0:00", () => {
      expect(formatDuration(0)).toBe("0:00");
    });

    it("formats seconds under a minute", () => {
      expect(formatDuration(45_000)).toBe("0:45");
    });

    it("formats minutes and seconds", () => {
      expect(formatDuration(125_000)).toBe("2:05");
    });

    it("clamps negative values to 0:00", () => {
      expect(formatDuration(-5_000)).toBe("0:00");
    });
  });

  describe("waitedLabel", () => {
    it("labels waits under an hour in minutes", () => {
      expect(waitedLabel(0, 6 * 60_000)).toBe("6 min");
    });

    it("labels waits over an hour in hours and minutes", () => {
      expect(waitedLabel(0, 90 * 60_000)).toBe("1h 30m");
    });

    it("clamps inverted ranges to 0 min", () => {
      expect(waitedLabel(10_000, 0)).toBe("0 min");
    });
  });

  describe("formatClock", () => {
    it("returns a non-empty time string", () => {
      const label = formatClock(Date.now());
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    });
  });

  describe("constants", () => {
    it("SMS template mentions the restaurant name", () => {
      expect(RESTAURANT_NAME).toBe("Olive & Ember");
      expect(SMS_TEMPLATE).toContain(RESTAURANT_NAME);
    });

    it("exposes timeout options", () => {
      expect([...TIMEOUT_OPTIONS]).toEqual([5, 10, 15, 20]);
    });
  });
});
