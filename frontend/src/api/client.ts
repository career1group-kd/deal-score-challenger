const BASE = "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------
export const auth = {
  login: (password: string) =>
    request<{ ok: boolean }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  check: () => request<{ authenticated: boolean }>("/auth/check"),
  logout: () =>
    request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};

// ---------------------------------------------------------------
// Deals
// ---------------------------------------------------------------
export interface DealListParams {
  segment?: string;
  band?: string;
  min_score?: number;
  max_score?: number;
  outcome?: string;
  search?: string;
  scenario_id?: string;
  skip?: number;
  limit?: number;
}

export const deals = {
  getDeals: (params?: DealListParams) => {
    const qs = params
      ? "?" + new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    return request<unknown[]>(`/deals${qs}`);
  },
  getFieldFillRates: () => request<{ total_deals: number; fill_rates: Record<string, number> }>(`/deals/field-fill-rates`),
  getDeal: (id: string) => request<unknown>(`/deals/${id}`),
  getDealScoreBreakdown: (id: string, scenarioId?: string) => {
    const qs = scenarioId ? `?scenario_id=${scenarioId}` : "";
    return request<unknown>(`/deals/${id}/score-breakdown${qs}`);
  },
};

// ---------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------
export const scenarios = {
  getScenarios: () => request<unknown[]>("/scenarios"),
  createScenario: (data: unknown) =>
    request<unknown>("/scenarios", { method: "POST", body: JSON.stringify(data) }),
  updateScenario: (id: string, data: unknown) =>
    request<unknown>(`/scenarios/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteScenario: (id: string) =>
    request<void>(`/scenarios/${id}`, { method: "DELETE" }),
  setBaseline: (id: string) =>
    request<unknown>(`/scenarios/${id}/baseline`, { method: "POST" }),
};

// ---------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------
export const scoring = {
  calculateScores: (scenarioId: string) =>
    request<unknown>("/scoring/calculate", {
      method: "POST",
      body: JSON.stringify({ scenario_id: scenarioId }),
    }),
  previewScores: (data: unknown) =>
    request<unknown>("/scoring/preview", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ---------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------
export const analytics = {
  getDistribution: (scenarioId?: string) => {
    const qs = scenarioId ? `?scenario_id=${scenarioId}` : "";
    return request<unknown>(`/analytics/distribution${qs}`);
  },
  getWinRate: (scenarioId?: string) => {
    const qs = scenarioId ? `?scenario_id=${scenarioId}` : "";
    return request<unknown>(`/analytics/win-rate${qs}`);
  },
  getBacktest: (scenarioId: string) =>
    request<unknown>(`/analytics/backtest/${scenarioId}`),
  getCompare: (scenarioA: string, scenarioB: string) =>
    request<unknown>(`/analytics/compare?scenario_a=${scenarioA}&scenario_b=${scenarioB}`),
  getRoc: (scenarioId: string) =>
    request<unknown>(`/analytics/roc/${scenarioId}`),
  getRevenueImpact: (scenarioId: string) =>
    request<unknown>(`/analytics/revenue-impact/${scenarioId}`),
  getConfusionMatrix: (scenarioId: string, threshold?: number) => {
    const qs = threshold != null ? `?threshold=${threshold}` : "";
    return request<unknown>(`/analytics/confusion-matrix/${scenarioId}${qs}`);
  },
};

// ---------------------------------------------------------------
// HubSpot
// ---------------------------------------------------------------
export const hubspot = {
  syncDeals: () =>
    request<unknown>("/hubspot/sync", { method: "POST" }),
  getSyncStatus: () => request<unknown>("/hubspot/status"),
};
