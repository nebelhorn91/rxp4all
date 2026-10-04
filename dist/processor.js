import {decryptExport, encryptGuides, normalizeTag} from './crypto.js';
import {GUIDE_PACKS} from './guide-packs.js';
import {loadGuidePack} from './guide-source.js';
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
        source = await loadGuidePack(pack,progress=>self.postMessage({id:data.id,type:'progress',progress}));
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
