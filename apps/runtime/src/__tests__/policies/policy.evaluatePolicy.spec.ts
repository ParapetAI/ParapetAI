/// <reference types="jest" />
import { initRuntimeContext, indexRoutes, indexTenants, indexServices } from "../../core/state";
import { evaluatePolicy } from "../../policy/policy";
import { estimateTokens, estimateCost } from "../../util/cost";
import { rebuildFromRows } from "../../policy/budget";
import { InMemoryVault } from "../../vault";
import type { HydratedRoute, HydratedTenant, HydratedService, ProviderType, EndpointType } from "@parapetai/config-core";

function bootstrapRuntime({
  tenants,
  routes,
  services,
}: {
  tenants: HydratedTenant[];
  routes: HydratedRoute[];
  services: HydratedService[];
}) {
  initRuntimeContext({
    startedAt: Date.now(),
    checksum: "test-checksum",
    hydrated: { version: 1, tenants, routes, services },
    vault: new InMemoryVault(),
    routeByName: indexRoutes(routes),
    tenantByName: indexTenants(tenants),
    serviceKeyToContext: indexServices(services),
  });
}

function makeRoute({
  name,
  tenant,
  provider,
  policy,
}: {
  name: string;
  tenant: string;
  provider: { type: ProviderType; model: string; endpoint_type?: EndpointType; default_params?: Readonly<Record<string, unknown>> };
  policy?: HydratedRoute["policy"];
}): HydratedRoute {
  return {
    name,
    tenant,
    provider: {
      type: provider.type,
      model: provider.model,
      endpoint_type: provider.endpoint_type ?? "chat_completions",
      default_params: provider.default_params,
    },
    policy,
  } as HydratedRoute;
}

function makeTenant(name: string, dailyCapUsd: number): HydratedTenant {
  return { name, spend: { daily_usd_cap: dailyCapUsd } } as HydratedTenant;
}

function makeService(label: string, tenant: string, allowedRoutes: string[], token: string): HydratedService {
  return { label, tenant, allowed_routes: allowedRoutes, parapet_token: token } as HydratedService;
}

describe("evaluatePolicy - authorization and routing", () => {
  beforeEach(() => {
    rebuildFromRows([]);
  });

  test("unauthorized token", async () => {
    bootstrapRuntime({
      tenants: [makeTenant("t1", 1000)],
      routes: [makeRoute({ name: "r1", tenant: "t1", provider: { type: "openai", model: "gpt-4o-mini" } })],
      services: [makeService("svc", "t1", ["r1"], "valid-key")],
    });

    const res = await evaluatePolicy("invalid-key", "r1", { messages: [{ role: "user", content: "hi" }] });
    expect(res).toEqual({ allowed: false, reason: "unauthorized" });
  });

  test("route not allowed for service", async () => {
    bootstrapRuntime({
      tenants: [makeTenant("t1", 1000)],
      routes: [makeRoute({ name: "r1", tenant: "t1", provider: { type: "openai", model: "gpt-4o-mini" } })],
      services: [makeService("svc", "t1", ["other"], "key1")],
    });

    const res = await evaluatePolicy("key1", "r1", { messages: [{ role: "user", content: "hi" }] });
    expect(res).toEqual({ allowed: false, reason: "not_allowed" });
  });

  test("unknown route name", async () => {
    bootstrapRuntime({
      tenants: [makeTenant("t1", 1000)],
      routes: [],
      services: [makeService("svc", "t1", ["r1"], "key1")],
    });

    const res = await evaluatePolicy("key1", "r1", { messages: [{ role: "user", content: "hi" }] });
    expect(res).toEqual({ allowed: false, reason: "unknown_route" });
  });

  test("tenant mismatch", async () => {
    bootstrapRuntime({
      tenants: [makeTenant("t1", 1000), makeTenant("t2", 1000)],
      routes: [makeRoute({ name: "r1", tenant: "t2", provider: { type: "openai", model: "gpt-4o-mini" } })],
      services: [makeService("svc", "t1", ["r1"], "key1")],
    });

    const res = await evaluatePolicy("key1", "r1", { messages: [{ role: "user", content: "hi" }] });
    expect(res).toEqual({ allowed: false, reason: "tenant_mismatch" });
  });
});

