import { create } from "zustand";

export interface Deal {
  id: string;
  hubspot_deal_id?: string | null;
  deal_name?: string | null;
  segment_neu?: string | null;
  deal_stage?: string | null;
  amount?: number | null;
  close_date?: string | null;
  is_won?: boolean | null;
  is_closed?: boolean | null;
  computed_score?: number | null;
  score_band?: string | null;
  created_at?: string | null;
  // extra fields used by scoring
  [key: string]: unknown;
}

export interface DealFilters {
  segment: string;
  band: string;
  minScore: number;
  maxScore: number;
  outcome: string;
  search: string;
}

interface DealsState {
  deals: Deal[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: DealFilters;
  sortColumn: string;
  sortDirection: "asc" | "desc";

  setDeals: (deals: Deal[], total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilter: <K extends keyof DealFilters>(key: K, value: DealFilters[K]) => void;
  resetFilters: () => void;
  setSort: (column: string) => void;
}

const defaultFilters: DealFilters = {
  segment: "",
  band: "",
  minScore: 0,
  maxScore: 100,
  outcome: "",
  search: "",
};

export const useDeals = create<DealsState>((set) => ({
  deals: [],
  total: 0,
  loading: false,
  error: null,
  filters: { ...defaultFilters },
  sortColumn: "computed_score",
  sortDirection: "desc",

  setDeals: (deals, total) => set({ deals, total, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),

  setSort: (column) =>
    set((state) => ({
      sortColumn: column,
      sortDirection:
        state.sortColumn === column && state.sortDirection === "asc"
          ? "desc"
          : "asc",
    })),
}));
