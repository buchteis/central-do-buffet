import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
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
  Package,
  Receipt,
  Search,
  Settings,
  Shield,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTenantAccess } from "@/hooks/useTenantAccess";

type NavItem = { to: string; label: string; icon: typeof Home };

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
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: access } = useTenantAccess();

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Você saiu da conta.");
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <aside className="hidden md:flex w-64 border-r border-border flex-col sticky top-0 h-screen bg-sidebar">
        <div className="p-6 flex items-center gap-3">
          <div className="size-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Flame className="size-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-lg tracking-tight">Central do Buffet</span>
            <span className="text-[10px] text-muted-foreground font-mono uppercase">Gestão de buffet</span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {primary.map((item) => (
            <SideLink key={item.to} item={item} active={isActive(pathname, item.to)} />
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
            <div className="size-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center ring-1 ring-primary/20">
              {(access?.tenant?.name ?? "MC").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col overflow-hidden flex-1 min-w-0">
              <span className="text-xs font-bold truncate">{access?.tenant?.name ?? "Meu Buffet"}</span>
              <span className="text-[10px] text-muted-foreground truncate">
                {access?.isSuperAdmin ? "Super Admin" : access?.email}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 p-4 md:p-8 max-w-[1280px] mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate flex-1">{item.label}</span>
    </Link>
  );
}

function isActive(pathname: string, to: string) {
  if (to === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === to || pathname.startsWith(to + "/");
}

function TopBar() {
  const q = useGlobalSearch();
  const router = useRouter();
  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Buscar cliente, orçamento…"
          className="w-full bg-muted/40 border border-border rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition"
        />
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <Button
          onClick={() => router.navigate({ to: "/orcamentos/novo" })}
          className="rounded-full shadow-lg shadow-primary/20 font-bold text-xs"
          size="sm"
        >
          + Novo orçamento
        </Button>
      </div>
    </header>
  );
}
