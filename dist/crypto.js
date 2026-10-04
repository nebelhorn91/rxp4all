// Format / key derivation reference: mkccl/restedxp-reencrypt, lib/rxp-crypto.ts.
// These functions do not evaluate the decrypted contents.
export const MAX_INPUT = 20 * 1024 * 1024;
export const MAX_PLAINTEXT = 64 * 1024 * 1024;
export const MAX_GUIDES = 5000;
const encoder = new TextEncoder();

export function normalizeTag(value) {
  if (typeof value !== 'string') throw new Error('Please enter a BattleTag.');
  const tag = value.trim();
  if (!/^[^\s#]+#\d+$/.test(tag) || tag.length > 100) {
    throw new Error('Please enter the complete BattleTag, for example Player#1234.');
  }
  return tag;
}

export function deriveKey(tag) {
  let bytes = encoder.encode(tag.toLowerCase());
  bytes = bytes.slice(-16);
  const buffer = new Uint8Array(16);
  const padding = 16 - bytes.length;
  for (let i = 0; i < 16; i++) {
    const j = (i - padding) & 15;
    if (j < bytes.length) buffer[i] = bytes[j];
  }
  for (let i = 0; i < 16; i++) {
    buffer[(-i) & 15] = buffer[(15-i)&15] ^ buffer[(13-i)&15] ^ buffer[(12-i)&15] ^ buffer[(10-i)&15];
  }
  return buffer;
}

export function rc4(key, data) {
  const state = Uint8Array.from({length: 256}, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + state[i] + key[i % key.length]) & 255;
    [state[i], state[j]] = [state[j], state[i]];
  }
  const result = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + state[i]) & 255;
    [state[i], state[j]] = [state[j], state[i]];
    result[k] = data[k] ^ state[(state[i] + state[j]) & 255];
  }
  return result;
}

export function adler32(data) {
  let a = 1, b = 0;
  for (let offset = 0; offset < data.length; offset += 5552) {
    const end = Math.min(offset + 5552, data.length);
    for (let i = offset; i < end; i++) { a += data[i]; b += a; }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function decode64(content) {
  try { return Uint8Array.from(atob(content), c => c.charCodeAt(0)); }
  catch { throw new Error('The import text contains invalid Base64 data.'); }
}

function encode64(bytes) {
  const pieces = [];
  for (let i = 0; i < bytes.length; i += 16384) pieces.push(String.fromCharCode(...bytes.subarray(i, i+16384)));
  return btoa(pieces.join(''));
}

async function compress(data) {
  if (typeof CompressionStream === 'undefined') throw new Error('This browser does not support compression. Please use an up-to-date browser.');
  return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
}

async function decompress(data, remaining) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser does not support decryption. Please use an up-to-date browser.');
  const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const parts = [];
  let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > remaining) {
        await reader.cancel().catch(() => {});
        throw new Error('The decompressed content is too large (maximum 64 MiB).');
      }
      parts.push(value);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('64 MiB')) throw error;
    throw new Error('Decryption failed. Check the original BattleTag. The file may also be damaged.');
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

export async function decryptExport(raw, tag, onProgress = () => {}) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Please choose a file or paste an import text.');
  if (raw.length > MAX_INPUT) throw new Error('The file is too large (maximum 20 MiB).');
  const key = deriveKey(normalizeTag(tag));
  let body = raw.replace(/^\uFEFF/, '').replace(/\s+/g, '');
  let version = 40000;
  const suffix = body.match(/\|(\d+)$/);
  if (suffix) { version = Number(suffix[1]); body = body.slice(0, -suffix[0].length); }
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('The export version is invalid.');
  let expectedCount = null;
  const prefix = body.match(/^(\d+)\|/);
  if (prefix) {
    expectedCount = Number(prefix[1]);
    if (!Number.isSafeInteger(expectedCount) || expectedCount < 1 || expectedCount > MAX_GUIDES) throw new Error('The guide count is invalid or too large.');
    body = body.slice(prefix[0].length);
  }
  const pattern = /(-?\d+)([^\d])([A-Za-z0-9+/]+={0,2})%/y;
  const chunks = [];
  let position = 0;
  while (position < body.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(body);
    if (!match) throw new Error('This is not a supported RestedXP import text, or the file is incomplete.');
    if (match[2] !== ':') throw new Error('This file uses an unsupported block mode.');
    const checksum = Number(match[1]);
    if (!Number.isInteger(checksum) || checksum < -2147483648 || checksum > 4294967295) throw new Error('The checksum in the file is invalid.');
    chunks.push({checksum: checksum >>> 0, content: match[3]});
    if (chunks.length > MAX_GUIDES) throw new Error('The file contains too many blocks.');
    position = pattern.lastIndex;
  }
  if (!chunks.length) throw new Error('No encrypted guides were found in the file.');
  const guides = [];
  let byteCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    onProgress({completed: i, total: chunks.length});
    const chunk = chunks[i];
    const decrypted = rc4(key, decode64(chunk.content));
    const bytes = await decompress(decrypted, MAX_PLAINTEXT - byteCount);
    byteCount += bytes.length;
    if (adler32(bytes) !== chunk.checksum) throw new Error('The checksum does not match. The file is damaged, or the BattleTag is incorrect.');
    let text;
    try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
    catch { throw new Error('The decrypted content contains invalid UTF-8 text.'); }
    guides.push(...text.split('\0').filter(x => x.trim()));
    if (guides.length > MAX_GUIDES) throw new Error('The file contains too many guides (maximum 5000).');
  }
  if (!guides.length) throw new Error('The export contains no guide content.');
  if (expectedCount !== null && expectedCount !== guides.length) throw new Error('The guide count does not match the export. The file may be incomplete.');
  onProgress({completed: chunks.length, total: chunks.length});
  return {guides, version, byteCount, blockCount: chunks.length};
}

export async function encryptGuides(guides, tag, version) {
  const target = normalizeTag(tag);
  if (!Array.isArray(guides) || !guides.length || guides.some(x => typeof x !== 'string' || !x.trim() || x.includes('\0'))) throw new Error('No valid decrypted guides are available.');
  if (guides.length > MAX_GUIDES || !Number.isSafeInteger(version) || version < 0) throw new Error('Invalid export data.');
  const bytes = encoder.encode(guides.join('\0'));
  if (bytes.length > MAX_PLAINTEXT) throw new Error('The plain text is too large (maximum 64 MiB).');
  const compressed = await compress(bytes);
  const content = encode64(rc4(deriveKey(target), compressed));
  if (content.length > MAX_INPUT) throw new Error('The new export is too large (maximum 20 MiB).');
  return `${guides.length}|${adler32(bytes)}:${content}%|${version}`;
}
