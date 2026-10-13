import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api/client';
import { AttributeDefinition, ProductType } from '@catalogiq/shared';

export const AttributeBuilder: React.FC = () => {
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);

  // New Attribute Form State
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrSlug, setNewAttrSlug] = useState('');
  const [newAttrValues, setNewAttrValues] = useState('');
  const [newAttrRequired, setNewAttrRequired] = useState(false);

  // New Type Form State
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeSlug, setNewTypeSlug] = useState('');
  const [selectedAttrIds, setSelectedAttrIds] = useState<string[]>([]);

  // Variation Matrix Generator Interactive Demo
  const [demoSku, setDemoSku] = useState('SHOE-VAR-001');
  const [demoPrice, setDemoPrice] = useState(99.0);
  const [generatedMatrix, setGeneratedMatrix] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.getAttributes();
      setAttributes(data.attributes || []);
      setProductTypes(data.productTypes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttrName || !newAttrSlug) return;

    try {
      const values = newAttrValues
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);

      await api.createAttribute({
        name: newAttrName,
        slug: newAttrSlug.toLowerCase().replace(/\s+/g, '-'),
        type: 'select',
        allowedValues: values,
        isRequired: newAttrRequired
      });

      setNewAttrName('');
      setNewAttrSlug('');
      setNewAttrValues('');
      setNewAttrRequired(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteAttribute = async (id: string) => {
    if (!window.confirm('Delete this attribute definition?')) return;
    try {
      await api.deleteAttribute(id);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateProductType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName || !newTypeSlug) return;

    try {
      await api.createProductType({
        name: newTypeName,
        slug: newTypeSlug.toLowerCase().replace(/\s+/g, '-'),
        attributeIds: selectedAttrIds
      });

      setNewTypeName('');
      setNewTypeSlug('');
      setSelectedAttrIds([]);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGenerateVariationsDemo = async () => {
    try {
      const options = [
        { slug: 'size', name: 'Size', values: ['7', '8', '9', '10'] },
        { slug: 'color', name: 'Color', values: ['Black', 'White'] }
      ];

      const res = await api.generateVariations({
        productId: 'demo-shoe',
        baseSku: demoSku,
        basePrice: demoPrice,
        options
      });

      setGeneratedMatrix(res.variations || []);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-500" />
        Loading attributes & product types...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Sliders className="w-6 h-6 text-indigo-400" />
          Attribute Handling & Variation Matrix Builder
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Define global attributes (materials, sizes, colors), assign them to product types, and generate WooCommerce variation combinations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section 1: Attribute Definitions */}
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center justify-between">
              <span>Attribute Definitions</span>
              <span className="text-xs text-slate-400">{attributes.length} defined</span>
            </h2>

            {/* List */}
            <div className="divide-y divide-slate-800/80">
              {attributes.map(attr => (
                <div key={attr.id} className="py-3 flex items-start justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      {attr.name}
                      <span className="font-mono text-[11px] text-slate-400">({attr.slug})</span>
                      {attr.isRequired && (
                        <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1 rounded">Required</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Allowed Values: {attr.allowedValues.join(', ') || 'Any text'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteAttribute(attr.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Create Attribute Form */}
            <form onSubmit={handleCreateAttribute} className="pt-4 border-t border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">Add New Attribute</span>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Name (e.g. Fit)"
                  value={newAttrName}
                  onChange={e => {
                    setNewAttrName(e.target.value);
                    if (!newAttrSlug) setNewAttrSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100"
                />
                <input
                  type="text"
                  placeholder="Slug (e.g. fit)"
                  value={newAttrSlug}
                  onChange={e => setNewAttrSlug(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 font-mono"
                />
              </div>

              <input
                type="text"
                placeholder="Comma separated allowed values (e.g. Slim, Regular, Relaxed)"
                value={newAttrValues}
                onChange={e => setNewAttrValues(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100"
              />

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAttrRequired}
                    onChange={e => setNewAttrRequired(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 bg-slate-900"
                  />
                  Mark as Required for Quality Checks (Rule Q10)
                </label>

                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
                >
                  Create Attribute
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Section 2: Product Types */}
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center justify-between">
              <span>Product Types</span>
              <span className="text-xs text-slate-400">{productTypes.length} configured</span>
            </h2>

            <div className="divide-y divide-slate-800/80">
              {productTypes.map(t => (
                <div key={t.id} className="py-3 text-xs space-y-1">
                  <div className="font-semibold text-slate-200">{t.name} ({t.slug})</div>
                  <div className="text-[11px] text-slate-400 flex flex-wrap gap-1">
                    Attributes:
                    {t.attributeIds.map(aId => {
                      const a = attributes.find(x => x.id === aId);
                      return (
                        <span key={aId} className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">
                          {a ? a.name : aId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Create Type Form */}
            <form onSubmit={handleCreateProductType} className="pt-4 border-t border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">Add New Product Type</span>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Type Name (e.g. Footwear)"
                  value={newTypeName}
                  onChange={e => {
                    setNewTypeName(e.target.value);
                    if (!newTypeSlug) setNewTypeSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100"
                />
                <input
                  type="text"
                  placeholder="Slug (e.g. footwear)"
                  value={newTypeSlug}
                  onChange={e => setNewTypeSlug(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400">Select Included Attributes:</span>
                <div className="flex flex-wrap gap-2">
                  {attributes.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        setSelectedAttrIds(prev =>
                          prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                        )
                      }
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        selectedAttrIds.includes(a.id)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
                >
                  Create Product Type
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Section 3: Interactive Cartesian Variation Generator Demonstration (PRD Exit Check) */}
      <div className="glass-card rounded-xl p-6 border border-slate-800 bg-slate-900/60 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Cartesian Variation Matrix Generator Demo
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Demonstrates PRD brief: A shoe with sizes 7 to 10 and 2 colors publishes with complete variations (8 total).
            </p>
          </div>

          <button
            onClick={handleGenerateVariationsDemo}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg shadow-sm"
          >
            Generate Variation Matrix
          </button>
        </div>

        {generatedMatrix.length > 0 && (
          <div className="overflow-x-auto pt-3 border-t border-slate-800">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-2 px-3">Generated Variant SKU</th>
                  <th className="py-2 px-3">Size</th>
                  <th className="py-2 px-3">Color</th>
                  <th className="py-2 px-3">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {generatedMatrix.map(v => (
                  <tr key={v.id} className="hover:bg-slate-800/30">
                    <td className="py-2 px-3 text-slate-200">{v.sku}</td>
                    <td className="py-2 px-3 text-indigo-300">{v.attributes.size}</td>
                    <td className="py-2 px-3 text-emerald-300">{v.attributes.color}</td>
                    <td className="py-2 px-3 text-slate-300">${v.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
