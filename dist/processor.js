import {decryptExport, encryptGuides, normalizeTag, MAX_INPUT} from './crypto.js';
import {GUIDE_PACKS} from './guide-packs.js';
let decoded = null;
const cachedPacks = new Map();
self.addEventListener('message', async ({data}) => {
  try {
    let result;
    if (data.action === 'generate') {
      const tag = normalizeTag(data.tag);
      const pack = GUIDE_PACKS.find(pack => pack.id === data.packId);
      if (!pack) throw new Error('Please choose a supported guide pack.');
      let source = cachedPacks.get(pack.id);
      if (!source) {
        self.postMessage({id:data.id,type:'progress',progress:{stage:'loading'}});
        let response;
        try { response = await fetch(pack.url, {credentials:'omit',referrerPolicy:'no-referrer',cache:'force-cache'}); }
        catch { throw new Error('The guide pack could not be loaded. Check your connection and try again.'); }
        if (!response.ok) throw new Error(`The guide pack could not be loaded (HTTP ${response.status}). Please try again later.`);
        const raw = await response.text();
        if (raw.length > MAX_INPUT) throw new Error('The guide pack is too large.');
        self.postMessage({id:data.id,type:'progress',progress:{stage:'generating'}});
        source = await decryptExport(raw, pack.sourceTag);
        cachedPacks.clear();
        cachedPacks.set(pack.id, source);
      }
      self.postMessage({id:data.id,type:'progress',progress:{stage:'generating'}});
      const output = await encryptGuides(source.guides,tag,source.version);
      result = {output,tag,packId:pack.id,packName:pack.name,guideCount:source.guides.length,version:source.version};
    } else if (data.action === 'decrypt') {
      decoded = null;
      decoded = await decryptExport(data.raw, data.tag, progress => self.postMessage({id: data.id, type: 'progress', progress}));
      result = decoded;
    } else if (data.action === 'encrypt') {
      if (!decoded) throw new Error('Please decrypt the guide first.');
      result = {output: await encryptGuides(decoded.guides, data.tag, decoded.version)};
    } else { throw new Error('Unknown action.'); }
    self.postMessage({id: data.id, type: 'result', result});
  } catch (error) { self.postMessage({id: data.id, type: 'error', error: error instanceof Error ? error.message : 'Processing failed.'}); }
});
