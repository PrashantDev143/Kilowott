import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Eye,
  Edit,
  ArrowUpDown
} from 'lucide-react';
import { api } from '../api/client';
import { Product } from '@catalogiq/shared';

export const Catalog: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [isBulkScanning, setIsBulkScanning] = useState(false);

  // Filters from URL or default
  const search = searchParams.get('search') || '';
  const qualityBand = searchParams.get('qualityBand') || 'all';
  const syncStatus = searchParams.get('syncStatus') || 'all';
  const category = searchParams.get('category') || 'all';

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (qualityBand !== 'all') params.qualityBand = qualityBand;
      if (syncStatus !== 'all') params.syncStatus = syncStatus;
      if (category !== 'all') params.category = category;

      const data = await api.getProducts(params);
      setProducts(data.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, qualityBand, syncStatus, category]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all' || !value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(products.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleBulkPublish = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkPublishing(true);
    try {
      const res = await api.publishBatch(selectedIds);
      alert(res.message);
      fetchProducts();
      setSelectedIds([]);
    } catch (err: any) {
      alert(`Publish error: ${err.message}`);
    } finally {
      setIsBulkPublishing(false);
    }
  };

  const handleBulkAiEnrich = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkScanning(true);
    try {
      await api.runAiScan(selectedIds);
      navigate('/review');
    } catch (err: any) {
      alert(`AI error: ${err.message}`);
    } finally {
      setIsBulkScanning(false);
    }
  };

  const handleQuickPublishSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.publishProduct(id);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span className="gradient-accent-text">Central Product Catalog</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {products.length} Products
            </span>
          </h1>
          <p className="text-sm text-indigo-200/70 mt-1">
            Search, filter, edit, and safely synchronize catalog data with WooCommerce.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/products/new')}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white gradient-brand-btn rounded-xl shadow-lg shadow-indigo-600/30 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Create Product
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-indigo-900/40 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400" />
            <input
              type="text"
              placeholder="Search by title, SKU, or description..."
              value={search}
              onChange={e => updateFilter('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#0e142e]/80 border border-indigo-900/60 rounded-xl text-slate-100 placeholder-indigo-300/40 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-colors"
            />
          </div>

          {/* Quality Band Filter */}
          <select
            value={qualityBand}
            onChange={e => updateFilter('qualityBand', e.target.value)}
            className="w-full md:w-48 px-3.5 py-2.5 text-sm bg-[#0e142e]/80 border border-indigo-900/60 rounded-xl text-indigo-200 focus:outline-none focus:border-indigo-400"
          >
            <option value="all">All Quality Scores</option>
            <option value="Healthy">Healthy (90-100)</option>
            <option value="Needs work">Needs Work (70-89)</option>
            <option value="Poor">Poor (&lt;70)</option>
          </select>

          {/* Sync Status Filter */}
          <select
            value={syncStatus}
            onChange={e => updateFilter('syncStatus', e.target.value)}
            className="w-full md:w-48 px-3.5 py-2.5 text-sm bg-[#0e142e]/80 border border-indigo-900/60 rounded-xl text-indigo-200 focus:outline-none focus:border-indigo-400"
          >
            <option value="all">All Sync States</option>
            <option value="synced">Synced (Live)</option>
            <option value="draft">Draft (Local)</option>
            <option value="pending">Pending Sync</option>
            <option value="syncing">Syncing...</option>
            <option value="failed">Failed Sync</option>
            <option value="conflict">Conflict</option>
          </select>
        </div>

        {/* Selected Items Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between p-2.5 bg-indigo-500/15 border border-indigo-500/30 rounded-xl text-xs animate-fadeIn">
            <span className="font-semibold text-indigo-200">
              {selectedIds.length} product{selectedIds.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkAiEnrich}
                disabled={isBulkScanning}
                className="px-3 py-1.5 font-bold rounded-lg gradient-brand-btn text-white flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                AI Enrich Selected
              </button>
              <button
                onClick={handleBulkPublish}
                disabled={isBulkPublishing}
                className="px-3 py-1.5 font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors shadow-sm shadow-emerald-600/30"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Publish Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Catalog Table */}
      <div className="glass-card rounded-2xl border border-indigo-900/40 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-indigo-950/80 bg-[#121833]/90 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === products.length}
                    onChange={handleSelectAll}
                    className="rounded border-indigo-800 text-indigo-600 focus:ring-0 bg-slate-900"
                  />
                </th>
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4">SKU</th>
                <th className="py-3.5 px-4">Price</th>
                <th className="py-3.5 px-4">Quality Score</th>
                <th className="py-3.5 px-4">Sync State</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-950/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-indigo-300">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading catalog items...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No products matched your criteria.
                  </td>
                </tr>
              ) : (
                products.map(p => {
                  const isSelected = selectedIds.includes(p.id);
                  const firstImage = p.images?.[0]?.url || 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=100';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/products/${p.id}`)}
                      className={`cursor-pointer transition-colors duration-150 hover:bg-indigo-950/35 ${
                        isSelected ? 'bg-indigo-950/45' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(p.id)}
                          className="rounded border-indigo-800 text-indigo-600 focus:ring-0 bg-slate-900"
                        />
                      </td>

                      {/* Title & Image */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3.5">
                          <img
                            src={firstImage}
                            alt={p.name}
                            className="w-11 h-11 object-cover rounded-xl border border-indigo-900/60 shrink-0 bg-slate-900 shadow-sm"
                          />
                          <div>
                            <div className="font-bold text-white hover:text-indigo-300 transition-colors">
                              {p.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {p.categories.map(cat => (
                                <span
                                  key={cat}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-indigo-200">
                        {p.sku || <span className="text-rose-400 italic font-sans">Missing SKU</span>}
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 font-bold font-mono text-sm text-emerald-400">
                        ${p.price.toFixed(2)}
                      </td>

                      {/* Quality Score */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold font-mono shadow-sm ${
                              p.qualityScore >= 90
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 glow-emerald'
                                : p.qualityScore >= 70
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 glow-amber'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {p.qualityScore} / 100
                          </span>
                        </div>
                      </td>

                      {/* Sync State Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize shadow-sm ${
                            p.syncStatus === 'synced'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-emerald-500/10'
                              : p.syncStatus === 'failed'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : p.syncStatus === 'conflict'
                              ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40 glow-violet'
                              : p.syncStatus === 'pending' || p.syncStatus === 'syncing'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse'
                              : 'bg-sky-500/20 text-sky-300 border border-sky-500/35'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              p.syncStatus === 'synced'
                                ? 'bg-emerald-400 glow-emerald'
                                : p.syncStatus === 'failed'
                                ? 'bg-rose-400'
                                : p.syncStatus === 'conflict'
                                ? 'bg-purple-400 glow-violet'
                                : p.syncStatus === 'pending' || p.syncStatus === 'syncing'
                                ? 'bg-blue-400'
                                : 'bg-sky-400'
                            }`}
                          />
                          {p.syncStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/products/${p.id}`)}
                            className="p-2 rounded-xl text-indigo-300 hover:text-white hover:bg-indigo-600/30 border border-transparent hover:border-indigo-500/40 transition-all duration-150"
                            title="Edit Product"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={e => handleQuickPublishSingle(p.id, e)}
                            className="p-2 rounded-xl text-emerald-400 hover:text-emerald-200 hover:bg-emerald-500/20 border border-transparent hover:border-emerald-500/40 transition-all duration-150"
                            title="Publish to WooCommerce"
                          >
                            <UploadCloud className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
