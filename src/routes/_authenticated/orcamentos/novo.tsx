const saveMutation = useMutation({
    mutationFn: async () => {
      const validPackageIds = selectedPackageIds.filter((id) => id && id.trim() !== "");
      if (validPackageIds.length === 0) {
        throw new Error("Selecione ao menos um pacote");
      }

      // 1. Obtém o usuário autenticado no Supabase
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sessão expirada. Faça login novamente.");

      // 2. Inclui o owner_id para liberar o acesso pelas regras de RLS
      const payload = {
        owner_id: userRes.user.id,
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
          children_count: childrenCount,
          child_price: childrenPrice,
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
