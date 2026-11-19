<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Notification read state (bell, chat alerts, Dashboard warnings) lives in `public.notification_state` per user via `useNotificationState`, not localStorage — so it syncs between phone and computer.
- Public contract branding is resolved server-side after signing-token validation, scoped to the contract owner and tenant, and returns only the business name and a short-lived logo URL; the pure resolver guards cross-buffet settings and storage paths.
- The administrative assistant and WhatsApp attendant share a server-only Groq transport with complete supplied history, Chat Completions tool-call handling and validated attendant JSON; retry only rejected 429 requests within bounded waits that honor provider delays, never network/unknown outcomes or account-wide quotas.
- Administrative AI context is selected by the current topic and recent turns, preserving every selected package and excluding failed replies from history; this reduces irrelevant input without breaking follow-up questions or tenant-scoped memory.
- All Evolution API operations use the linked custom connector through the shared server-only client; requiring both gateway credentials prevents stale direct-server settings from bypassing the connection selected in Lovable.
- WhatsApp pipeline stages persist in the tenant-scoped conversation row; inbound intent advances atomically without regressions before AI generation, so provider failures cannot discard customer qualification.
- Support messages are append-only, tenant-scoped rows accessed through authenticated server functions and owner/super-admin RLS; inbox polling reuses the same workspace in Messages and Super Admin so registrations remain isolated.
- Leaf routes use app-specific metadata, with the shared pageHead helper for simple static pages, so navigation and link previews retain each screen's identity.
