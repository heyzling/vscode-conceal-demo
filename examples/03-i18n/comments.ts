// Precios en céntimos, siempre enteros
export interface Item {
  price: number;
  quantity: number;
}

// Suma el carrito y aplica el descuento
export function total(items: Item[], discount: number): number {
  let sum = 0;
  for (const item of items) {
    // Redondear al céntimo más cercano
    sum += Math.round(item.price * item.quantity);
  }
  // El descuento se aplica sobre el total y nunca sobre cada línea, porque el redondeo cambiaría el resultado
  return Math.round(sum * (1 - discount));
}

// Sin traducción todavía, así que esta línea se queda como está
export function emptyCart(): Item[] {
  return [];
}
