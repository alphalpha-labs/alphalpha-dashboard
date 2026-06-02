import { describe, it, expect } from "vitest";
import { categorizeSignalError } from "./signal-error";

describe("categorizeSignalError", () => {
  it("categorizes 401 as auth", () => {
    const r = categorizeSignalError("Signal failed (401)", "done", "item-1");
    expect(r.category).toBe("auth");
    expect(r.humanLabel).toBe("auth error");
    expect(r.rawMessage).toBe("Signal failed (401)");
    expect(r.signalType).toBe("done");
    expect(r.itemId).toBe("item-1");
  });

  it("categorizes 403 as auth", () => {
    const r = categorizeSignalError("Signal failed (403)");
    expect(r.category).toBe("auth");
    expect(r.humanLabel).toBe("auth error");
  });

  it("categorizes 502 as connection", () => {
    const r = categorizeSignalError("Signal failed (502)");
    expect(r.category).toBe("connection");
    expect(r.humanLabel).toBe("server unreachable");
  });

  it("categorizes 503 as connection", () => {
    const r = categorizeSignalError("Signal failed (503)");
    expect(r.category).toBe("connection");
    expect(r.humanLabel).toBe("server unreachable");
  });

  it("categorizes 'unreachable' keyword as connection", () => {
    const r = categorizeSignalError("OpenClaw unreachable");
    expect(r.category).toBe("connection");
    expect(r.humanLabel).toBe("server unreachable");
  });

  it("categorizes 'unavailable' keyword as connection", () => {
    const r = categorizeSignalError("Signal unavailable");
    expect(r.category).toBe("connection");
    expect(r.humanLabel).toBe("server unreachable");
  });

  it("categorizes timeout as connection", () => {
    const r = categorizeSignalError("Request timed out");
    expect(r.category).toBe("connection");
    expect(r.humanLabel).toBe("request timed out");
  });

  it("categorizes 500 as server error", () => {
    const r = categorizeSignalError("Signal failed (500)");
    expect(r.category).toBe("server");
    expect(r.humanLabel).toBe("server error");
  });

  it("categorizes unknown errors", () => {
    const r = categorizeSignalError("Something weird happened");
    expect(r.category).toBe("unknown");
    expect(r.humanLabel).toBe("unexpected error");
  });

  it("preserves signalType and itemId when provided", () => {
    const r = categorizeSignalError("Signal failed (502)", "refresh-dashboard", "dashboard");
    expect(r.signalType).toBe("refresh-dashboard");
    expect(r.itemId).toBe("dashboard");
  });

  it("leaves signalType and itemId undefined when not provided", () => {
    const r = categorizeSignalError("Signal failed (502)");
    expect(r.signalType).toBeUndefined();
    expect(r.itemId).toBeUndefined();
  });
});
