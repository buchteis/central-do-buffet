// ════════════════════════════════════════════════════════════════
// CORREÇÃO: src/routes/orcamentos/$id.tsx
// ════════════════════════════════════════════════════════════════
// PROBLEMA: unitItems era usado ANTES de ser declarado (temporal dead zone)
//           E a IIFE de unitItems não tinha "return" → sempre undefined
// SOLUÇÃO:  Inverter a ordem (unitItems ANTES de packagesList)
//           e adicionar o return faltante na IIFE de unitItems.
//
// Localize no seu arquivo o trecho que começa com:
//   const packagesList: { name: string; price_per_person?: number }[] = (() => {
// e substitua TANTO o bloco packagesList QUANTO o bloco unitItems
// pelo código abaixo (na ordem mostrada).
// ════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────
// 1º) unitItems AGORA VEM PRIMEIRO (antes de packagesList)
// ───────────────────────────────────────────────
const unitItems: { name: string; unit?: string; unit_price: number; qty: number }[] = (() => {
  const snap = (q.extras as any)?.unit_items;
  if (Array.isArray(snap) && snap.length > 0) {
    // ✅ RETURN adicionado — antes faltava e a IIFE sempre retornava undefined
    return snap.map((i: any) => ({
      name: i?.name ?? "",
      unit: i?.unit ?? "",
      unit_price: Number(i?.unit_price ?? 0) || 0,
      qty: Number(i?.qty ?? 0) || 0,
    }));
  }
  return [];
})();

// ───────────────────────────────────────────────
// 2º) packagesList AGORA VEM DEPOIS — unitItems já existe
// ───────────────────────────────────────────────
const packagesList: { name: string; price_per_person?: number }[] = (() => {
  const snap = (q.extras as any)?.packages;
  if (Array.isArray(snap) && snap.length > 0) {
    return dedupePackages(
      snap.map((p: any) => ({ name: p?.name, price_per_person: Number(p?.price_per_person ?? 0) || 0 })),
      unitItems, // ✅ agora unitItems está declarado e preenchido corretamente
    );
  }
  return q.packages?.name ? [{ name: q.packages.name }] : [];
})();

// ════════════════════════════════════════════════════════════════
// FIM DA CORREÇÃO
// ════════════════════════════════════════════════════════════════
