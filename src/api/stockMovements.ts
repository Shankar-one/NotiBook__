import { StockMovement } from '../types';
import { apiRequest } from './apiClient';

export async function fetchStockMovements(): Promise<StockMovement[]> {
  try {
    const res = await apiRequest<{ stockMovements: StockMovement[] }>('/api/stock-movements');
    if (res?.stockMovements) {
      localStorage.setItem('notibook_stock_movements', JSON.stringify(res.stockMovements));
      return res.stockMovements;
    }
  } catch {}
  const saved = localStorage.getItem('notibook_stock_movements');
  return saved ? JSON.parse(saved) : [];
}

export async function recordStockMovementApi(movement: Partial<StockMovement>): Promise<StockMovement> {
  const newMovement: StockMovement = {
    id: `sm-${Date.now()}`,
    productId: movement.productId || '',
    productName: movement.productName || 'Product',
    changeQty: movement.changeQty || 0,
    reason: movement.reason || 'ADJUSTMENT',
    referenceId: movement.referenceId,
    date: new Intl.DateTimeFormat('en-CA').format(new Date()),
    finalQty: movement.finalQty || 0,
  };

  const all = await fetchStockMovements();
  const updated = [newMovement, ...all];
  localStorage.setItem('notibook_stock_movements', JSON.stringify(updated));
  return newMovement;
}
