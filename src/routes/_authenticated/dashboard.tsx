      {/* ===== AVALIAÇÕES / NPS ===== */}
      <FeedbackPieCard />

      {/* ===== AVALIAÇÕES DO GOOGLE ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-extrabold text-lg tracking-tight text-slate-800 flex items-center gap-2">
            <Building2 className="size-5 text-red-500" />
            Avaliações do Google
          </h2>
          {!isGoogleConnected && <GoogleConnect />}
          {isGoogleConnected && (
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              ✅ Google Conectado
            </span>
          )}
        </div>

        {googleLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando avaliações do Google...</div>
        ) : (
          isGoogleConnected && <GoogleReviews />
        )}

        {!isGoogleConnected && !googleLoading && (
          <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl border-slate-200">
            <Building2 className="size-12 mx-auto text-slate-300 mb-3" />
            <p className="font-medium">Conecte sua conta do Google Meu Negócio</p>
            <p className="text-sm">Para ver suas avaliações diretamente no dashboard</p>
          </div>
        )}
      </div>

      <Chatbot />
    </div>
  );
