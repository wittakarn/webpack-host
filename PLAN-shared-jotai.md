# Plan: share jotai click count from remote_1 → remote_2

Goal: remote_1 Button increments a jotai atom; remote_2 Message reads the same atom; host renders both.

Key idea: atom defined ONCE in remote_1 and exposed via MF; remote_2 imports it as `viteRemote/store`.
`jotai` listed as `singleton` in `shared` of both remotes → one jotai instance → one default store.

Verified compat (2026-10-23): `@module-federation/vite@1.23.5` peers vite ^5–^8 (remote_2 Vite 8 OK);
`jotai@3.0.1` peers react >=18.

## State before starting

- Uncommitted: `remote/` → `remote_1/` rename (+ package.json, pnpm-workspace.yaml, lockfile, README, CLAUDE.md).
- `remote_2/` untracked, standalone Vite 8 + React 19 + TS + React Compiler scaffold, NOT federated, NOT in workspace.
- `pnpm-workspace.yaml` has `allowBuilds: esbuild: true`.

## Step 1 — bring remote_2 into the workspace on React 18

React is a shared singleton; host/remote_1 are React 18, so remote_2 must be too.

- `pnpm-workspace.yaml`: add `- 'remote_2'` under `packages`.
- `remote_2/package.json`:
  - `name` → `@webpack-host/remote_2`
  - `react`, `react-dom` → `^18.2.0`; `@types/react`, `@types/react-dom` → `^18.x`
  - add dep `react-compiler-runtime` (needed by React Compiler on React 18)
- `remote_2/vite.config.ts`: `reactCompilerPreset({ target: '18' })`
  (alternative: drop the `babel(...)` compiler plugin entirely — simpler).
- Delete `remote_2/pnpm-lock.yaml` and `remote_2/node_modules` (root lockfile owns workspace).
- Root `package.json`:
  - `workspaces`: add `"remote_2"`
  - `build:remotes` / `serve:remotes`: `--filter "./remote_*"`
  - `stop`: `kill-port --port 3000,5001,5002`
- Run `pnpm install` from root. Check `pnpm --filter @webpack-host/remote_2 build` passes.

## Step 2 — remote_1 owns + exposes the atom

- `pnpm --filter @webpack-host/remote add jotai`
- New `remote_1/src/store.js`:
  ```js
  import { atom } from 'jotai'
  export const clickCountAtom = atom(0)
  ```
- `remote_1/src/components/Button.jsx`: replace `useState(0)` with
  `const [state, setState] = useAtom(clickCountAtom)` (import from `jotai` and `../store`).
- `remote_1/vite.config.js`:
  - `exposes`: add `'./store': './src/store'`
  - `shared`: add `jotai: { singleton: true }`

## Step 3 — federate remote_2, consume the atom

- `pnpm --filter @webpack-host/remote_2 add jotai`
- `pnpm --filter @webpack-host/remote_2 add -D @module-federation/vite`
- `remote_2/vite.config.ts`:
  ```ts
  import { federation } from '@module-federation/vite'
  // plugins: [react(), babel(...), federation({
  //   name: 'viteRemote2',
  //   filename: 'remoteEntry.js',
  //   exposes: { './Message': './src/components/Message' },
  //   remotes: { viteRemote: 'viteRemote@http://localhost:5001/mf-manifest.json' },
  //   manifest: true,
  //   shared: {
  //     react: { singleton: true },
  //     'react-dom': { singleton: true },
  //     jotai: { singleton: true },
  //   },
  // })]
  // base: 'http://localhost:5002/',
  // build: { modulePreload: false, target: 'esnext' }
  ```
  (mirror `remote_1/vite.config.js`; check whether `eager` needed like remote_1 has)
- New `remote_2/src/remotes.d.ts` (TS needs types for the federated import):
  ```ts
  declare module 'viteRemote/store' {
    import type { PrimitiveAtom } from 'jotai'
    export const clickCountAtom: PrimitiveAtom<number>
  }
  ```
- `remote_2/src/components/Message.tsx`:
  ```tsx
  import { useAtomValue } from 'jotai'
  import { clickCountAtom } from 'viteRemote/store'

  const Message = () => {
    const count = useAtomValue(clickCountAtom)
    return <div>{count > 5 ? 'So many clicking, you need to stop' : `Clicks: ${count}`}</div>
  }
  export default Message
  ```

## Step 4 — host renders remote_2

- `host/webpack.config.js` `remotes`: add
  `viteRemote2: 'viteRemote2@http://localhost:5002/mf-manifest.json'`
- New `host/src/MessageRemote.jsx`: copy `ButtonRemote.jsx`, load `'viteRemote2/Message'`.
- `host/src/App.jsx`: render `<MessageRemote />` inside its own `ErrorBoundary` next to `<ButtonRemote />`.
- Host does NOT need jotai (it never imports it); share scope dedupes between the remotes.
  If two jotai copies show up anyway (step 5 fails), add `jotai` dep + `shared: { jotai: { singleton: true, eager: true } }` to host.

## Step 5 — verify

```bash
pnpm install
pnpm run build
pnpm run serve      # host :3000, remote_1 :5001, remote_2 :5002
```
Open http://localhost:3000, click button:
- Message shows `Clicks: N` tracking button → shared OK.
- Message stuck at 0 → two jotai instances or two atom copies. Check devtools console for MF shared
  warnings; check `__FEDERATION__.__SHARE__` in console for a single loaded `jotai`.
- After 6 clicks → "So many clicking, you need to stop".

## Step 6 — docs

- `CLAUDE.md` / `README.md`: mention remote_2 (port 5002), shared jotai atom, remote_1 exposes `./store`.

## Risks

- `host/runtime-plugin/esm-load-entry.js` custom loadEntry applies to remote_2 too (ESM) — should be fine, watch for retry quirks.
- remote_2 depends on remote_1 at runtime; remote_1 down → Message fails (ErrorBoundary catches).
