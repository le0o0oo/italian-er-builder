# er-builder

Nuxt 4 app (pnpm).

## Stack
- **UI components:** shadcn-vue (`shadcn-nuxt` module, components in `app/components/ui`)
- **Styling:** Tailwind CSS v4 (`app/assets/css/tailwind.css`)
- **Icons:** `@nuxt/icon` module — use `<Icon name="lucide:plus" />` (Iconify names). Do not import icon components from `@lucide/vue` in app code.

## Rules
- If you need a UI component (button, dialog, input, table, etc.) that exists in shadcn-vue, **add it with the shadcn-vue CLI**, never hand-write it:
  `pnpm dlx shadcn-vue@latest add <component>`
- Browse available components: `pnpm dlx shadcn-vue@latest add` (interactive list).
- Only build a custom component when shadcn-vue has no equivalent.
