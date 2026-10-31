import React, { useState } from 'react';
import { PackagePlus, Tag, Layers, Info, Database, AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { DEMO_PRODUCTS } from '../data/demoData';
import { useProducts } from '../services/api';

export const ProductsPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [useDemoFallback, setUseDemoFallback] = useState(false);

  const { products: apiProducts, isLoading, error, refetch } = useProducts();

  // Use live database products if available; otherwise use demo fallback if requested or if DB is offline
  const activeProductsList = apiProducts && !useDemoFallback ? apiProducts : DEMO_PRODUCTS;
  const isLive = Boolean(apiProducts && !useDemoFallback);

  const filteredProducts = selectedType === 'all'
    ? activeProductsList
    : activeProductsList.filter((p) => p.type === selectedType);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Variants Catalog"
        description="Configure software licenses, add-ons, and dynamic product variants with specific price adjustments."
        isDemo={!isLive}
        breadcrumbs={['Home', 'Products']}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={refetch}
              title="Refresh from MySQL API"
            >
              Sync DB
            </Button>
            <Button
              variant="primary"
              icon={<PackagePlus className="w-4 h-4" />}
              onClick={() => alert('Product creation modal will be implemented in Phase 4.')}
            >
              Add Product
            </Button>
          </div>
        }
      />

      {/* Database Connection Notice / Error State */}
      {error && !useDemoFallback && (
        <ErrorAlert
          title="Server Database Unreachable"
          message={`${error} (Falling back to preview demo data. To connect real data, start local MySQL and run 'npm run db:migrate -- --seed')`}
          onRetry={refetch}
          className="mb-4"
        />
      )}

      {/* DataSource indicator & Filter controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-2">
          {['all', 'software', 'service', 'addon'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                selectedType === type
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {type === 'all' ? 'All Products' : `${type}s`}
            </button>
          ))}
        </div>

        {/* Data Source Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Data Source:</span>
          {isLive ? (
            <Badge variant="success" size="sm" className="gap-1 items-center">
              <Database className="w-3 h-3 text-emerald-600" />
              Live MySQL DB ({apiProducts?.length} records)
            </Badge>
          ) : (
            <Badge variant="warning" size="sm" className="gap-1 items-center">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              Demo Data Preview
            </Badge>
          )}

          {apiProducts && (
            <button
              onClick={() => setUseDemoFallback(!useDemoFallback)}
              className="text-[11px] text-indigo-600 hover:underline ml-1"
            >
              {useDemoFallback ? 'Switch to Live DB' : 'View Demo'}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Querying products from MySQL database via Netlify Functions..." />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="No products found"
          description="There are no active products in this category. You can seed demo data into your database by running 'npm run db:seed'."
          actionLabel="Seed Demo Data"
          onAction={() => alert("Run 'npm run db:seed' in your terminal")}
        />
      ) : (
        /* Products Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {product.type}
                  </span>
                  <Badge variant={product.isActive ? 'success' : 'neutral'} size="sm">
                    {product.isActive ? 'Active' : 'Archived'}
                  </Badge>
                </div>

                <h3 className="text-base font-bold text-slate-900">{product.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.notes}</p>

                {/* Pricing breakdown */}
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Sales Price</span>
                    <span className="text-base font-bold text-slate-900">
                      ${Number(product.salesPrice).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block font-medium">Cost Price</span>
                    <span className="text-xs font-medium text-slate-600">
                      ${Number(product.costPrice).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Variants Section */}
                {product.variants && product.variants.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Configured Variants ({product.variants.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {product.variants.map((variant) => (
                        <div
                          key={variant.id}
                          className="text-xs flex items-center justify-between p-2 rounded bg-indigo-50/50 border border-indigo-100/60"
                        >
                          <span className="text-slate-800 font-medium">
                            {variant.attributeName}: <strong className="text-indigo-900">{variant.attributeValue}</strong>
                          </span>
                          <span className="font-semibold text-indigo-700">
                            {Number(variant.priceAdjustment) > 0 ? `+$${Number(variant.priceAdjustment).toFixed(2)}` : 'Standard'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">ID: PROD-{product.id}</span>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Tag className="w-3.5 h-3.5" />}
                  onClick={() => alert(`Edit Product ${product.name} (Phase 4)`)}
                >
                  Configure
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
        <Info className="w-4 h-4 text-slate-500 shrink-0" />
        <span>
          <strong>Variant Rule Engine:</strong> When an Odoo brand variant is selected in a quotation or subscription line, the <code>+$560.00</code> price adjustment is automatically calculated into the recurring line total.
        </span>
      </div>
    </div>
  );
};