describe("evaluatePolicy - no policy passthrough", () => {
  beforeEach(() => {
    rebuildFromRows([]);
  });

  test("chat request passthrough", async () => {
    const route = makeRoute({ name: "r1", tenant: "t1", provider: { type: "openai", model: "gpt-3.5-turbo" } });
    bootstrapRuntime({
      tenants: [makeTenant("t1", 1000)],
      routes: [route],
      services: [makeService("svc", "t1", ["r1"], "key1")],
    });

    const messages = [
      { role: "user", content: "Hello there" },
      { role: "assistant", content: "Hi" },
    ];
    const tokensIn = estimateTokens(messages.map(m => m.content).join("\n"));
    const expectedCost = estimateCost(route.provider.type, route.provider.model, tokensIn, Math.max(1, Math.floor(tokensIn * 0.25)));

    const res = await evaluatePolicy("key1", "r1", { messages });
    expect(res.allowed).toBe(true);
    if (res.allowed) {
      expect(res.sanitizedMessages).toEqual(messages);
      expect(res.redactionApplied).toBe(false);
      expect(res.driftStrict).toBe(false);
      expect(res.budgetBeforeUsd).toBe(0);
      expect(res.estCostUsd).toBeCloseTo(expectedCost, 10);
      expect(res.routeMeta).toEqual({ tenant: "t1", provider: route.provider.type, model: route.provider.model, routeName: "r1" });
    }
  });

  test("embeddings passthrough with string and array inputs", async () => {
    const route = makeRoute({ name: "emb1", tenant: "t1", provider: { type: "openai", model: "text-embedding-3-small", endpoint_type: "embeddings" } });
    bootstrapRuntime({
      tenants: [makeTenant("t1", 1000)],
      routes: [route],
      services: [makeService("svc", "t1", ["emb1"], "key1")],
    });

    const inputText = "alpha beta gamma";
    const tokensIn = estimateTokens(inputText);
    const expectedCost = estimateCost(route.provider.type, route.provider.model, tokensIn, 0);

    const resStr = await evaluatePolicy("key1", "emb1", { input: inputText });
    expect(resStr.allowed).toBe(true);
    if (resStr.allowed) {
      expect(resStr.sanitizedInput).toEqual(inputText);
      expect(resStr.redactionApplied).toBe(false);
      expect(resStr.estCostUsd).toBeCloseTo(expectedCost, 10);
    }

    const arr = ["alpha", "beta", "gamma"];
    const tokensInArr = estimateTokens(arr.join("\n"));
    const expectedCostArr = estimateCost(route.provider.type, route.provider.model, tokensInArr, 0);
    const resArr = await evaluatePolicy("key1", "emb1", { input: arr });
    expect(resArr.allowed).toBe(true);
    if (resArr.allowed) {
      expect(resArr.sanitizedInput).toEqual(arr);
      expect(resArr.redactionApplied).toBe(false);
      expect(resArr.estCostUsd).toBeCloseTo(expectedCostArr, 10);
    }
  });
});

