import { CatalogueImportProduct, Product } from '../types';

/**
 * Normalizes product name for fuzzy comparison (e.g., "Pepsi 500ml" vs "pepsi 500 ml")
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[₹$,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches an extracted item against existing catalogue products
 */
export function matchProductWithCatalogue(
  extracted: { name: string; sellingPrice: number; stockQty: number; sku?: string; category?: string; unit?: string },
  existingProducts: Product[]
): CatalogueImportProduct {
  const normExtracted = normalizeProductName(extracted.name);
  
  // 1. Match by SKU if present
  let existing = extracted.sku 
    ? existingProducts.find(p => p.sku && p.sku.toLowerCase() === extracted.sku!.toLowerCase()) 
    : undefined;

  // 2. Match by exact normalized name
  if (!existing) {
    existing = existingProducts.find(p => normalizeProductName(p.name) === normExtracted);
  }

  // 3. Match by partial containment if distinct (e.g., "Pepsi 500ml" and "Pepsi")
  if (!existing) {
    existing = existingProducts.find(p => {
      const pNorm = normalizeProductName(p.name);
      return (pNorm.length > 3 && normExtracted.includes(pNorm)) || (normExtracted.length > 3 && pNorm.includes(normExtracted));
    });
  }

  const isExisting = Boolean(existing);
  const priceChanged = isExisting ? existing!.sellPrice !== extracted.sellingPrice : false;
  const stockChanged = isExisting ? existing!.stockQty !== extracted.stockQty : false;

  let validationError: string | undefined;
  if (!extracted.name || extracted.name.trim().length === 0) {
    validationError = 'Product name is required';
  } else if (isNaN(extracted.sellingPrice) || extracted.sellingPrice <= 0) {
    validationError = 'Valid selling price is required';
  } else if (isNaN(extracted.stockQty) || extracted.stockQty < 0) {
    validationError = 'Valid stock quantity is required';
  }

  return {
    id: isExisting ? existing!.id : undefined,
    name: extracted.name.trim(),
    sellingPrice: Number(extracted.sellingPrice) || 0,
    stockQty: Number(extracted.stockQty) || 0,
    category: extracted.category || (isExisting ? existing!.category : 'General'),
    unit: extracted.unit || (isExisting ? existing!.unit : 'pcs'),
    sku: extracted.sku || (isExisting ? existing!.sku : undefined),
    buyPrice: isExisting ? existing!.buyPrice : Math.round(extracted.sellingPrice * 0.75),
    isExisting,
    existingId: isExisting ? existing!.id : undefined,
    existingPrice: isExisting ? existing!.sellPrice : undefined,
    existingStock: isExisting ? existing!.stockQty : undefined,
    priceChanged,
    stockChanged,
    validationError,
  };
}

/**
 * Deterministic Regex-based fallback parser for tabular text catalogues.
 * Handles patterns like:
 * Coca-Cola 500ml    ₹40         100
 * Pepsi 500ml        ₹40          75
 * Maggi 70g          ₹15          50
 * Parle-G Biscuits   ₹20          30
 */
export function parseCatalogueTextLines(text: string, existingProducts: Product[] = []): { shopTitle?: string; products: CatalogueImportProduct[] } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let shopTitle: string | undefined;
  const rawProducts: Array<{ name: string; sellingPrice: number; stockQty: number; sku?: string; category?: string; unit?: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect shop header if at the top
    if (i === 0 && !line.match(/\d/) && line.length < 50) {
      shopTitle = line;
      continue;
    }

    // Skip table header lines
    if (line.toLowerCase().match(/^(product|item|name)\s+(price|rate)\s+(stock|qty|quantity)/i)) {
      continue;
    }
    if (line.match(/^[-=_]{3,}$/)) {
      continue;
    }

    // Match lines ending with: [Price] [Stock] or [Price] [Quantity]
    // e.g. "Coca-Cola 500ml ₹40 100" or "Pepsi 500ml 40 75" or "Maggi 70g 15.00 50 pcs"
    const match = line.match(/^(.+?)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)\s+(?:₹|rs\.?|inr)?\s*(\d+)(?:\s+([a-zA-Z]+))?$/i);
    if (match) {
      const name = match[1].trim();
      const price = parseFloat(match[2]);
      const stock = parseInt(match[3], 10);
      const unit = match[4] || (name.toLowerCase().includes('ml') ? 'bottle' : name.toLowerCase().includes('g') ? 'packet' : 'pcs');

      // Detect general category
      let category = 'General';
      const nLower = name.toLowerCase();
      if (nLower.includes('cola') || nLower.includes('pepsi') || nLower.includes('drink') || nLower.includes('juice') || nLower.includes('water')) {
        category = 'Beverages';
      } else if (nLower.includes('maggi') || nLower.includes('noodle') || nLower.includes('biscuit') || nLower.includes('snack') || nLower.includes('parle')) {
        category = 'Grocery & Snacks';
      } else if (nLower.includes('paint') || nLower.includes('primer')) {
        category = 'Paints';
      } else if (nLower.includes('book') || nLower.includes('pen') || nLower.includes('stationery')) {
        category = 'Stationery';
      }

      rawProducts.push({
        name,
        sellingPrice: price,
        stockQty: stock,
        unit,
        category,
      });
    }
  }

  return {
    shopTitle,
    products: rawProducts.map(p => matchProductWithCatalogue(p, existingProducts)),
  };
}
