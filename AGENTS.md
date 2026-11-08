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
- The administrative assistant and WhatsApp attendant share a server-only Groq transport with Chat Completions tool-call handling and validated attendant JSON; this keeps provider parsing consistent without changing tenant-scoped memory or booking authorization.
