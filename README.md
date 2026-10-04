# RXP4ALL

A browser-only RestedXP import-code generator.

## Generate an import code

1. Enter your complete BattleTag, including its `#number`.
2. Choose Midnight, TBC Classic, or WotLK Classic.
3. Click **Generate import code**.
4. Click **Copy import code** and paste the full code into the RestedXP import window in game.

No file or original BattleTag needs to be entered for this flow. Guide packs are loaded directly from the public [mkccl/restedxp-reencrypt](https://github.com/mkccl/restedxp-reencrypt) repository, pinned to source commit `d5d4816ca0f33279da3d51f0e271e9d90ff3b669`. They are not copied into this repository.

Your BattleTag is only used by the local Web Worker. It is not included in any network request, query string, browser storage, or analytics event. The source repository receives a normal request for the selected guide pack.

## Advanced tools

Open **Advanced tools** to decrypt your own export, read the plain-text guides, download a guide as TXT or all guides as ZIP, and re-encrypt them for another BattleTag.

The original BattleTag is required when decrypting your own file. This tool does not recover unknown BattleTags. Decrypted content is displayed as text and is never executed.

## Deployment

Website: https://nebelhorn91.github.io/rxp4all/

The included GitHub Actions workflow publishes `dist/` whenever changes are pushed to `main`. There are no build dependencies to install. **Settings → Pages → Source → GitHub Actions** is the recommended publishing configuration.

The repository root also contains a redirect and `.nojekyll` marker for compatibility with Pages deployments from the `main` branch root. Asset paths are relative, so the same static website works at the site root or at `/dist/`.

## Format support

Supports the encrypted `:` blocks implemented by the reference project: Base64, BattleTag-derived RC4, zlib, Adler-32 checksums, and a version suffix. Other block modes are rejected explicitly. The default export version is `40000` if no suffix is present.

Limits: 20 MiB import text, 64 MiB decompressed content, and 5,000 guides. A current browser with module Web Workers, `CompressionStream`, and `DecompressionStream` is required.

## Validation

Run `npm run check` to check JavaScript syntax. The deployment workflow also runs this check before publishing.

The advanced implementation was checked against the reference decoder using an export with 869 guides. Re-encryption, Unicode BattleTags, multi-block files, signed checksums, incorrect BattleTags, damaged files, and ZIP contents were verified.

The generator was checked with all three actual source packs: Midnight (869 guides), TBC (263 guides), and WotLK (97 guides). Each generated code decodes to the same contents using the original reference decoder. Invalid inputs, source-network failures, caching, and omission of BattleTags from network requests were also checked.

## Attribution

The export format, guide-pack metadata, and BattleTag key derivation follow the user-selected reference project [mkccl/restedxp-reencrypt](https://github.com/mkccl/restedxp-reencrypt), specifically `lib/rxp-crypto.ts` and `lib/guides.ts` at commit `d5d4816ca0f33279da3d51f0e271e9d90ff3b669`.

The interface, native stream processing, Web Worker integration, validation, and ZIP export are implemented independently.
