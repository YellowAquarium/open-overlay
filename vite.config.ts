import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'react/jsx-runtime': path.resolve(__dirname, 'src/types/react.ts'),
      'react': path.resolve(__dirname, 'src/types/react.ts'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
    keepNames: true,
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      formats: ['iife'],
      name: 'OpenOverlay',
      fileName: () => 'index.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    target: 'es2022',
    rollupOptions: {
      output: { entryFileNames: 'index.js' },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'proxy.js', dest: '.' },
        { src: 'disk-cache.js', dest: '.' },
        { src: 'mlt-convert.js', dest: '.' },
        { src: '.env.example', dest: '.' },
        { src: 'start-proxy-windows.cmd', dest: '.' },
        { src: 'start-proxy-macos.command', dest: '.' },
        { src: 'start-proxy-linux.sh', dest: '.' },
        { src: 'start-with-game.vbs', dest: '.' },
        { src: 'start-with-game.sh', dest: '.' },
        { src: 'start-with-game.command', dest: '.' },
        { src: 'README.md', dest: '.' },
        { src: 'LICENSE', dest: '.' },
      ],
    }),
  ],
});
