// lib/signal-error.ts

export type ErrorDetail = {
  category: "auth" | "connection" | "server" | "unknown";
  humanLabel: string;
  rawMessage: string;
  signalType?: string;
  itemId?: string;
};

export function categorizeSignalError(
  rawMessage: string,
  signalType?: string,
  itemId?: string,
): ErrorDetail {
  const m = rawMessage.toLowerCase();
  let category: ErrorDetail["category"] = "unknown";
  let humanLabel = "unexpected error";

  if (m.includes("401") || m.includes("403") || m.includes("auth")) {
    category = "auth";
    humanLabel = "auth error";
  } else if (m.includes("timeout") || m.includes("timed out")) {
    category = "connection";
    humanLabel = "request timed out";
  } else if (
    m.includes("502") || m.includes("503") ||
    m.includes("unreachable") || m.includes("unavailable")
  ) {
    category = "connection";
    humanLabel = "server unreachable";
  } else if (/\(5\d\d\)/.test(m) || m.includes("500")) {
    category = "server";
    humanLabel = "server error";
  }

  return { category, humanLabel, rawMessage, signalType, itemId };
}
