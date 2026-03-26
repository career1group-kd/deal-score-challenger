import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import ScenarioBuilder from "./pages/ScenarioBuilder";
import DealExplorer from "./pages/DealExplorer";
import BacktestResults from "./pages/BacktestResults";
import Comparison from "./pages/Comparison";
import Login from "./pages/Login";
import { auth } from "./api/client";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    auth
      .check()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  // Loading state
  if (authed === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Not authenticated
  if (authed === false) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto px-6 py-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/scenario" element={<ScenarioBuilder />} />
              <Route path="/deals" element={<DealExplorer />} />
              <Route path="/backtest" element={<BacktestResults />} />
              <Route path="/compare" element={<Comparison />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
