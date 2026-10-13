import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  AlertOctagon,
  CheckCircle2,
  Clock,
  RotateCcw,
  ShieldAlert,
  Flame,
  Bug,
  Activity,
  History
} from 'lucide-react';
import { api } from '../api/client';
import { SyncJob, SyncLog } from '@catalogiq/shared';

export const SyncMonitor: React.FC = () => {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Failure Injection Panel State
  const [failureType, setFailureType] = useState<string>('server_error');
  const [failureCount, setFailureCount] = useState<number>(1);
  const [injectionSuccess, setInjectionSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [jobsData, logsData] = await Promise.all([
        api.getSyncJobs(),
        api.getSyncLogs()
      ]);
      setJobs(jobsData);
      setLogs(logsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll every 3 seconds for live sync job updates
    const timer = setInterval(fetchData, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleRetryJob = async (jobId: string) => {
    setRetryingId(jobId);
    try {
      await api.retrySyncJob(jobId);
      await fetchData();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleInjectFailure = async () => {
    try {
      await api.configureMockFailure({
        failNextRequests: failureCount,
        failureType: failureType,
        customMessage: `Injected test failure: ${failureType} (${failureCount} requests)`
      });
      setInjectionSuccess(`Successfully configured mock WooCommerce to fail next ${failureCount} request(s) with ${failureType}.`);
      setTimeout(() => setInjectionSuccess(null), 5000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClearFailures = async () => {
    try {
      await api.configureMockFailure({
        failNextRequests: 0,
        failureType: 'none'
      });
      setInjectionSuccess('All simulated mock failures cleared.');
      setTimeout(() => setInjectionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-400" />
            Sync Monitor, Recovery & Audit Log
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Database-backed state machine, exponential backoff retries, duplicate prevention, and read-back confirmation.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Failure Injection Simulator Panel (PRD Failure Modes F1-F6 Demo) */}
      <div className="glass-card rounded-xl p-6 border border-amber-500/30 bg-amber-950/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Mock Failure Injection Simulator</h2>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            PRD Failure Mode Testing
          </span>
        </div>

        <p className="text-xs text-slate-300">
          Inject real-time failure responses into the mock WooCommerce server to test the PIM state machine, exponential backoff, duplicate prevention, and error recovery in the demo.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Failure Type</label>
            <select
              value={failureType}
              onChange={e => setFailureType(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none"
            >
              <option value="server_error">HTTP 500 (Server Error / Retryable Backoff)</option>
              <option value="rate_limit">HTTP 429 (Rate Limit Exceeded / Retry-After)</option>
              <option value="timeout">Gateway Timeout (Simulated Lost Response)</option>
              <option value="validation_error">HTTP 400 (Bad Request / Permanent Fail)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Requests to Fail</label>
            <input
              type="number"
              min="1"
              max="5"
              value={failureCount}
              onChange={e => setFailureCount(parseInt(e.target.value, 10) || 1)}
              className="w-20 px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
            />
          </div>

          <div className="flex items-end gap-2 pt-4">
            <button
              onClick={handleInjectFailure}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-sm transition-colors"
            >
              Arm Injected Failure
            </button>
            <button
              onClick={handleClearFailures}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            >
              Clear Failures
            </button>
          </div>
        </div>

        {injectionSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {injectionSuccess}
          </div>
        )}
      </div>

      {/* Sync Jobs Table */}
      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40 space-y-3 p-6">
        <h2 className="text-base font-bold text-white flex items-center justify-between">
          <span>Active & Historical Sync Jobs</span>
          <span className="text-xs text-slate-400">{jobs.length} total jobs</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="py-2.5 px-3">Job ID</th>
                <th className="py-2.5 px-3">Product ID</th>
                <th className="py-2.5 px-3">Operation</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Attempts</th>
                <th className="py-2.5 px-3">Error / Next Retry</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No sync jobs recorded yet. Publish a product from the Catalog or Product Editor.
                  </td>
                </tr>
              ) : (
                jobs.map(j => (
                  <tr key={j.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 text-slate-300 font-bold">{j.id.slice(0, 16)}...</td>
                    <td className="py-3 px-3 text-slate-300">{j.productId}</td>
                    <td className="py-3 px-3 uppercase text-indigo-400">{j.operation}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full capitalize font-sans font-semibold text-[11px] ${
                          j.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : j.status === 'failed'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : j.status === 'retrying'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse'
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{j.attempts} / {j.maxAttempts}</td>
                    <td className="py-3 px-3 font-sans text-slate-400 max-w-xs truncate">
                      {j.error || (j.status === 'completed' ? 'Confirmed by Read-back' : 'Queued')}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {(j.status === 'failed' || j.status === 'retrying') && (
                        <button
                          onClick={() => handleRetryJob(j.id)}
                          disabled={retryingId === j.id}
                          className="px-2.5 py-1 text-[11px] font-sans font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
                        >
                          {retryingId === j.id ? 'Retrying...' : 'Retry Now'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40 space-y-3 p-6">
        <h2 className="text-base font-bold text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            Read-Back Verification & Audit Trail
          </span>
          <span className="text-xs text-slate-400">{logs.length} attempts logged</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Product</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Request Summary</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Response & Read-Back Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.slice(0, 25).map(l => (
                  <tr key={l.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-slate-400">{new Date(l.createdAt).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-3 text-slate-300 font-bold">{l.productId}</td>
                    <td className="py-2.5 px-3 uppercase text-indigo-300">{l.action} (Attempt {l.attempt})</td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">{l.requestSummary}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-bold ${l.isSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {l.responseStatus || (l.isSuccess ? '200 OK' : 'ERR')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-200">
                      <div>{l.responseSummary}</div>
                      {(l.errorCauseCode || l.errorCauseMessage) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                          {l.errorCauseCode && (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-500/25 text-rose-300 border border-rose-500/40 font-mono font-bold">
                              Cause: {l.errorCauseCode}
                            </span>
                          )}
                          {l.errorCauseMessage && (
                            <span className="text-rose-200/90 font-mono">
                              {l.errorCauseMessage}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
