import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '.next',
      'node_modules',
      'out',
      'public/static/js/lamejs',
      'dist',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        process: 'readonly',
        globalThis: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        crypto: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        DataTransfer: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLImageElement: 'readonly',
        Image: 'readonly',
        XMLHttpRequest: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        global: 'readonly',
        self: 'readonly',
        Worker: 'readonly',
        IntersectionObserver: 'readonly',
        MediaRecorder: 'readonly',
        FileReader: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MutationObserver: 'readonly',
        WebSocket: 'readonly',
        createImageBitmap: 'readonly',
        ImageBitmap: 'readonly',
        caches: 'readonly',
        ClipboardItem: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        ErrorEvent: 'readonly',
        CSS: 'readonly',
        Audio: 'readonly',
        HTMLVideoElement: 'readonly',
        HTMLMediaElement: 'readonly',
        HTMLDivElement: 'readonly',
        Node: 'readonly',
        getComputedStyle: 'readonly',
        IDBKeyRange: 'readonly',
        FileList: 'readonly',
        MediaError: 'readonly',
        DocumentFragment: 'readonly',
        indexedDB: 'readonly',
        OffscreenCanvas: 'readonly',
        ReadableStream: 'readonly',
        WritableStream: 'readonly',
        TransformStream: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        afterEach: 'readonly',
        beforeEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        Deno: 'readonly',
        cookieStore: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-dupe-keys': 'error',
      'no-func-assign': 'warn',
      'constructor-super': 'warn',
      'no-dupe-class-members': 'warn',
      'no-empty': 'warn',
      'no-case-declarations': 'error',
      'preserve-caught-error': 'warn',
      'class-methods-use-this': 'off',
      'consistent-return': 'off',
      'no-underscore-dangle': ['warn', { allow: ['_id', '__STATE', '__html'] }],
      'object-curly-newline': ['warn', { multiline: true, consistent: true }],
      'no-plusplus': 'off',
      'no-use-before-define': 'off',
      'no-undef': 'error',
      'no-useless-assignment': 'warn',
      'no-case-declarations': 'warn',
      'no-redeclare': 'warn',
      'no-self-assign': 'warn',
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'off',
      semi: ['warn', 'always'],
    },
  },
  {
    // Code that runs under Node: unit tests (vitest) and the discovery
    // engine, which is only loaded by netlify/functions/personalization-discovery.js.
    files: ['src/test/**/*.{js,jsx,ts,tsx}', 'src/**/__tests__/**/*.{js,jsx,ts,tsx}', 'src/components/personalize/discovery/**/*.js'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
      },
    },
  },
  {
    // TimelineEditorPage.jsx is a protected file: src/test/protected-upload-baseline.test.ts
    // pins its sha256 and forbids edits without an approved, re-recorded baseline.
    // Its undefined-name references (state, renderPreview, applyCameraEffect, …) are
    // known runtime bugs tracked for a separate, approved change; keep them visible as
    // warnings instead of failing lint for the whole repo.
    files: ['src/components/TimelineEditorPage.jsx'],
    rules: {
      'no-undef': 'warn',
    },
  },
  {
    // Also pinned by protected-upload-baseline.test.ts; `rawClient` is `let` only by style.
    files: ['src/lib/supabase.js'],
    rules: {
      'prefer-const': 'warn',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['backend/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },
  {
    // Netlify functions run in the Node Lambda runtime (v1 handler style:
    // `export async function handler(event, context)`).
    files: ['netlify/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        globalThis: 'readonly',
        Response: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },
  {
    // Personalization + Lead Finder system ported from OpenHiggsBolt. It is
    // TypeScript written for Next.js + Vitest: `React.*` type references and
    // Node globals in its tests/scripts are resolved by TypeScript, not by
    // ESLint's no-undef, and its <img> usage is intentional (no next/image
    // here). Upstream lint rules apply to it; these are the remix deltas.
    files: ['src/features/personalization/**/*.{js,jsx,ts,tsx,mjs}'],
    languageOptions: {
      globals: {
        React: 'readonly',
        Buffer: 'readonly',
        process: 'readonly',
        console: 'readonly',
        queueMicrotask: 'readonly',
        screen: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  {
    // Vendored CineGen (src/cinegen, MIT; see src/cinegen/NOTICE.md) and the OpenChatCut port (src/openchatcut): TypeScript sources written
    // against type-aware tooling. They keep their upstream style, so: DOM/TS globals the type checker already knows, the lint rules that
    // only restate style choices are off, and the plugin rules their `eslint-disable` comments name are registered as no-ops (otherwise
    // each such comment is reported as "Definition for rule ... was not found").
    files: ['src/cinegen/**/*.{js,jsx,ts,tsx,mjs}', 'src/openchatcut/**/*.{js,jsx,ts,tsx,mjs}'],
    languageOptions: {
      globals: { React: 'readonly', structuredClone: 'readonly', queueMicrotask: 'readonly', NodeJS: 'readonly', URL: 'readonly', DedicatedWorkerGlobalScope: 'readonly' },
    },
    plugins: {
      '@next/next': { rules: { 'no-img-element': { create: () => ({}) } } },
      'jsx-a11y': { rules: { 'media-has-caption': { create: () => ({}) }, 'alt-text': { create: () => ({}) }, 'no-static-element-interactions': { create: () => ({}) }, 'click-events-have-key-events': { create: () => ({}) } } },
      '@typescript-eslint': { rules: { 'no-explicit-any': { create: () => ({}) }, 'no-unused-vars': { create: () => ({}) }, 'ban-ts-comment': { create: () => ({}) } } },
    },
    rules: {
      'prefer-const': 'off',
      'no-irregular-whitespace': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
    },
  },
];
