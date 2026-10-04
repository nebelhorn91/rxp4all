# RXP4ALL

A browser-only RestedXP import-code generator.

## Generate an import code

1. Enter your complete BattleTag, including its `#number`.
2. Choose WoW Forever, Midnight, TBC Classic, or WotLK Classic.
3. Click **Generate import code**.
4. Click **Copy import code** and paste the full code into the RestedXP import window in game.

No file or original BattleTag needs to be entered for this flow. Guide files are fetched from pinned public repositories and processed locally. Their contents are not copied into this repository.

**WoW Forever** uses the public starting routes in [RestedXP/RXPGuides](https://github.com/RestedXP/RXPGuides), pinned to commit `b2cb0c5396ea9920098f2f439cf3d33155b17631`. It contains Horde and Alliance routes, including Skyborne and Mage AoE routes, with coverage up to level 22 depending on the route. It does not include a complete 1–60 pack or later paid guide packs. The website reads the literal guide strings from 13 source files without executing Lua. It preserves the guide text, faction and class filters, and the `#forever` metadata, then packages the guides into a BattleTag-specific import code. Use the RestedXP addon for WoW Forever.

Midnight, TBC and WotLK exports are loaded directly from [mkccl/restedxp-reencrypt](https://github.com/mkccl/restedxp-reencrypt), pinned to source commit `d5d4816ca0f33279da3d51f0e271e9d90ff3b669`.

Your BattleTag is only used by the local Web Worker. It is not included in any network request, query string, browser storage, or analytics event. The source repository receives normal requests for the selected guide files.

## Deployment

Website: https://nebelhorn91.github.io/rxp4all/

The included GitHub Actions workflow publishes `dist/` whenever changes are pushed to `main`. There are no build dependencies to install. **Settings → Pages → Source → GitHub Actions** is the recommended publishing configuration.

The repository root also contains a redirect and `.nojekyll` marker for compatibility with Pages deployments from the `main` branch root. Asset paths are relative, so the same static website works at the site root or at `/dist/`.

## Format support

Supports the encrypted `:` blocks implemented by the reference project: Base64, BattleTag-derived RC4, zlib, Adler-32 checksums, and a version suffix. Other block modes are rejected explicitly. The default export version is `40000` if no suffix is present.

Limits: 20 MiB import text, 64 MiB decompressed content, and 5,000 guides. A current browser with module Web Workers, `CompressionStream`, and `DecompressionStream` is required.

## Validation

Run `npm run check` to check JavaScript syntax and `npm test` to test guide loading, Lua-literal extraction, metadata checks, missing or damaged sources, attribution, and account-specific import-code generation. The deployment workflow runs both before publishing.

The generator was checked with all three actual source packs: Midnight (869 guides), TBC (263 guides), and WotLK (97 guides). Each generated code decodes to the same contents using the original reference decoder. Invalid inputs, source-network failures, caching, and omission of BattleTags from network requests were also checked.

The Forever generator was checked with all 13 actual source files (46 guide entries). Its generated code was verified with the original reference decoder, including the preserved guide text and source attribution. Live in-game import requires the matching BattleTag and the Forever version of RestedXP.

## Attribution

The export format, guide-pack metadata, and BattleTag key derivation follow the user-selected reference project [mkccl/restedxp-reencrypt](https://github.com/mkccl/restedxp-reencrypt), specifically `lib/rxp-crypto.ts` and `lib/guides.ts` at commit `d5d4816ca0f33279da3d51f0e271e9d90ff3b669`.

The interface, native stream processing, Web Worker integration, and validation are implemented independently. The main page links to the original project in its navigation and attribution.

The Forever guide texts are by RestedXP and are provided under the repository's [CC BY-NC-SA 4.0 license](https://github.com/RestedXP/RXPGuides/blob/b2cb0c5396ea9920098f2f439cf3d33155b17631/LICENSE). The website shows this attribution and includes source URLs, license information, and a packaging notice as comments in each generated Forever guide. No changes are made to the route text. Guide content retains its original license; import-code packaging does not change it.
