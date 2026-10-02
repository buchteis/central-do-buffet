import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { setGlobalSearch, useGlobalSearch } from "@/lib/search-store";
import {
  BarChart3,
  Boxes,
  Calendar,
  FileSignature,
  FileText,
  Flame,
  Home,
  LogOut,
  Menu,
  Package,
  Plus,
  Receipt,
  ReceiptText,
  Search,
  Settings,
  Shield,
  Star,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { Chatbot } from "@/components/Chatbot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PublicQuoteNotifications } from "@/components/PublicQuoteNotifications";

type NavItem = { to: string; label: string; icon: typeof Home; badge?: number };

/** Conta orçamentos do link público ainda não lidos para o selo no menu. */
function usePublicLeadCount(tenantId?: string, userId?: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!tenantId || !userId) return;
    let active = true;
    async function load() {
      const seenAt = localStorage.getItem(`cdb_public_quotes_seen:${userId}`);
      const { data } = await supabase
        .from("quotes")
        .select("id, extras, created_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      setCount(
        ((data ?? []) as any[]).filter(
          (q) =>
            q.extras?.source === "formulario_publico" &&
            (!seenAt || new Date(q.created_at) > new Date(seenAt)),
        ).length,
      );
    }
    load();
    const onSeen = () => load();
    window.addEventListener("cdb:quotes-seen", onSeen);
    const channel = supabase
      .channel(`lead-badge-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes", filter: `tenant_id=eq.${tenantId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      window.removeEventListener("cdb:quotes-seen", onSeen);
      supabase.removeChannel(channel);
    };
  }, [tenantId, userId]);
  return count;
}

const primary: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/eventos", label: "Eventos", icon: Receipt },
  { to: "/contratos", label: "Contratos", icon: FileSignature },
  { to: "/pacotes", label: "Pacotes", icon: Package },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/agenda", label: "Calendário", icon: Calendar },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/funcionarios", label: "Profissionais", icon: UserCog },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/feedbacks", label: "Avaliações", icon: Star },
  { to: "/notas-fiscais", label: "Notas Fiscais", icon: ReceiptText },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: access } = useTenantAccess();
  const [menuOpen, setMenuOpen] = useState(false);
  const leadCount = usePublicLeadCount(access?.tenant?.id as string | undefined);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Você saiu da conta.");
    router.navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {primary.map((item) => (
          <SideLink
            key={item.to}
            item={item.to === "/orcamentos" ? { ...item, badge: leadCount } : item}
            active={isActive(pathname, item.to)}
          />
        ))}
        {access?.isSuperAdmin && (
          <>
            <div className="h-px bg-border my-4 mx-3" />
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Administração
            </div>
            <SideLink
              item={{ to: "/admin", label: "Super Admin", icon: Shield }}
              active={isActive(pathname, "/admin")}
            />
          </>
        )}
      </nav>

      <div className="p-4 mt-auto border-t border-border">
        <div className="flex items-center gap-3 px-2">
          <div className="size-9 shrink-0 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center ring-1 ring-primary/20">
            {(access?.tenant?.name ?? "CB").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            <span className="text-xs font-bold truncate">{access?.tenant?.name ?? "Meu Buffet"}</span>
            <span className="text-[10px] text-muted-foreground truncate">
              {access?.isSuperAdmin ? "Super Admin" : access?.email}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <aside className="hidden md:flex w-64 border-r border-border flex-col sticky top-0 h-screen bg-sidebar">
        <BrandHeader />
        {nav}
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <TopBar
          menu={
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className="md:hidden p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                  aria-label="Abrir menu"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[17rem] bg-sidebar flex flex-col gap-0">
                <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                <BrandHeader />
                {nav}
              </SheetContent>
            </Sheet>
          }
        />
        <div className="flex-1 p-4 md:p-8 max-w-[1280px] mx-auto w-full min-w-0">
          {children}
        </div>
      </main>
      <Chatbot />
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="p-5 md:p-6 flex items-center gap-3">
      <div className="size-9 shrink-0 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
        <Flame className="size-5 text-primary-foreground" />
      </div>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="font-extrabold text-lg tracking-tight truncate">Central do Buffet</span>
        <span className="text-[10px] text-muted-foreground font-mono uppercase">Gestão de buffet</span>
      </div>
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ease-out",
        "hover:translate-x-1 hover:scale-[1.02] hover:shadow-md hover:bg-card hover:z-10",
        active
          ? "bg-primary/10 text-primary font-semibold shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center size-7 rounded-md transition-colors duration-200",
          active
            ? "bg-primary/15 text-primary"
            : "bg-transparent text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
        )}
      >
        <Icon className="size-4 shrink-0" />
      </span>
      <span className="truncate flex-1">{item.label}</span>
      {!!item.badge && item.badge > 0 && (
        <span
          className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm"
          title={`${item.badge} lead(s) recebido(s) pelo link público`}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
      {active && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-primary" />
      )}
    </Link>
  );
}

function isActive(pathname: string, to: string) {
  if (to === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === to || pathname.startsWith(to + "/");
}

function TopBar({ menu }: { menu?: ReactNode }) {
  const q = useGlobalSearch();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideSearch = pathname === "/dashboard" || pathname === "/";

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur flex items-center gap-2 md:gap-4 px-3 md:px-8 sticky top-0 z-10">
      {menu}
      {hideSearch ? (
        <div className="flex-1 min-w-0" />
      ) : (
        <div className="relative flex-1 min-w-0 md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-full bg-muted/40 border border-border rounded-full py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition"
          />
        </div>
      )}

      <div className="flex items-center gap-1.5 md:gap-2 shrink-0 border-l border-border pl-2">
        <PublicQuoteNotifications />
        <ThemeToggle />

        <Button
          onClick={() =>
            router.navigate({
              to: "/orcamentos/novo",
              search: { leadId: undefined, quoteId: undefined },
            })
          }
          className="rounded-full shadow-lg shadow-primary/20 font-bold text-xs"
          size="sm"
          aria-label="Novo orçamento"
        >
          <Plus className="size-4 md:hidden" />
          <span className="hidden md:inline">+ Novo orçamento</span>
        </Button>
      </div>
    </header>
  );
}
