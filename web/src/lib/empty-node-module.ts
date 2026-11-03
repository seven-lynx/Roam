// Empty stand-in for the Node builtin `fs/promises`. The `tszm` Z-machine
// engine requires it only inside a dead node-only branch (in the browser it
// fetches the story instead), so this module is bundled but never executed.
// Aliased in next.config.ts via `turbopack.resolveAlias`.
export {};
