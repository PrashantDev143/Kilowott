import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Store,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  DownloadCloud,
  RefreshCw
} from 'lucide-react';
import { api } from '../api/client';

export const Settings: React.FC = () => {
  const [storeUrl, setStoreUrl] = useState('http://localhost:5050');
  const [consumerKey, setConsumerKey] = useState('ck_mock_catalogiq_key');
  const [consumerSecret, setConsumerSecret] = useState('cs_mock_catalogiq_secret');
  const [mode, setMode] = useState('mock');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.getStoreConfig()
      .then(cfg => {
        if (cfg.storeUrl) setStoreUrl(cfg.storeUrl);
        if (cfg.mode) setMode(cfg.mode);
      })
      .catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testStoreConnection({ storeUrl, consumerKey, consumerSecret });
      setTestResult({
        success: true,
        message: `Connected successfully! WooCommerce ${res.details?.version || 'v3 REST'}`
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveStoreConfig({ storeUrl, consumerKey, consumerSecret, mode });
      alert('Store credentials saved securely on the backend.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.importFromStore();
      setImportResult(res.message);
    } catch (err: any) {
      setImportResult(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleResetCatalog = async () => {
    if (!window.confirm('Reset catalog to the 30 seeded products with planted defect scenarios?')) return;
    setResetting(true);
    try {
      await api.resetMockStore();
      alert('Catalog and mock store successfully reset.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-400" />
          Store Connection & Environment Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure WooCommerce credentials (encrypted backend storage), test connection, and manage demo resets.
        </p>
      </div>

      {/* WooCommerce Connection Form */}
      <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">WooCommerce Connection</h2>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            PRD Feature F1 & US1
          </span>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Store Mode
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="mock"
                  checked={mode === 'mock'}
                  onChange={e => {
                    setMode(e.target.value);
                    setStoreUrl('http://localhost:5050');
                  }}
                  className="text-indigo-600 bg-slate-900 border-slate-700"
                />
                In-Process Mock WooCommerce Server (Zero-setup for Reviewers)
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="live"
                  checked={mode === 'live'}
                  onChange={e => setMode(e.target.value)}
                  className="text-indigo-600 bg-slate-900 border-slate-700"
                />
                Live WooCommerce Store (HTTPS)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              WooCommerce Store URL
            </label>
            <input
              type="url"
              value={storeUrl}
              onChange={e => setStoreUrl(e.target.value)}
              placeholder="https://your-store.com"
              className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Consumer Key (ck_...)
              </label>
              <input
                type="text"
                value={consumerKey}
                onChange={e => setConsumerKey(e.target.value)}
                placeholder="ck_xxxxxxxxxxxx"
                className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Consumer Secret (cs_...)
              </label>
              <input
                type="password"
                value={consumerSecret}
                onChange={e => setConsumerSecret(e.target.value)}
                placeholder="cs_xxxxxxxxxxxx"
                className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between pt-3 gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <DownloadCloud className={`w-4 h-4 ${importing ? 'animate-spin' : ''}`} />
                {importing ? 'Importing...' : 'Import from Store (US2)'}
              </button>
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Save Credentials
            </button>
          </div>
        </form>

        {testResult && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
            }`}
          >
            {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {testResult.message}
          </div>
        )}

        {importResult && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {importResult}
          </div>
        )}
      </div>

      {/* AI Provider Status Card */}
      <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">AI Provider Strategy</h2>
        </div>

        <p className="text-xs text-slate-300">
          Swappable AI provider interface (PRD Pattern: Strategy). When <code className="font-mono text-indigo-300">GEMINI_API_KEY</code> is set, queries the Gemini API. Otherwise, falls back gracefully to the deterministic Offline Rule-Based Provider, ensuring the demo always functions without quota failures.
        </p>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Active Provider:</span>
          <span className="text-emerald-400 font-bold">OfflineRuleBasedProvider / Gemini Swappable</span>
        </div>
      </div>

      {/* Reset Baseline Section */}
      <div className="glass-card rounded-xl p-6 border border-rose-500/20 bg-rose-950/5 space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-rose-400" />
          Reset Demo to Seed Baseline
        </h2>
        <p className="text-xs text-slate-400">
          Restores the catalog to the 30 seeded products with 22 planted defect scenarios (missing descriptions, inconsistent attributes, duplicate SKUs, missing images). Useful for running rehearsed demo presentations.
        </p>
        <button
          onClick={handleResetCatalog}
          disabled={resetting}
          className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm transition-colors"
        >
          {resetting ? 'Resetting...' : 'Reset Catalog to Seed Baseline'}
        </button>
      </div>
    </div>
  );
};
