import { Product, StockMovement } from '../types';
import { apiRequest } from './apiClient';
import { sampleProducts } from '../data/mockData';

export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await apiRequest<{ products: Product[] }>('/api/products');
    if (res?.products && Array.isArray(res.products)) {
      localStorage.setItem('notibook_products', JSON.stringify(res.products));
      return res.products;
    }
  } catch {}
  const saved = localStorage.getItem('notibook_products');
  return saved ? JSON.parse(saved) : sampleProducts;
}

export async function searchProductsApi(query: string): Promise<Product[]> {
  const all = await fetchProducts();
  const q = query.toLowerCase().trim();
  if (!q) return all;
  return all.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.category.toLowerCase().includes(q) || 
    (p.sku && p.sku.toLowerCase().includes(q))
  );
}

export async function createProductApi(product: Partial<Product>): Promise<Product> {
  try {
    const res = await apiRequest<{ product: Product }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
    return res.product;
  } catch {
    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      name: product.name || 'New Item',
      category: product.category || 'General',
      stockQty: product.stockQty || 0,
      lowStockThreshold: product.lowStockThreshold || 10,
      buyPrice: product.buyPrice || 0,
      sellPrice: product.sellPrice || 0,
      unit: product.unit || 'pcs',
      sku: product.sku || `SKU-${Date.now().toString().slice(-4)}`,
    };
    const all = await fetchProducts();
    const updated = [newProduct, ...all];
    localStorage.setItem('notibook_products', JSON.stringify(updated));
    return newProduct;
  }
}

export async function updateProductApi(id: string, updates: Partial<Product>): Promise<Product | null> {
  try {
    const res = await apiRequest<{ product: Product }>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.product;
  } catch {
    const all = await fetchProducts();
    const index = all.findIndex(p => p.id === id);
    if (index === -1) return null;
    all[index] = { ...all[index], ...updates };
    localStorage.setItem('notibook_products', JSON.stringify(all));
    return all[index];
  }
}

export async function adjustStockApi(params: {
  productId?: string;
  productName?: string;
  newQty?: number;
  deltaQty?: number;
  reason: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN';
  referenceId?: string;
}): Promise<{ product: Product; movement: StockMovement }> {
  try {
    const res = await apiRequest<{ product: Product; movement: StockMovement }>('/api/stock/adjust', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res;
  } catch {
    const all = await fetchProducts();
    const target = all.find(p => 
      (params.productId && p.id === params.productId) || 
      (params.productName && p.name.toLowerCase().includes(params.productName.toLowerCase()))
    );

    if (!target) {
      throw new Error(`Product ${params.productName || params.productId} not found`);
    }

    const previousQty = target.stockQty;
    let finalQty = target.stockQty;
    let changeQty = 0;

    if (params.newQty !== undefined) {
      finalQty = params.newQty;
      changeQty = finalQty - previousQty;
    } else if (params.deltaQty !== undefined) {
      finalQty = Math.max(0, previousQty + params.deltaQty);
      changeQty = params.deltaQty;
    }

    target.stockQty = finalQty;
    localStorage.setItem('notibook_products', JSON.stringify(all));

    const movement: StockMovement = {
      id: `sm-${Date.now()}`,
      productId: target.id,
      productName: target.name,
      changeQty,
      reason: params.reason,
      referenceId: params.referenceId,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      finalQty,
    };

    const savedSm = localStorage.getItem('notibook_stock_movements');
    const allSm: StockMovement[] = savedSm ? JSON.parse(savedSm) : [];
    allSm.unshift(movement);
    localStorage.setItem('notibook_stock_movements', JSON.stringify(allSm));

    return { product: target, movement };
  }
}
