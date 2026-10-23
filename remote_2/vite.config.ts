import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { federation } from "@module-federation/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset({ target: '18' })] }),
    federation({
      name: "viteRemote2",
      filename: "remoteEntry.js",
      exposes: {
        "./Message": "./src/components/Message",
      },
      manifest: true,
      dts: false,
      shared: {
        react: {
          singleton: true,
          eager: true,
        },
        "react-dom": {
          singleton: true,
          eager: true,
        },
        jotai: { singleton: true, eager: true },
        "@webpack-host/store": { singleton: true, eager: true },
      },
    }),
  ],
  base: "http://localhost:5002/",
  build: {
    modulePreload: false,
    target: "esnext",
    minify: false,
  },
})
