import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Catalog } from './pages/Catalog';
import { ProductEditor } from './pages/ProductEditor';
import { AttributeBuilder } from './pages/AttributeBuilder';
import { ReviewQueue } from './pages/ReviewQueue';
import { SyncMonitor } from './pages/SyncMonitor';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="products/:id" element={<ProductEditor />} />
          <Route path="products/new" element={<ProductEditor />} />
          <Route path="attributes" element={<AttributeBuilder />} />
          <Route path="review" element={<ReviewQueue />} />
          <Route path="sync" element={<SyncMonitor />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
