// ============================================
// BLOCO DE PACOTES - VERSÃO MELHORADA
// ============================================

{packages && packages.length > 0 ? (
  <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <Label className="font-semibold">
        Pacotes desejados
        {guestCount && guestCount >= 1 && !showAllPackages && (
          <span className="text-xs font-normal text-muted-foreground ml-2">
            (recomendados para {guestCount} pessoas)
          </span>
        )}
      </Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAllPackages(!showAllPackages)}
          className="h-8 gap-1 text-xs"
        >
          {showAllPackages ? (
            <>
              <EyeOff className="size-3.5" /> Mostrar recomendados
            </>
          ) : (
            <>
              <Eye className="size-3.5" /> Ver todos os pacotes
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPackage}
          className="h-8 gap-1 text-xs"
        >
          <Plus className="size-3.5" /> Adicionar pacote
        </Button>
      </div>
    </div>

    {showAllPackages && (
      <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
        💡 Mostrando todos os pacotes disponíveis. Os pacotes com ⚠️ não são recomendados para o número de convidados informado.
      </div>
    )}

    {selectedPackages.map((pkg, index) => {
      // Verifica se o pacote selecionado é compatível
      const selectedPackage = packages.find(p => p.id === pkg.package_id);
      const isCompatible = selectedPackage && guestCount && guestCount >= 1
        ? selectedPackage.min_guests <= guestCount && selectedPackage.max_guests >= guestCount
        : true;

      return (
        <div key={pkg.id} className="flex items-center gap-3 bg-background p-3 rounded-lg border">
          <div className="flex-1">
            <Select
              value={pkg.package_id}
              onValueChange={(value) => updatePackage(pkg.id, value)}
            >
              <SelectTrigger className={cn(
                "w-full",
                pkg.package_id && !isCompatible && !showAllPackages && "border-amber-400 bg-amber-50/50"
              )}>
                <SelectValue placeholder={`Pacote ${index + 1}`} />
              </SelectTrigger>
              <SelectContent>
                {packages.map((p) => {
                  const isCompatiblePkg = guestCount && guestCount >= 1
                    ? p.min_guests <= guestCount && p.max_guests >= guestCount
                    : true;
                  
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.min_guests || 0} - {p.max_guests || 9999} pessoas)
                      {guestCount && guestCount >= 1 && !isCompatiblePkg && ' ⚠️'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => removePackage(pkg.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      );
    })}

    {guestCount && guestCount >= 1 && !showAllPackages && (
      <p className="text-[10px] text-muted-foreground">
        💡 Mostrando pacotes recomendados para <strong>{guestCount}</strong> pessoas. 
        Clique em "Ver todos os pacotes" para ver todas as opções.
      </p>
    )}
  </div>
) : (
  <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border">
    <p className="text-sm text-muted-foreground">
      {guestCount && guestCount >= 1 
        ? `⚠️ Nenhum pacote disponível para ${guestCount} convidados.` 
        : '📦 Digite o número de convidados para ver os pacotes disponíveis.'}
    </p>
    {guestCount && guestCount >= 1 && (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setShowAllPackages(true)}
        className="text-xs"
      >
        <Eye className="size-3.5 mr-1" /> Ver todos os pacotes
      </Button>
    )}
  </div>
)}
