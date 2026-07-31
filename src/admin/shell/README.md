# Admin shell

Stage 1 reserves this boundary for the global operational shell defined by the master plan.

Stage 3 will move/implement the application header, command palette, global `+ Novo`, responsive navigation shell and role-aware global actions here.

Rules:

- shell code must not own business data or domain rules;
- authorization remains enforced by Payload Access Control;
- shell components may orchestrate navigation and client interaction only;
- feature workspaces live under `src/admin/modules/*`.
