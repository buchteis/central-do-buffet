const saveMutation = useMutation({
    mutationFn: async () => {
      const validPackageIds = selectedPackageIds.filter((id) => id.trim() !== "");
      if (validPackageIds.length === 0) {
        throw new Error("Selecione ao menos um pacote");
      }

      const payload = {
        client_id: clientId || null,
        package_id: validPackageIds[0],
        event_date: eventDate,
        event_time: eventTime || null,
        event_type: eventType || null,
        event_address: eventAddress || null,
        adults: adults,
        children_count: childrenCount,
        total_value: grandTotal,
        notes: notes || null,
        extras: {
          package_ids: validPackageIds,
          child_price: childrenPrice, // Guardado com segurança aqui dentro sem exigir coluna no banco
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
