const saveMutation = useMutation({
    mutationFn: async () => {
      const validPackageIds = selectedPackageIds.filter((id) => id && id.trim() !== "");
      if (validPackageIds.length === 0) {
        throw new Error("Selecione ao menos um pacote");
      }

      // Payload limpo contendo apenas as colunas padrão existentes no banco
      const payload = {
        client_id: clientId || null,
        package_id: validPackageIds[0],
        event_date: eventDate,
        event_time: eventTime || null,
        event_type: eventType || null,
        event_address: eventAddress || null,
        adults: adults,
        total_value: grandTotal,
        notes: notes || null,
        extras: {
          package_ids: validPackageIds,
          children_count: childrenCount, // Guardado dentro do extras
          child_price: childrenPrice,     // Guardado dentro do extras
        },
      };

      const { data, error } = await supabase.from("quotes").insert([payload]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento criado com sucesso!");
      navigate({ to: "/orcamentos" });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar orçamento"),
  });
