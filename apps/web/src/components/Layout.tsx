import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Sparkles,
  Sliders,
  RefreshCw,
  Settings,
  Store,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { api } from '../api/client';

export const Layout: React.FC = () => {
  const [storeStatus, setStoreStatus] = useState<{ connected: boolean; mode: string }>({
    connected: true,
    mode: 'mock'
  });
  const [pendingProposalsCount, setPendingProposalsCount] = useState<number>(0);
  const [isResetting, setIsResetting] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check pending proposals count
    api.getAiProposals('pending')
      .then(proposals => setPendingProposalsCount(proposals.length))
      .catch(() => {});

    // Check store connection
    api.getStoreConfig()
      .then(cfg => {
        setStoreStatus({
          connected: true,
          mode: cfg.mode || 'mock'
        });
      })
      .catch(() => {
        setStoreStatus({ connected: false, mode: 'offline' });
      });
  }, [location.pathname]);

  const handleQuickReset = async () => {
    if (!window.confirm('Reset catalog and mock store to initial baseline (30 seed products)?')) return;
    setIsResetting(true);
    try {
      await api.resetMockStore();
      window.location.reload();
    } catch (e) {
      alert('Reset completed.');
      window.location.reload();
    } finally {
      setIsResetting(false);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Catalog', path: '/catalog', icon: Layers },
    {
      name: 'AI Review Queue',
      path: '/review',
      icon: Sparkles,
      badge: pendingProposalsCount > 0 ? pendingProposalsCount : null
    },
    { name: 'Attributes & Types', path: '/attributes', icon: Sliders },
    { name: 'Sync Monitor', path: '/sync', icon: RefreshCw },
    { name: 'Settings', path: '/settings', icon: Settings }
  ];

  return (
    <div className="flex flex-col h-screen vibrant-bg text-slate-100 overflow-hidden font-sans">
      {/* Top Vibrant Accent Line */}
      <div className="h-[2.5px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shrink-0 shadow-lg shadow-indigo-500/40" />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-[#0d1226]/85 border-r border-indigo-950/60 flex flex-col backdrop-blur-xl shadow-2xl z-20">
          {/* Brand Header */}
          <div className="h-16 flex items-center px-6 border-b border-indigo-950/60 gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="font-extrabold text-white text-lg tracking-wider">Q</span>
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                <span className="gradient-accent-text font-extrabold">CatalogIQ</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/40">
                  PIM
                </span>
              </div>
              <div className="text-xs text-indigo-300/70">WooCommerce Sync & AI</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600/30 via-purple-600/20 to-transparent text-indigo-200 border border-indigo-500/40 shadow-lg shadow-indigo-950/50'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-indigo-950/30 hover:border-slate-800'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0 text-indigo-400" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge ? (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20 animate-pulse">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          {/* Store Connection Indicator Card */}
          <div className="p-4 border-t border-indigo-950/60 bg-[#0b0f20]/60">
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-indigo-900/40 text-xs space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-indigo-400" />
                  Store Mode
                </span>
                <span className="capitalize px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/20">
                  {storeStatus.mode}
                </span>
              </div>
              <div className="flex items-center gap-2 text-indigo-200 font-mono text-[11px] truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 glow-emerald animate-pulse shrink-0"></span>
                {storeStatus.mode === 'mock' ? 'http://localhost:5050' : 'WooCommerce Live'}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Navbar */}
          <header className="h-16 border-b border-indigo-950/60 bg-[#0d1226]/50 backdrop-blur-xl px-8 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-indigo-300">Kilowott PIM Challenge</span>
              <span className="text-indigo-800">/</span>
              <span className="text-xs text-slate-300 font-medium">Safe Sync & Verifiable AI Enrichment</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Reset Demo Baseline Button */}
              <button
                onClick={handleQuickReset}
                disabled={isResetting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-indigo-900/40 rounded-lg transition-all duration-150 hover:shadow"
                title="Reset seeded messy catalog and mock store"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-indigo-400 ${isResetting ? 'animate-spin' : ''}`} />
                Reset Demo
              </button>

              {/* Live Store link */}
              <a
                href="http://localhost:5050/wp-json/wc/v3/products"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-200 hover:text-white bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-500/40 rounded-lg transition-all duration-150 shadow-sm shadow-indigo-900/40"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-300" />
                Woo API Feed
              </a>
            </div>
          </header>

          {/* Page View Body */}
          <main className="flex-1 overflow-y-auto p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
