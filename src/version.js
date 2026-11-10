/**
 * The dispatcher's version, for `fob --version`. A literal rather than a
 * package.json read because the released binaries are Bun-compiled and
 * package.json isn't on disk next to them. tests/version.test.js keeps this in
 * sync with package.json, so bump both together.
 */
export const VERSION = '1.0.0';
