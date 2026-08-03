// ════════════════════════════════════════════════════════════════
// CORREÇÃO: src/routes/orcamentos.tsx (página de LISTA — geração de PDF)
// ════════════════════════════════════════════════════════════════
// PROBLEMA: A função handleGeneratePdf chama generateQuotePdf({...})
//           mas NÃO passa o campo unitItems. Sem ele, a função
//           dedupePackages dentro de quote-pdf.ts recebe array vazio
//           e não remove o pacote duplicado.
// SOLUÇÃO:  Extrair extras.unit_items do orçamento e passar como
//           unitItems no objeto enviado para generateQuotePdf.
// ════════════════════════════════════════════════════════════════


// Localize a função handleGeneratePdf (ou o trecho que chama
// generateQuotePdf) e faça a alteração abaixo.


// ───────────────────────────────────────────────
// ANTES (código atual — está faltando unitItems):
// ───────────────────────────────────────────────
// const result = await generateQuotePdf({
//   // ... outros campos ...
//   package: e.packages || (...) ? { name: j(e), pricePerPerson: s } : null,
//   childPrice: i,
//   extras: c,          // só customExtras
//   breakdown: d,
//   // ← faltava unitItems!
// });


// ───────────────────────────────────────────────
// DEPOIS (código corrigido):
// ───────────────────────────────────────────────


// Extraia os itens unitários do extras do orçamento (antes da chamada):
const unitItemsSnap = Array.isArray((e as any).extras?.unit_items)
  ? (e as any).extras.unit_items
  : [];


const result = await generateQuotePdf({
  // ... outros campos (mantenha tudo que já existe) ...
  package: e.packages || (/* ... */) ? { name: j(e), pricePerPerson: s } : null,
  childPrice: i,
  extras: c, // customExtras (mantenha como está)
  breakdown: d,
  // ✅ CAMPO ADICIONADO — agora o PDF recebe os itens unitários:
  unitItems: unitItemsSnap.map((i: any) => ({
    name: i?.name ?? "",
    unit: i?.unit ?? "",
    unit_price: Number(i?.unit_price ?? 0) || 0,
    qty: Number(i?.qty ?? 0) || 0,
  })),
});


// ════════════════════════════════════════════════════════════════
// NOTA IMPORTANTE:
//   O nome exato da variável do orçamento pode variar no seu código
//   (e, quote, orc, row, etc.). Adapte "e" para o nome correto que
//   aparece na sua função handleGeneratePdf. O importante é:
//   1) Ler extras.unit_items do orçamento
//   2) Passar como unitItems no objeto de generateQuotePdf
// ════════════════════════════════════════════════════════════════