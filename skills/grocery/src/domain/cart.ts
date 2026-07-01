// Pure cart invariants — no I/O, so they are trivially testable and provider-agnostic.

import type { Cart, CartLine, Product } from './types.js';

export function emptyCart(userId: string): Cart {
  return { userId, lines: [] };
}

/** Add (or increment) a product line. Non-positive quantities are rejected. */
export function addLine(cart: Cart, product: Product, quantity: number): Cart {
  if (quantity <= 0) throw new Error(`quantity must be positive: ${quantity}`);
  const lines = [...cart.lines];
  const existing = lines.findIndex((l) => l.product.id === product.id);
  if (existing >= 0) {
    const current = lines[existing] as CartLine;
    lines[existing] = { product, quantity: current.quantity + quantity };
  } else {
    lines.push({ product, quantity });
  }
  return { ...cart, lines };
}

export function cartTotalMinor(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.product.priceMinor * l.quantity, 0);
}

export function isEmpty(cart: Cart): boolean {
  return cart.lines.length === 0;
}
