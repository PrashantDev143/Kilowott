import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  UploadCloud,
  ArrowLeft,
  History,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Plus,
  RefreshCw,
  ExternalLink,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api/client';
import { Product, ProductVersion, QualityScoreResult, AttributeDefinition, ProductType } from '@catalogiq/shared';

export const ProductEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [product, setProduct] = useState<Partial<Product>>({
    name: '',
    sku: '',
    price: 0,
    description: '',
    shortDescription: '',
    categories: ['Apparel'],
    status: 'draft',
    syncStatus: 'draft',
    attributes: {},
    images: [],
    variants: []
  });

  const [quality, setQuality] = useState<QualityScoreResult | null>(null);
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [attributesList, setAttributesList] = useState<AttributeDefinition[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    // Load metadata
    api.getAttributes().then(data => {
      setAttributesList(data.attributes || []);
      setProductTypes(data.productTypes || []);
    });

    if (!isNew && id) {
      loadProductData(id);
    } else {
      setLoading(false);
    }
  }, [id, isNew]);

  const loadProductData = async (productId: string) => {
    setLoading(true);
    try {
      const data = await api.getProduct(productId);
      setProduct(data.product);
      setQuality(data.quality);

      const vData = await api.getProductVersions(productId);
      setVersions(vData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof Product, value: any) => {
    setProduct(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAttributeChange = (key: string, value: string) => {
    setProduct(prev => ({
      ...prev,
      attributes: {
        ...(prev.attributes || {}),
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const created = await api.createProduct(product);
        navigate(`/products/${created.id}`);
      } else if (id) {
        const res = await api.updateProduct(id, product);
        setProduct(res.product);
        setQuality(res.quality);
        const vData = await api.getProductVersions(id);
        setVersions(vData);
        alert('Product saved successfully.');
      }
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id || isNew) return;
    setPublishing(true);
    try {
      await api.publishProduct(id);
      await loadProductData(id);
      setShowPreviewModal(false);
      alert('Product publish job queued. Verification in progress.');
    } catch (err: any) {
      alert(`Publish error: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!id) return;
    if (!window.confirm(`Restore to Version #${versionNumber}? Current edits will become a new version.`)) return;

    try {
      await api.restoreProductVersion(id, versionNumber);
      await loadProductData(id);
      alert(`Restored to Version #${versionNumber}`);
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-500" />
        Loading product editor...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Navigation & Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/catalog')}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {isNew ? 'Create New Product' : product.name || 'Untitled Product'}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-mono">
              <span>SKU: {product.sku || 'N/A'}</span>
              <span>•</span>
              <span>Version: v{product.currentVersion || 1}</span>
              {product.wooId ? (
                <>
                  <span>•</span>
                  <span className="text-emerald-400">WooCommerce ID #{product.wooId}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          {!isNew && (
            <button
              onClick={() => setShowPreviewModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
              Publish to Store
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Form Inputs (2 Columns) & Live Quality Sidebar (1 Column) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Product Fields & Attributes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Core Info */}
          <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white">General Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Product Title *
                </label>
                <input
                  type="text"
                  value={product.name || ''}
                  onChange={e => handleFieldChange('name', e.target.value)}
                  placeholder="e.g. Classic Oxford Button-Down Shirt"
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    SKU Identifier *
                  </label>
                  <input
                    type="text"
                    value={product.sku || ''}
                    onChange={e => handleFieldChange('sku', e.target.value)}
                    placeholder="e.g. SHIRT-OXF-001"
                    className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Price (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={product.price || ''}
                    onChange={e => handleFieldChange('price', parseFloat(e.target.value) || 0)}
                    placeholder="49.99"
                    className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Description (Min 80 chars for full quality score)
                </label>
                <textarea
                  rows={4}
                  value={product.description || ''}
                  onChange={e => handleFieldChange('description', e.target.value)}
                  placeholder="Detailed description of product materials, construction, and fit..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <div className="text-[11px] text-slate-400 text-right mt-1">
                  {(product.description || '').length} characters
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Short Description
                </label>
                <input
                  type="text"
                  value={product.shortDescription || ''}
                  onChange={e => handleFieldChange('shortDescription', e.target.value)}
                  placeholder="Summary text used in store catalog listings..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Product Type & Attributes */}
          <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Product Type & Attributes</h2>
              <span className="text-xs text-indigo-400">PRD Attribute Handling</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Assigned Product Type
              </label>
              <select
                value={product.productTypeId || ''}
                onChange={e => handleFieldChange('productTypeId', e.target.value || null)}
                className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">None / Custom</option>
                {productTypes.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Structured Attributes Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {attributesList.map(attr => {
                const currentVal = product.attributes?.[attr.slug] || '';
                return (
                  <div key={attr.id}>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      {attr.name} {attr.isRequired ? '*' : ''}
                    </label>
                    {attr.allowedValues && attr.allowedValues.length > 0 ? (
                      <select
                        value={currentVal}
                        onChange={e => handleAttributeChange(attr.slug, e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Not specified</option>
                        {attr.allowedValues.map(v => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={currentVal}
                        onChange={e => handleAttributeChange(attr.slug, e.target.value)}
                        placeholder={`Enter ${attr.name.toLowerCase()}...`}
                        className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Quality Engine Inspector & Version History */}
        <div className="space-y-6">
          {/* Quality Engine Inspector Panel */}
          <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Quality Inspector</span>
              </h2>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                  (quality?.score || 100) >= 90
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : (quality?.score || 100) >= 70
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {quality?.score || 100} / 100
              </span>
            </div>

            <div className="text-xs text-slate-400">
              Evaluated against Rules Q01–Q12. Deductions are listed below:
            </div>

            {quality?.violations && quality.violations.length > 0 ? (
              <div className="space-y-2.5 pt-2">
                {quality.violations.map(v => (
                  <div
                    key={v.ruleId}
                    className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-300">{v.ruleId}</span>
                      <span className="font-semibold text-rose-400 font-mono">-{v.deduction} pts</span>
                    </div>
                    <div className="text-slate-300 font-medium">{v.message}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span>Field: {v.field}</span>
                      <span>•</span>
                      <span className="text-amber-400">{v.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Zero quality violations detected! Product is in Healthy band (Ready to publish).</span>
              </div>
            )}
          </div>

          {/* Version History & Rollback */}
          {!isNew && (
            <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <span>Version History</span>
                </h2>
                <span className="text-xs text-slate-400">{versions.length} versions</span>
              </div>

              <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto pr-1">
                {versions.map(v => (
                  <div key={v.id} className="py-2.5 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">
                        Version #{v.versionNumber}
                        {v.versionNumber === product.currentVersion && (
                          <span className="ml-1.5 text-[10px] text-indigo-400 bg-indigo-500/10 px-1 rounded">Current</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{v.changeSummary}</div>
                      <div className="text-[10px] text-slate-500">{new Date(v.createdAt).toLocaleTimeString()}</div>
                    </div>

                    {v.versionNumber !== product.currentVersion && (
                      <button
                        onClick={() => handleRestoreVersion(v.versionNumber)}
                        className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                        title="Restore this version"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Preview Modal (PRD Feature F12) */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl rounded-xl p-6 border border-slate-700 bg-slate-900 space-y-5 animate-scaleUp">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-emerald-400" />
              Publish Change Preview
            </h3>

            <p className="text-xs text-slate-400">
              Confirm before synchronizing to WooCommerce. The sync worker will update the remote product and perform an immediate read-back verification.
            </p>

            <div className="space-y-3 bg-slate-950/60 p-4 rounded-lg border border-slate-800 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Target Store:</span>
                <span className="text-slate-200">http://localhost:5050</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Title:</span>
                <span className="text-slate-200">{product.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">SKU:</span>
                <span className="text-slate-200">{product.sku}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Price:</span>
                <span className="text-emerald-400">${product.price?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Attributes:</span>
                <span className="text-slate-200">{JSON.stringify(product.attributes)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm"
              >
                {publishing ? 'Queueing Sync...' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
