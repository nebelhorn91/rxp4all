// Minimal, uncompressed ZIP writer with UTF-8 filenames and CRC-32.
const crcTable = Uint32Array.from({length: 256}, (_, value) => {
  let crc = value;
  for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function safeFilename(name) {
  const result = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 100);
  return result || 'guide';
}
export function guideTitle(text, index) {
  const match = text.match(/^\s*#name\s+(.+)$/m);
  return match ? match[1].trim() : `Guide ${index + 1}`;
}
export function makeGuideZip(guides) {
  const encoder = new TextEncoder();
  const locals = [], central = [];
  let offset = 0, centralSize = 0;
  guides.forEach((guide, index) => {
    const filename = `${String(index+1).padStart(3,'0')}_${safeFilename(guideTitle(guide,index))}.txt`;
    const name = encoder.encode(filename), bytes = encoder.encode(guide), crc = crc32(bytes);
    const header = new Uint8Array(30 + name.length), local = new DataView(header.buffer);
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(12, 33, true); local.setUint32(14, crc, true);
    local.setUint32(18, bytes.length, true); local.setUint32(22, bytes.length, true); local.setUint16(26, name.length, true);
    header.set(name, 30); locals.push(header, bytes);
    const entry = new Uint8Array(46 + name.length), directory = new DataView(entry.buffer);
    directory.setUint32(0, 0x02014b50, true); directory.setUint16(4, 20, true); directory.setUint16(6, 20, true); directory.setUint16(8, 0x0800, true);
    directory.setUint16(14, 33, true); directory.setUint32(16, crc, true);
    directory.setUint32(20, bytes.length, true); directory.setUint32(24, bytes.length, true); directory.setUint16(28, name.length, true); directory.setUint32(42, offset, true);
    entry.set(name, 46); central.push(entry); centralSize += entry.length; offset += header.length + bytes.length;
  });
  const footer = new Uint8Array(22), end = new DataView(footer.buffer);
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, guides.length, true); end.setUint16(10, guides.length, true); end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  return new Blob([...locals, ...central, footer], {type: 'application/zip'});
}
