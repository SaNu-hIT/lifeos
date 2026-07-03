import type React from 'react';
import type { PriceMatrix } from '../types';

interface Props {
  matrix: PriceMatrix;
}

function formatMinor(minor: number): string {
  return `₹${(minor / 100).toFixed(2)}`;
}

/** Compact rating counts: 1280 → "1.3k". */
function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** Discount % off MRP, from an absolute discount + MRP (both in minor units). */
function discountPct(mrpMinor?: number, discountMinor?: number): number | undefined {
  if (!mrpMinor || !discountMinor || mrpMinor <= 0) return undefined;
  return Math.round((discountMinor / mrpMinor) * 100);
}

export function PriceMatrixTable({ matrix }: Props) {
  // Only stores that actually cover an item compete for "cheapest" — a store with no
  // matches totals ₹0.00 and must not win the ✓.
  const cheapestStore = matrix.stores
    .filter((s) => (matrix.totalsByStore[s] ?? 0) > 0)
    .reduce<string | undefined>((min, s) => {
      if (!min) return s;
      return (matrix.totalsByStore[s] ?? 0) < (matrix.totalsByStore[min] ?? 0) ? s : min;
    }, undefined);

  return (
    <table style={table}>
      <thead>
        <tr>
          <th style={{ ...cell, ...headCell, textAlign: 'left' }}>Product</th>
          {matrix.stores.map((store) => (
            <th key={store} style={{ ...cell, ...headCell }}>{store}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {matrix.products.map((product) => {
          // The cheapest in-stock cell in this row gets a highlight.
          const cheapestStoreForRow = matrix.stores.reduce<string | undefined>((best, store) => {
            const c = matrix.cells[product]?.[store];
            if (!c || c.available === false) return best;
            const bestCell = best ? matrix.cells[product]?.[best] : undefined;
            return !bestCell || c.priceMinor < bestCell.priceMinor ? store : best;
          }, undefined);
          return (
            <tr key={product}>
              <td style={{ ...cell, textAlign: 'left' }}>{product}</td>
              {matrix.stores.map((store) => {
                const c = matrix.cells[product]?.[store] ?? null;
                if (c === null) return <td key={store} style={cell}>—</td>;
                const soldOut = c.available === false || c.stockStatus === 'out_of_stock';
                const isCheapest = store === cheapestStoreForRow;
                const pct = discountPct(c.mrpMinor, c.discountMinor);
                const priceEl = (
                  <span style={{ color: isCheapest ? '#5fd08a' : undefined, fontWeight: isCheapest ? 600 : undefined }}>
                    {formatMinor(c.priceMinor)}{isCheapest ? ' ✓' : ''}
                  </span>
                );
                return (
                  <td key={store} style={{ ...cell, ...(soldOut ? soldOutCell : undefined) }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      {c.productUrl ? (
                        <a href={c.productUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                          {priceEl}
                        </a>
                      ) : (
                        priceEl
                      )}
                      {(c.mrpMinor !== undefined && c.mrpMinor > c.priceMinor) && (
                        <span style={meta}>
                          <span style={{ textDecoration: 'line-through' }}>{formatMinor(c.mrpMinor)}</span>
                          {pct !== undefined ? <span style={{ color: '#5fd08a' }}>{` ${pct}% off`}</span> : null}
                        </span>
                      )}
                      {(c.brand || c.size) && (
                        <span style={meta}>{[c.brand, c.size].filter(Boolean).join(' · ')}</span>
                      )}
                      {c.rating !== undefined && (
                        <span style={meta}>
                          ★ {c.rating.toFixed(1)}
                          {c.ratingCount !== undefined ? ` (${formatCount(c.ratingCount)})` : ''}
                        </span>
                      )}
                      {c.deliveryEtaMinutes !== undefined && (
                        <span style={meta}>🕑 {c.deliveryEtaMinutes} min</span>
                      )}
                      {soldOut ? (
                        <span style={{ ...meta, color: '#ff9db0' }}>Out of stock</span>
                      ) : c.stockStatus === 'limited' ? (
                        <span style={{ ...meta, color: '#ffcf8b' }}>Limited stock</span>
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td style={{ ...cell, ...footCell, textAlign: 'left' }}>Total</td>
          {matrix.stores.map((store) => (
            <td key={store} style={{ ...cell, ...footCell, color: store === cheapestStore ? '#5fd08a' : undefined }}>
              {formatMinor(matrix.totalsByStore[store] ?? 0)}
              {store === cheapestStore ? ' ✓' : ''}
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  );
}

const table: React.CSSProperties = {
  borderCollapse: 'collapse', width: '100%', marginTop: 6, fontSize: 14,
};
const cell: React.CSSProperties = {
  border: '1px solid #1c2333', padding: '6px 10px', textAlign: 'right', color: '#e6e9f2',
};
const headCell: React.CSSProperties = {
  background: '#121826', color: '#9aa4bf', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5,
};
const footCell: React.CSSProperties = {
  background: '#0d1220', fontWeight: 600,
};
const meta: React.CSSProperties = {
  fontSize: 11, color: '#9aa4bf',
};
const soldOutCell: React.CSSProperties = {
  opacity: 0.55,
};
