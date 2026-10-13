import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  AlertTriangle,
  Quote,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api/client';
import { AIProposal } from '@catalogiq/shared';

export const ReviewQueue: React.FC = () => {
  const [proposals, setProposals] = useState<AIProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const data = await api.getAiProposals(statusFilter);
      setProposals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [statusFilter]);

  const handleApprove = async (id: string) => {
    setActionInProgress(id);
    try {
      await api.approveProposal(id);
      fetchProposals();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionInProgress(id);
    try {
      await api.rejectProposal(id);
      fetchProposals();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleBulkApprove = async () => {
    const pendingIds = proposals.filter(p => p.status === 'pending').map(p => p.id);
    if (pendingIds.length === 0) return;
    if (!window.confirm(`Approve all ${pendingIds.length} pending AI proposals?`)) return;

    setLoading(true);
    try {
      await api.bulkApproveProposals(pendingIds);
      fetchProposals();
    } catch (err: any) {
      alert(`Bulk approval error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            AI Enrichment Review Queue
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Human-in-the-loop verification. Proposed attributes strictly require verbatim evidence quotes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {statusFilter === 'pending' && proposals.length > 0 && (
            <button
              onClick={handleBulkApprove}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Approve All Pending ({proposals.length})
            </button>
          )}

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none"
          >
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All Proposals</option>
          </select>
        </div>
      </div>

      {/* Proposals List */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-500" />
          Loading proposals queue...
        </div>
      ) : proposals.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center border border-slate-800 space-y-3">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">No Proposals Pending Review</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All AI-proposed attributes and enriched descriptions have been reviewed, or run an enrichment pass from the dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {proposals.map(proposal => {
            const hasUncertain = proposal.evidences.some(e => e.isUncertain);

            return (
              <div
                key={proposal.id}
                className="glass-card rounded-xl p-6 border border-slate-800 bg-slate-900/60 space-y-5"
              >
                {/* Proposal Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{proposal.productName}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-1">
                      <span>Product ID: {proposal.productId}</span>
                      <span>•</span>
                      <span>Confidence: {Math.round(proposal.overallConfidence * 100)}%</span>
                      {hasUncertain && (
                        <span className="text-amber-400 flex items-center gap-1 font-sans">
                          <AlertTriangle className="w-3.5 h-3.5" /> Contains Uncertain Field
                        </span>
                      )}
                    </div>
                  </div>

                  {proposal.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReject(proposal.id)}
                        disabled={actionInProgress === proposal.id}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5 text-rose-400" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(proposal.id)}
                        disabled={actionInProgress === proposal.id}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve & Apply
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`px-2.5 py-1 text-xs font-bold rounded-full capitalize ${
                        proposal.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {proposal.status}
                    </span>
                  )}
                </div>

                {/* Side-by-side Diffs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Original State */}
                  <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Current Store Data
                    </span>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-400">Description:</div>
                      <div className="text-xs text-slate-300 mt-1 italic">
                        {proposal.originalDescription || (
                          <span className="text-slate-500">None (Completely missing)</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-400">Attributes:</div>
                      <div className="text-xs text-slate-300 mt-1 font-mono">
                        {Object.keys(proposal.originalAttributes).length > 0 ? (
                          JSON.stringify(proposal.originalAttributes)
                        ) : (
                          <span className="text-slate-500 italic font-sans">No structured attributes</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AI Proposed State */}
                  <div className="p-4 rounded-lg bg-indigo-950/20 border border-indigo-500/30 space-y-3">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
                      Proposed Enriched Data
                    </span>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-300">Proposed Description:</div>
                      <div className="text-xs text-slate-200 mt-1">
                        {proposal.proposedDescription}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-300">Proposed Attributes:</div>
                      <div className="text-xs text-emerald-400 mt-1 font-mono">
                        {JSON.stringify(proposal.proposedAttributes)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verified Evidence Quotes Section */}
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Evidence Citations (Strict PRD Guardrails)
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {proposal.evidences.map((ev, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                          ev.isUncertain
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                            : 'bg-slate-900 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
                            {ev.field} → {ev.proposedValue}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {Math.round(ev.confidence * 100)}% conf
                          </span>
                        </div>

                        {ev.evidenceQuote ? (
                          <div className="flex items-start gap-1.5 text-xs text-indigo-300 bg-slate-950/40 p-2 rounded border border-indigo-500/20 font-mono">
                            <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>"{ev.evidenceQuote}"</span>
                          </div>
                        ) : null}

                        <div className="text-[11px] text-slate-400">
                          {ev.reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
