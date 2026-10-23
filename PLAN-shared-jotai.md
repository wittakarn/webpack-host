# Plan: share jotai click count between remote_1 and remote_2

Goal: remote_1 Button increments a jotai atom; remote_2 Message reads the same atom; host renders both.

Key idea: atom defined ONCE in a workspace package `@webpack-host/store` (`packages/store/`), depended on by
both remotes. Both `jotai` AND `@webpack-host/store` listed as `singleton` in `shared` of both remotes →
one jotai instance + one atom object at runtime. (jotai keys atoms by object identity: if the store package
is bundled into each remote instead of shared, there are two atoms and Message stays at 0.)
Remotes don't depend on each other at runtime.

Verified compat (2026-10-23): `@module-federation/vite@1.23.5` peers vite ^5–^8;
`jotai@3.0.1` peers react >=18.

## Step 1 — bring remote_2 into the workspace on React 18 ✅ done

- remote_2 in workspace as `@webpack-host/remote_2`, React 18, `react-compiler-runtime`,
  `reactCompilerPreset({ target: '18' })`; own lockfile removed; root scripts cover `./remote_*`, stop kills 5002.
- Extra: remote_1 upgraded to Vite ^8.3.4 / `@vitejs/plugin-react` ^6.1.2 / `@module-federation/vite` ^1.23.5,
  `dts: false` in its federation config.
- Needs Node >=20.19 (Vite 8 / rolldown); using Node 24.

## Step 2 — create the shared store package

- `pnpm-workspace.yaml` `packages`: add `- 'packages/*'`; root `package.json` `workspaces`: add `"packages/*"`.
- New `packages/store/package.json`:
  ```json
  {
    "name": "@webpack-host/store",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "main": "index.ts",
    "peerDependencies": { "jotai": "^3.0.1" }
  }
  ```
  No build step: both remotes are Vite and compile TS source directly.
- New `packages/store/index.ts`:
  ```ts
  import { atom } from 'jotai'
  export const clickCountAtom = atom(0)
  ```
- Root `build` / `serve` use `--filter "./**"`; the store has no scripts, so pnpm skips it.

## Step 3 — remote_1 uses the store

- `pnpm --filter @webpack-host/remote add jotai @webpack-host/store@workspace:*`
- `remote_1/src/components/Button.jsx`: replace `useState(0)` with
  `const [state, setState] = useAtom(clickCountAtom)` (`useAtom` from `jotai`, `clickCountAtom` from `@webpack-host/store`).
- `remote_1/vite.config.js` `shared`: add
  ```js
  jotai: { singleton: true },
  '@webpack-host/store': { singleton: true },
  ```
  (check whether `eager` is needed, like remote_1's react/react-dom have)

## Step 4 — federate remote_2, consume the store

- `pnpm --filter @webpack-host/remote_2 add jotai @webpack-host/store@workspace:*`
- `pnpm --filter @webpack-host/remote_2 add -D @module-federation/vite`
- `remote_2/vite.config.ts`:
  ```ts
  import { federation } from '@module-federation/vite'
  // plugins: [react(), babel(...), federation({
  //   name: 'viteRemote2',
  //   filename: 'remoteEntry.js',
  //   exposes: { './Message': './src/components/Message' },
  //   manifest: true,
  //   dts: false,
  //   shared: {
  //     react: { singleton: true },
  //     'react-dom': { singleton: true },
  //     jotai: { singleton: true },
  //     '@webpack-host/store': { singleton: true },
  //   },
  // })]
  // base: 'http://localhost:5002/',
  // build: { modulePreload: false, target: 'esnext' }
  ```
  (mirror `remote_1/vite.config.js`, no `remotes` needed)
- `remote_2/src/components/Message.tsx`:
  ```tsx
  import { useAtomValue } from 'jotai'
  import { clickCountAtom } from '@webpack-host/store'

  const Message = () => {
    const count = useAtomValue(clickCountAtom)
    return <div>{count > 5 ? 'So many clicking, you need to stop' : `Clicks: ${count}`}</div>
  }
  export default Message
  ```
- `tsc -b` must see `packages/store/index.ts`; if `tsconfig.app.json` `include` rejects it, add the path
  or give the store package an `index.d.ts`.

## Step 5 — host renders remote_2

- `host/webpack.config.js` `remotes`: add
  `viteRemote2: 'viteRemote2@http://localhost:5002/mf-manifest.json'`
- New `host/src/MessageRemote.jsx`: copy `ButtonRemote.jsx`, load `'viteRemote2/Message'`.
- `host/src/App.jsx`: render `<MessageRemote />` inside its own `ErrorBoundary` next to `<ButtonRemote />`.
- Host does NOT need jotai or the store (never imports them); share scope dedupes between the remotes.
  If two copies show up anyway (step 6 fails), add both deps to host +
  `shared: { jotai: { singleton: true, eager: true }, '@webpack-host/store': { singleton: true, eager: true } }`.

## Step 6 — verify

```bash
pnpm install
pnpm run build
pnpm run serve      # host :3000, remote_1 :5001, remote_2 :5002
```
Open http://localhost:3000, click button:
- Message shows `Clicks: N` tracking button → shared OK.
- Message stuck at 0 → two jotai instances or two atom copies. Check devtools console for MF shared
  warnings; check `__FEDERATION__.__SHARE__` for a single loaded `jotai` AND a single `@webpack-host/store`.
- After 6 clicks → "So many clicking, you need to stop".

## Step 7 — docs

- `CLAUDE.md` / `README.md`: mention remote_2 (port 5002), `packages/store` shared atom, Node >=20.19.

## Risks

- `host/runtime-plugin/esm-load-entry.js` custom loadEntry applies to remote_2 too (ESM) — should be fine, watch for retry quirks.
- MF shared resolves by version: both remotes get `@webpack-host/store@0.0.0` from the workspace, so they match.
  If the version is ever bumped in only one build, singleton picks one and warns.
- `remote_1/.__mf__temp/` is generated but tracked in git — consider gitignoring it.
