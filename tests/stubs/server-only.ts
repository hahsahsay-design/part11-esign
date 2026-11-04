// Next.js resolves the "server-only" sentinel import internally during its
// own bundling — there's no real npm package backing it, so plain Node (and
// vitest) can't resolve `import "server-only"` without this stub. Aliased in
// vitest.config.ts. It intentionally does nothing.
export {};