describe("evaluatePolicy - policy enforcement", () => {
  beforeEach(() => {
    rebuildFromRows([]);
  });

  test("max_tokens_in exceeded", async () => {
    const policy: NonNullable<HydratedRoute["policy"]> = {
      max_tokens_in: 5,
      max_tokens_out: 64,
      budget_daily_usd: 100,
      drift_strict: false,
      drift_detection: { enabled: false, sensitivity: "medium", cost_anomaly_threshold: 2 },
      redaction: { mode: "off", patterns: [] },
    };
    const route = makeRoute({ name: "r1", tenant: "t1", provider: { type: "openai", model: "gpt-4o-mini" }, policy });
    bootstrapRuntime({ tenants: [makeTenant("t1", 1000)], routes: [route], services: [makeService("svc", "t1", ["r1"], "key1")] });

    const res = await evaluatePolicy("key1", "r1", { messages: [{ role: "user", content: "This input should exceed token cap significantly." }] });
    expect(res).toEqual({ allowed: false, reason: "max_tokens_in_exceeded" });
  });

  test("redaction mode=block blocks when pattern matches", async () => {
    const policy: NonNullable<HydratedRoute["policy"]> = {
      max_tokens_in: 1000,
      max_tokens_out: 64,
      budget_daily_usd: 100,
      drift_strict: false,
      drift_detection: { enabled: false, sensitivity: "medium", cost_anomaly_threshold: 2 },
      redaction: { mode: "block", patterns: ["email"] },
    };
    const route = makeRoute({ name: "r1", tenant: "t1", provider: { type: "openai", model: "gpt-4o-mini" }, policy });
    bootstrapRuntime({ tenants: [makeTenant("t1", 1000)], routes: [route], services: [makeService("svc", "t1", ["r1"], "key1")] });

    const res = await evaluatePolicy("key1", "r1", { messages: [{ role: "user", content: "contact me at user@example.com" }] });
    expect(res).toEqual({ allowed: false, reason: "redaction_blocked" });
  });

  test("redaction mode=warn scrubs content and marks applied", async () => {
    const policy: NonNullable<HydratedRoute["policy"]> = {
      max_tokens_in: 1000,
      max_tokens_out: 64,
      budget_daily_usd: 100,
      drift_strict: false,
      drift_detection: { enabled: false, sensitivity: "medium", cost_anomaly_threshold: 2 },
      redaction: { mode: "warn", patterns: ["email"] },
    };
    const route = makeRoute({ name: "r1", tenant: "t1", provider: { type: "openai", model: "gpt-4o-mini" }, policy });
    bootstrapRuntime({ tenants: [makeTenant("t1", 1000)], routes: [route], services: [makeService("svc", "t1", ["r1"], "key1")] });

    const res = await evaluatePolicy("key1", "r1", { messages: [{ role: "user", content: "email: user@example.com" }, { role: "assistant", content: "ok" }] });
    expect(res.allowed).toBe(true);
    if (res.allowed) {
      expect(res.redactionApplied).toBe(true);
      expect(res.sanitizedMessages?.[0].content).toContain("[REDACTED_EMAIL]");
    }
  });

  test("enforce max_tokens bounds cost by min(request, policy)", async () => {
    const policy: NonNullable<HydratedRoute["policy"]> = {
      max_tokens_in: 10_000,
      max_tokens_out: 400,
      budget_daily_usd: 100,
      drift_strict: false,
      drift_detection: { enabled: false, sensitivity: "medium", cost_anomaly_threshold: 2 },
      redaction: { mode: "off", patterns: [] },
    };
    const route = makeRoute({ name: "r1", tenant: "t1", provider: { type: "openai", model: "gpt-4o-mini" }, policy });
    bootstrapRuntime({ tenants: [makeTenant("t1", 1000)], routes: [route], services: [makeService("svc", "t1", ["r1"], "key1")] });

    const messages = [{ role: "user", content: "A fairly long prompt to get a bigger token estimate." }];
    const tokensIn = estimateTokens(messages.map(m => m.content).join("\n"));

    // request lower than policy → effectiveCap = request
    const requestMax = 128;
    const baseFloor = 32;
    const ratioGuess = Math.ceil(tokensIn * 1.4);
    const additiveGuess = Math.ceil(tokensIn + 12);
    const unconstrained = Math.max(baseFloor, ratioGuess, additiveGuess);
    const expectedOutGuess = Math.max(1, Math.min(requestMax, policy.max_tokens_out, unconstrained));
    const expectedCost = estimateCost(route.provider.type, route.provider.model, tokensIn, expectedOutGuess);

    const res = await evaluatePolicy("key1", "r1", { messages, params: { max_tokens: requestMax } });
    expect(res.allowed).toBe(true);
    if (res.allowed) {
      expect(res.estCostUsd).toBeCloseTo(expectedCost, 10);
    }
  });
});

