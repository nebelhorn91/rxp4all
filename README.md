# RXP4ALL

A browser-only workbench for decrypting RestedXP export files, reading the plain-text guides, downloading them, and re-encrypting them for a different BattleTag.

Files and BattleTags are processed entirely on your device. There is no server API, analytics, tracking, or saved browser state. Decrypted content is displayed as text and is never executed.

## Use

1. Choose an export `.txt` file or paste the complete import text.
2. Enter the original BattleTag, including its `#number`.
3. Click **Decrypt** to read the guides. Download a single guide as TXT or all guides as ZIP.
4. Optionally enter a destination BattleTag and click **Re-encrypt** to create a new import file.

The original BattleTag is required. This tool does not recover unknown BattleTags and does not include any bundled guide packs.

## GitHub Pages

The included workflow publishes `dist/` whenever changes are pushed to `main`. There are no build dependencies to install.

For the initial deployment, open **Settings → Pages** and select **GitHub Actions** under **Build and deployment → Source**. Then run **Deploy GitHub Pages** from the **Actions** tab if the initial run has already failed.

Expected site URL: https://nebelhorn91.github.io/rxp4all/

All asset paths are relative, so the site also works under GitHub Pages project paths. The same `dist/` directory can be served by any static HTTPS host.

## Format support

Supports the encrypted `:` blocks implemented by [mkccl/restedxp-reencrypt](https://github.com/mkccl/restedxp-reencrypt): Base64, BattleTag-derived RC4, zlib, Adler-32 checksums, and a version suffix. Other block modes are rejected explicitly. The default export version is `40000` if no suffix is present.

Limits: 20 MiB import text, 64 MiB decompressed content, and 5,000 guides. A current browser with module Web Workers, `CompressionStream`, and `DecompressionStream` is required.

## Validation

Run `npm run check` to check JavaScript syntax. The deployment workflow also runs this check before publishing.

The implementation was checked against the reference project's decoder using an export with 869 guides. Re-encryption, Unicode BattleTags, multi-block files, signed checksums, incorrect BattleTags, damaged files, and ZIP contents were verified.

## Attribution

The export format and BattleTag key derivation follow the user-selected reference project [mkccl/restedxp-reencrypt](https://github.com/mkccl/restedxp-reencrypt), specifically `lib/rxp-crypto.ts` at commit `d5d4816ca0f33279da3d51f0e271e9d90ff3b669`.

The interface, native stream processing, Web Worker integration, validation, and ZIP export are implemented independently.
