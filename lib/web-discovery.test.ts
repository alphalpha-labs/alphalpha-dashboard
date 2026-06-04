import { describe, it, expect, afterEach, vi } from "vitest";
import {
  feedbackHints,
  extractYouTubeId,
  htmlToText,
  parseJsonLoose,
  hostOf,
  makeBudget,
  createWebDiscovery,
} from "../scripts/lib/web-discovery.mjs";

const SEARCH_KEYS = [
  "TAVILY_API_KEY", "EXA_API_KEY", "BRAVE_SEARCH_API_KEY", "SERPER_API_KEY",
  "OPENCLAW_BASE_URL", "OPENCLAW_GATEWAY_TOKEN", "ALMANAC_SEARCH_PROVIDER",
  "ALMANAC_DISABLE_WEB", "ALMANAC_SEARCH_MAX", "ALMANAC_FETCH_MAX",
  "ALMANAC_OPENCLAW_SEARCH_MODEL", "ALMANAC_COMPOSER_MODEL",
];
function clearSearchEnv() {
  for (const k of SEARCH_KEYS) delete process.env[k];
}
afterEach(() => {
  clearSearchEnv();
  vi.unstubAllGlobals();
});

describe("feedbackHints", () => {
  it("maps 'more X' chips and kept sources into prefer terms", () => {
    const h = feedbackHints({
      chipTallies: { "more blues": 3, "more funk": 1, "go deeper": 2 },
      sourceAffinity: { Fingerstyle: 2 },
    });
    expect(h.prefer).toContain("blues");
    expect(h.prefer).toContain("funk");
    expect(h.prefer).toContain("fingerstyle");
    // non-"more" chips are not preferences
    expect(h.prefer).not.toContain("go deeper");
  });

  it("derives avoid signals and dedupes", () => {
    const h = feedbackHints({ chipTallies: { "seen it": 1, "not for me": 1 } });
    expect(h.avoid.length).toBeGreaterThan(0);
    const h2 = feedbackHints({ chipTallies: { "more blues": 1 }, sourceAffinity: { blues: 1 } });
    expect(h2.prefer.filter((p: string) => p === "blues")).toHaveLength(1);
  });
});

describe("extractYouTubeId", () => {
  it("parses every common YouTube URL shape", () => {
    expect(extractYouTubeId("https://youtu.be/rj-YurbfhRE?si=x")).toBe("rj-YurbfhRE");
    expect(extractYouTubeId("https://www.youtube.com/watch?v=lqazOnFWatM&list=PL")).toBe("lqazOnFWatM");
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://youtube.com/shorts/abcdefghijk")).toBe("abcdefghijk");
    expect(extractYouTubeId("https://example.com/not-a-video")).toBeNull();
  });
});

describe("htmlToText", () => {
  it("strips tags, scripts, and entities and caps length", () => {
    const html = "<style>x{}</style><p>Hello&nbsp;<b>world</b></p><script>evil()</script>";
    const text = htmlToText(html, 100);
    expect(text).toBe("Hello world");
    expect(htmlToText("<p>" + "a".repeat(50) + "</p>", 10).length).toBe(10);
  });
});

describe("parseJsonLoose", () => {
  it("extracts JSON from fenced and raw model output", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('noise [{"u":"x"}] tail')).toEqual([{ u: "x" }]);
    expect(parseJsonLoose("no json here")).toBeNull();
  });
});

describe("hostOf", () => {
  it("returns bare hostname without www", () => {
    expect(hostOf("https://www.youtube.com/watch?v=1")).toBe("youtube.com");
    expect(hostOf("not a url")).toBe("");
  });
});

describe("makeBudget", () => {
  it("hands out a finite number of searches/fetches", () => {
    const b = makeBudget({ maxSearches: 2, maxFetches: 1 });
    expect(b.takeSearch()).toBe(true);
    expect(b.takeSearch()).toBe(true);
    expect(b.takeSearch()).toBe(false);
    expect(b.takeFetch()).toBe(true);
    expect(b.takeFetch()).toBe(false);
  });
});

describe("createWebDiscovery provider resolution", () => {
  it("is disabled with no provider configured", async () => {
    clearSearchEnv();
    const d = createWebDiscovery();
    expect(d.provider).toBe("none");
    expect(d.available).toBe(false);
    expect(await d.search("anything")).toEqual([]);
  });

  it("selects a dedicated API when its key is present", () => {
    clearSearchEnv();
    process.env.TAVILY_API_KEY = "test";
    expect(createWebDiscovery().provider).toBe("tavily");
  });

  it("honors ALMANAC_DISABLE_WEB even when a key is set", () => {
    clearSearchEnv();
    process.env.TAVILY_API_KEY = "test";
    process.env.ALMANAC_DISABLE_WEB = "1";
    expect(createWebDiscovery().available).toBe(false);
  });

  it("falls back to the OpenClaw gateway when only gateway env is set", () => {
    clearSearchEnv();
    process.env.OPENCLAW_BASE_URL = "http://x";
    process.env.OPENCLAW_GATEWAY_TOKEN = "t";
    expect(createWebDiscovery().provider).toBe("openclaw");
  });

  it("uses the OpenClaw gateway-native model path without unsupported web_search tools", async () => {
    clearSearchEnv();
    process.env.OPENCLAW_BASE_URL = "http://x";
    process.env.OPENCLAW_GATEWAY_TOKEN = "t";

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("openclaw");
      expect(body.tools).toBeUndefined();
      return new Response(JSON.stringify({
        output: [{
          content: [{
            text: JSON.stringify([{ title: "Result", url: "https://example.com/a", snippet: "Snippet" }]),
          }],
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const discovery = createWebDiscovery({ budget: makeBudget({ maxSearches: 1, maxFetches: 0 }) });
    const results = await discovery.search("test query", { count: 1 });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(results).toEqual([{
      title: "Result",
      url: "https://example.com/a",
      snippet: "Snippet",
      source: "example.com",
      date: null,
    }]);
  });
});
