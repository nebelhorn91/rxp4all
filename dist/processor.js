import {decryptExport, encryptGuides} from './crypto.js';
let decoded = null;
self.addEventListener('message', async ({data}) => {
  try {
    let result;
    if (data.action === 'decrypt') {
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
