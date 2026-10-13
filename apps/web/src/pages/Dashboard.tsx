import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Zap
} from 'lucide-react';
import { api } from '../api/client';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await api.getQualitySummary();
      setSummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleRunAiScan = async () => {
    setIsScanning(true);
    try {
      await api.runAiScan();
      navigate('/review');
    } catch (err: any) {
      alert(`AI Scan error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-500" />
        Loading catalog health metrics...
      </div>
    );
  }

  const { averageScore, bands, syncStateCounts, violations, totalProducts } = summary;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Catalog Health & Sync Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time quality scoring, verifiable AI enrichment queue, and WooCommerce sync monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunAiScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-lg shadow-lg shadow-indigo-600/25 transition-all duration-150 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Agent Scanning Catalog...' : 'Run AI Enrichment Agent'}
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Quality Score Card */}
        <div className="glass-card rounded-2xl p-6 border border-indigo-500/30 relative overflow-hidden shadow-xl hover:border-indigo-400/50">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Catalog Quality</span>
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className={`text-4xl font-extrabold tracking-tight ${
              averageScore >= 90 ? 'text-emerald-400 glow-emerald' : averageScore >= 70 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {averageScore}
            </span>
            <span className="text-sm font-semibold text-indigo-300/60">/ 100</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-200/70">
            <span>Target: &gt;90 after agent pass</span>
          </div>
        </div>

        {/* Total Products */}
        <div className="glass-card rounded-2xl p-6 border border-indigo-900/40 relative overflow-hidden shadow-xl hover:border-indigo-400/50">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Total Products</span>
            <TrendingUp className="w-5 h-5 text-sky-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-white">{totalProducts}</span>
            <span className="text-xs font-medium text-indigo-200/60">items in PIM</span>
          </div>
          <div className="mt-3 text-xs text-indigo-200/70 flex items-center gap-1.5">
            <span className="text-emerald-300 font-bold">{bands.Healthy}</span> healthy,
            <span className="text-amber-300 font-bold ml-1">{bands['Needs work']}</span> needs work,
            <span className="text-rose-300 font-bold ml-1">{bands.Poor}</span> poor
          </div>
        </div>

        {/* Sync Status Card */}
        <div className="glass-card rounded-2xl p-6 border border-emerald-500/30 relative overflow-hidden shadow-xl hover:border-emerald-400/50">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Synced to Store</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-emerald-300 glow-emerald">{syncStateCounts.synced || 0}</span>
            <span className="text-xs font-medium text-emerald-200/60">confirmed in Woo</span>
          </div>
          <div className="mt-3 text-xs text-emerald-200/80">
            {syncStateCounts.draft || 0} local drafts, {syncStateCounts.pending || 0} pending
          </div>
        </div>

        {/* Attention / Failures Card */}
        <div className="glass-card rounded-2xl p-6 border border-rose-500/30 relative overflow-hidden shadow-xl hover:border-rose-400/50">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-rose-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Action Needed</span>
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className={`text-4xl font-extrabold ${
              (syncStateCounts.failed || 0) + (syncStateCounts.conflict || 0) > 0 ? 'text-rose-400' : 'text-slate-100'
            }`}>
              {(syncStateCounts.failed || 0) + (syncStateCounts.conflict || 0)}
            </span>
            <span className="text-xs font-medium text-indigo-200/60">sync issues</span>
          </div>
          <div className="mt-3 text-xs text-indigo-200/70">
            {syncStateCounts.failed || 0} failed retries, {syncStateCounts.conflict || 0} store conflicts
          </div>
        </div>
      </div>

      {/* Two Column Layout: Score Bands & Rule Deductions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Distribution */}
        <div className="glass-card rounded-2xl p-6 border border-indigo-900/40 space-y-4 shadow-xl">
          <h2 className="text-base font-bold text-white flex items-center justify-between">
            <span className="gradient-accent-text font-bold text-lg">Score Bands</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              PRD Sec 5
            </span>
          </h2>

          <div className="space-y-4 pt-2">
            {/* Healthy Band */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-semibold">
                <span className="text-emerald-300">Healthy (90 - 100)</span>
                <span className="text-indigo-200 font-mono">{bands.Healthy} products ({Math.round((bands.Healthy / totalProducts) * 100 || 0)}%)</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-900/80 overflow-hidden border border-indigo-950/80 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-sm shadow-emerald-500/50"
                  style={{ width: `${(bands.Healthy / totalProducts) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-indigo-300/60 mt-1 block">Ready for instant publishing</span>
            </div>

            {/* Needs Work Band */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-semibold">
                <span className="text-amber-300">Needs Work (70 - 89)</span>
                <span className="text-indigo-200 font-mono">{bands['Needs work']} products ({Math.round((bands['Needs work'] / totalProducts) * 100 || 0)}%)</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-900/80 overflow-hidden border border-indigo-950/80 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500 shadow-sm shadow-amber-500/50"
                  style={{ width: `${(bands['Needs work'] / totalProducts) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-indigo-300/60 mt-1 block">Requires rule fixes before publishing</span>
            </div>

            {/* Poor Band */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-semibold">
                <span className="text-rose-300">Poor (0 - 69)</span>
                <span className="text-indigo-200 font-mono">{bands.Poor} products ({Math.round((bands.Poor / totalProducts) * 100 || 0)}%)</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-900/80 overflow-hidden border border-indigo-950/80 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500 shadow-sm shadow-rose-500/50"
                  style={{ width: `${(bands.Poor / totalProducts) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-indigo-300/60 mt-1 block">Blocked from bulk publishing</span>
            </div>
          </div>

          <div className="pt-4 border-t border-indigo-950/80">
            <button
              onClick={() => navigate('/catalog?qualityBand=Poor')}
              className="w-full py-2.5 px-3.5 text-xs font-bold text-indigo-200 hover:text-white bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              Filter Poor Quality Products in Catalog
              <ArrowRight className="w-3.5 h-3.5 text-indigo-300" />
            </button>
          </div>
        </div>

        {/* Violations Grouped by Rule Q01-Q12 */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-indigo-900/40 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="gradient-accent-text font-bold text-lg">Detected Quality Defects</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                Rules Q01 - Q12
              </span>
            </h2>
            <button
              onClick={() => navigate('/catalog')}
              className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 font-semibold hover:underline"
            >
              View in Catalog <ArrowRight className="w-3 h-3 text-indigo-400" />
            </button>
          </div>

          <div className="divide-y divide-indigo-950/60 max-h-96 overflow-y-auto pr-2">
            {violations.map((v: any) => (
              <div key={v.ruleId} className="py-2.5 flex items-center justify-between text-xs hover:bg-indigo-950/30 px-3 rounded-xl transition-colors">
                <div className="flex items-center gap-3.5">
                  <span className="font-mono font-bold text-indigo-300 w-9">{v.ruleId}</span>
                  <div>
                    <div className="text-slate-100 font-semibold">{v.name}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        v.severity === 'Critical'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : v.severity === 'Major'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      }`}>
                        {v.severity}
                      </span>
                      {v.canAiFix ? (
                        <span className="text-indigo-300 font-medium flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" /> Agent can propose fix
                        </span>
                      ) : (
                        <span className="text-slate-400">Requires manual fix</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-xs ${
                    v.count > 0 ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40 glow-primary' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {v.count} issue{v.count === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