describe("evaluatePolicy - tenant and budget", () => {
  beforeEach(() => {
    rebuildFromRows([]);
  });

  test("unknown tenant despite matching names", async () => {
    const policy: NonNullable<HydratedRoute["policy"]> = {
      max_tokens_in: 1000,
      max_tokens_out: 64,
      budget_daily_usd: 10,
      drift_strict: false,
      drift_detection: { enabled: false, sensitivity: "medium", cost_anomaly_threshold: 2 },
      redaction: { mode: "off", patterns: [] },
    };
    const route = makeRoute({ name: "r1", tenant: "ghost", provider: { type: "openai", model: "gpt-4o-mini" }, policy });
    bootstrapRuntime({ tenants: [], routes: [route], services: [makeService("svc", "ghost", ["r1"], "key1")] });

    const res = await evaluatePolicy("key1", "r1", { messages: [{ role: "user", content: "hi" }] });
    expect(res).toEqual({ allowed: false, reason: "unknown_tenant" });
  });

  test("budget success returns prior tenant spend and allows", async () => {
    const policy: NonNullable<HydratedRoute["policy"]> = {
      max_tokens_in: 1000,
      max_tokens_out: 128,
      budget_daily_usd: 100,
      drift_strict: true,
      drift_detection: { enabled: true, sensitivity: "medium", cost_anomaly_threshold: 2 },
      redaction: { mode: "off", patterns: [] },
    };
    const route = makeRoute({ name: "r1", tenant: "t1", provider: { type: "openai", model: "gpt-3.5-turbo" }, policy });
    bootstrapRuntime({ tenants: [makeTenant("t1", 50)], routes: [route], services: [makeService("svc", "t1", ["r1"], "key1")] });

    const res = await evaluatePolicy("key1", "r1", { messages: [{ role: "user", content: "hello" }] });
    expect(res.allowed).toBe(true);
    if (res.allowed) {
      expect(res.budgetBeforeUsd).toBe(0);
      expect(res.routeMeta.tenant).toBe("t1");
    }
  });

  test("budget exceeded by route cap blocks", async () => {
    const smallCap = 0.000001; // 1e-6 USD
    const policy: NonNullable<HydratedRoute["policy"]> = {
      max_tokens_in: 1000,
      max_tokens_out: 128,
      budget_daily_usd: smallCap,
      drift_strict: false,
      drift_detection: { enabled: false, sensitivity: "medium", cost_anomaly_threshold: 2 },
      redaction: { mode: "off", patterns: [] },
    };
    const route = makeRoute({ name: "r1", tenant: "t1", provider: { type: "openai", model: "gpt-3.5-turbo" }, policy });
    bootstrapRuntime({ tenants: [makeTenant("t1", 1)], routes: [route], services: [makeService("svc", "t1", ["r1"], "key1")] });

    const res = await evaluatePolicy("key1", "r1", { messages: [{ role: "user", content: "hello world" }] });
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.reason).toBe("budget_exceeded");
      expect(res.blockMeta).toBeDefined();
      const meta = res.blockMeta as { tenantBudgetBeforeUsd: number; routeBudgetBeforeUsd: number };
      expect(meta.tenantBudgetBeforeUsd).toBe(0);
      expect(meta.routeBudgetBeforeUsd).toBe(0);
    }
  });
});

describe("evaluatePolicy - validation and shape errors", () => {
  beforeEach(() => {
    rebuildFromRows([]);
  });

  test("invalid_body when messages missing for chat under policy", async () => {
    const policy: NonNullable<HydratedRoute["policy"]> = {
      max_tokens_in: 1000,
      max_tokens_out: 64,
      budget_daily_usd: 10,
      drift_strict: false,
      drift_detection: { enabled: false, sensitivity: "medium", cost_anomaly_threshold: 2 },
      redaction: { mode: "off", patterns: [] },
    };
    const route = makeRoute({ name: "r1", tenant: "t1", provider: { type: "openai", model: "gpt-4o-mini" }, policy });
    bootstrapRuntime({ tenants: [makeTenant("t1", 1000)], routes: [route], services: [makeService("svc", "t1", ["r1"], "key1")] });

    const res = await evaluatePolicy("key1", "r1", { messages: [] });
    expect(res).toEqual({ allowed: false, reason: "invalid_body" });
  });
});


