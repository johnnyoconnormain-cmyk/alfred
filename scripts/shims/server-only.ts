// `server-only` throws unless it is resolved by a bundler that understands React
// Server Components. CLI scripts (the seeder) run the same modules outside Next,
// so they resolve the package to this no-op instead. Application code is
// unaffected — it always goes through the Next build, where the real guard applies.
export {};
