{/* --- BARRA DE CARDS A-Z PERSONALIZADA (MAIORES E COLORIDOS) --- */}
<div className="flex flex-wrap items-center gap-2 py-2">
  {/* Botão "Todos" */}
  <button
    onClick={() => setLetter(null)}
    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all transform active:scale-95 shadow-sm ${
      letter === null
        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100"
        : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
    }`}
  >
    Todos <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10">{searched.length}</span>
  </button>

  {/* Cards das Letras A-Z + # */}
  {letterKeys.map((char) => {
    const count = countsByLetter.get(char) ?? 0;
    const isSelected = letter === char;
    const hasItems = count > 0;

    return (
      <button
        key={char}
        disabled={!hasItems}
        onClick={() => setLetter(isSelected ? null : char)}
        className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-1.5 transform active:scale-95 ${
          isSelected
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-offset-2 ring-indigo-600 dark:ring-offset-slate-950 scale-105"
            : hasItems
            ? "bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200/50 dark:border-indigo-800/40 cursor-pointer shadow-sm"
            : "bg-muted/30 text-muted-foreground/30 border border-transparent cursor-not-allowed opacity-50"
        }`}
      >
        <span>{char}</span>
        {hasItems && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              isSelected
                ? "bg-white/20 text-white"
                : "bg-indigo-200/60 text-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-200"
            }`}
          >
            {count}
          </span>
        )}
      </button>
    );
  })}
</div>
