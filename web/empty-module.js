// Stub for optional native/CJS dependencies of wagmi/rainbowkit that are
// never exercised in the browser bundle (we only use the injected
// connector). Turbopack's `resolveAlias` can only point an import at
// another module — unlike webpack's `resolve.alias: { pkg: false }` there is
// no "resolve to nothing" value — so this file is that "nothing".
// See web/next.config.mjs for the alias list and rationale.
module.exports = {};
