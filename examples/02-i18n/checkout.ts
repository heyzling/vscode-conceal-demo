// The strings live in messages.en.json, the file beside this one: edit a translation there and
// what is drawn here follows, with this file untouched.

declare function t(key: string): string;

export function checkoutScreen(itemCount: number): string[] {
  const lines = [t("account.greeting")];
  lines.push(itemCount === 0 ? t("cart.empty") : t("cart.checkout"));
  lines.push(t("order.thanks"));
  // No entry in the catalogue, so this one stays as it is written.
  lines.push(t("cart.shipping"));
  return lines;
}
