import {decryptExport, MAX_INPUT, MAX_GUIDES} from './crypto.js';

const sourceError = () => new Error('The guide source has an unsupported or incomplete format.');

// Read Lua long-string literals without evaluating the surrounding Lua code.
function longString(raw, start) {
  const opening = /^\[(=*)\[/.exec(raw.slice(start));
  if (!opening) throw sourceError();
  const bodyStart = start + opening[0].length;
  const closing = `]${opening[1]}]`;
  const end = raw.indexOf(closing, bodyStart);
  if (end < 0) throw sourceError();
  return {text:raw.slice(bodyStart,end).replace(/^(?:\r\n|\n|\r)/,''),end:end+closing.length};
}

export function extractLuaGuides(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_INPUT) throw sourceError();
  const guides = [];
  const tokens = /--|\[(=*)\[|["']|\bRXPGuides\.RegisterGuide\s*\(/g;
  let token;
  while ((token = tokens.exec(raw))) {
    let position = tokens.lastIndex;
    if (token[0] === '--') {
      if (/^\[(=*)\[/.test(raw.slice(position))) position = longString(raw,position).end;
      else { const end = raw.indexOf('\n',position); position = end < 0 ? raw.length : end + 1; }
    } else if (token[1] !== undefined) {
      position = longString(raw,token.index).end;
    } else if (token[0] === '"' || token[0] === "'") {
      const quote = token[0];
      while (position < raw.length && raw[position] !== quote) {
        position += raw[position] === '\\' ? 2 : 1;
      }
      if (position >= raw.length) throw sourceError();
      position++;
    } else {
      while (/\s/.test(raw[position] ?? '') && position < raw.length) position++;
      const literal = longString(raw,position);
      position = literal.end;
      while (/\s/.test(raw[position] ?? '') && position < raw.length) position++;
      if (raw[position] !== ')') throw sourceError();
      const guide = literal.text;
      if (guide.includes('\0') || !/^#forever[ \t]*\r?$/m.test(guide) ||
          !/^#name[ \t]+\S/m.test(guide) || !/^#group[ \t]+\S/m.test(guide) ||
          !/^step\b/m.test(guide)) throw sourceError();
      guides.push(guide);
      if (guides.length > MAX_GUIDES) throw sourceError();
      position++;
    }
    tokens.lastIndex = position;
  }
  if (!guides.length) throw sourceError();
  return guides;
}

async function fetchText(url) {
  let response;
  try { response = await fetch(url, {credentials:'omit',referrerPolicy:'no-referrer',cache:'force-cache'}); }
  catch { throw new Error('The guide pack could not be loaded. Check your connection and try again.'); }
  if (!response.ok) throw new Error(`The guide pack could not be loaded (HTTP ${response.status}). Please try again later.`);
  const raw = await response.text();
  if (raw.length > MAX_INPUT) throw new Error('The guide pack is too large.');
  return raw;
}

export async function loadGuidePack(pack, onProgress = () => {}) {
  onProgress({stage:'loading'});
  if (pack.format !== 'lua') {
    const raw = await fetchText(pack.url);
    onProgress({stage:'generating'});
    return decryptExport(raw,pack.sourceTag);
  }
  const sources = await Promise.all(pack.urls.map(fetchText));
  if (sources.reduce((total,raw)=>total+raw.length,0) > MAX_INPUT) throw new Error('The guide pack is too large.');
  onProgress({stage:'generating'});
  const guides = sources.flatMap((raw,index)=> {
    const attribution = `\n-- Guides by ${pack.attribution.creator}\n-- Source: ${pack.urls[index]}\n-- License: ${pack.attribution.license} (${pack.attribution.licenseUrl})\n-- Original guide text retained; extracted and packaged as a BattleTag import code by RXP4ALL.\n`;
    return extractLuaGuides(raw).map(guide=>guide+attribution);
  });
  if (guides.length > MAX_GUIDES) throw new Error('The guide pack contains too many guides.');
  return {guides,version:pack.version};
}
