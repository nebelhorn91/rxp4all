import {MAX_INPUT, normalizeTag} from './crypto.js';
import {makeGuideZip, guideTitle, safeFilename} from './zip.js';

const $ = id => document.getElementById(id);
const state = {mode:'file', fileRaw:'', fileName:'', decoded:null, selected:0, encrypted:null, busy:false, fileSequence:0, jobSequence:0};
let worker = null, pending = null, requestId = 0, toastTimer;
const byteFormat = n => new Intl.NumberFormat('en-US', {maximumFractionDigits:1}).format(n / (n >= 1048576 ? 1048576 : 1024)) + (n >= 1048576 ? ' MiB' : ' KiB');

function showError(message) { $('error').textContent = message; $('error').hidden = false; }
function clearError() { $('error').hidden = true; $('error').textContent = ''; }
function notify(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3000); }
function setBusy(busy, action = 'decrypt') {
  state.busy = busy;
  $('decrypt-button').disabled = busy;
  $('encrypt-button').disabled = busy || !state.decoded;
  $('target-tag').disabled = busy;
  $('processing').hidden = !busy;
  $('processing-label').textContent = action === 'encrypt' ? 'Creating new import file …' : 'Decrypting file …';
  $('decrypt-label').textContent = busy && action === 'decrypt' ? 'Decrypting …' : 'Decrypt';
  document.querySelector('.output-panel').setAttribute('aria-busy', String(busy && action === 'decrypt'));
}
function stopWorker() {
  if (worker) { worker.terminate(); worker = null; }
  if (pending) { pending.reject(new DOMException('Processing cancelled.', 'AbortError')); pending = null; }
}
function invalidate() {
  state.jobSequence++;
  stopWorker();
  state.decoded = null; state.encrypted = null;
  $('decoded-output').hidden = true; $('encrypted-output').hidden = true; $('result-badge').hidden = true; $('empty-output').hidden = false;
  $('guide-preview').textContent = ''; $('guide-select').replaceChildren();
  clearError(); setBusy(false);
}
function useMode(mode) {
  if (!['file','text'].includes(mode) || state.mode === mode) return;
  invalidate(); state.mode = mode;
  for (const name of ['file','text']) {
    $('tab-'+name).classList.toggle('active', name === mode);
    $('tab-'+name).setAttribute('aria-selected', String(name === mode));
    $('tab-'+name).tabIndex = name === mode ? 0 : -1;
    $(name+'-panel').hidden = name !== mode;
  }
}

async function readFile(file) {
  if (!file) return;
  const sequence = ++state.fileSequence;
  invalidate(); state.fileRaw = ''; state.fileName = '';
  $('file-label').textContent = 'Choose a guide file'; $('file-hint').textContent = 'or drop it here · .txt up to 20 MiB'; $('file-picker').classList.remove('has-file');
  if (file.size > MAX_INPUT) return showError('The file is too large (maximum 20 MiB).');
  if (file.size === 0) return showError('The selected file is empty.');
  try {
    const raw = await file.text();
    if (sequence !== state.fileSequence) return;
    state.fileRaw = raw; state.fileName = file.name;
    $('file-label').textContent = file.name; $('file-hint').textContent = `${byteFormat(file.size)} · Click to change`;
    $('file-picker').classList.add('has-file');
    const tag = file.name.match(/!([^!]+?#\d+)(?:\s*\(\d+\))?\.txt$/i);
    $('source-tag').value = tag ? tag[1].trim() : '';
  } catch { if (sequence === state.fileSequence) showError('The file could not be read. Please select it again.'); }
}

function process(action, args) {
  if (pending) return Promise.reject(new Error('Please wait for the current operation to finish.'));
  if (!worker) {
    try { worker = new Worker(new URL('./processor.js', import.meta.url), {type:'module'}); }
    catch { return Promise.reject(new Error('Processing could not be started. Please use an up-to-date browser.')); }
    worker.addEventListener('message', ({data}) => {
      if (!pending || pending.id !== data.id) return;
      if (data.type === 'progress') {
        const {completed,total} = data.progress;
        $('processing-label').textContent = total > 1 ? `Decrypted ${completed} of ${total} blocks …` : 'Decrypting file …';
        return;
      }
      const current = pending; pending = null;
      if (data.type === 'error') current.reject(new Error(data.error)); else current.resolve(data.result);
    });
    worker.addEventListener('error', event => {
      event.preventDefault();
      const current = pending; pending = null; worker?.terminate(); worker = null;
      current?.reject(new Error('Local processing was interrupted. Please decrypt the file again.'));
    });
  }
  return new Promise((resolve,reject) => { const id = ++requestId; pending = {id,resolve,reject}; worker.postMessage({id,action,...args}); });
}
function renderPreview() {
  if (!state.decoded) return;
  const guide = state.decoded.guides[state.selected];
  $('guide-preview').textContent = guide.slice(0,120000);
  $('preview-note').hidden = guide.length <= 120000;
  $('preview-title').textContent = safeFilename(guideTitle(guide,state.selected))+'.txt';
  $('guide-preview').scrollTop = 0; $('guide-preview').scrollLeft = 0;
}
function renderDecoded() {
  const result = state.decoded;
  $('guide-count').textContent = result.guides.length;
  $('guide-noun').textContent = result.guides.length === 1 ? 'Guide' : 'Guides';
  $('version').textContent = result.version; $('result-size').textContent = byteFormat(result.byteCount);
  const fragment = document.createDocumentFragment();
  result.guides.forEach((guide,index) => { const option = document.createElement('option'); option.value = index; option.textContent = `${String(index+1).padStart(2,'0')} · ${guideTitle(guide,index)}`; fragment.append(option); });
  $('guide-select').replaceChildren(fragment); state.selected = 0; renderPreview();
  $('empty-output').hidden = true; $('decoded-output').hidden = false; $('result-badge').hidden = false;
}
async function decrypt() {
  if (state.busy) throw new Error('Please wait for the current operation to finish.');
  clearError();
  const raw = state.mode === 'file' ? state.fileRaw : $('import-text').value;
  const tag = normalizeTag($('source-tag').value);
  if (!raw.trim()) throw new Error('Choose a file or paste an import text first.');
  invalidate(); $('source-tag').value = tag; setBusy(true);
  const job = state.jobSequence;
  try {
    const result = await process('decrypt', {raw,tag});
    state.decoded = result; renderDecoded(); notify(`${result.guides.length} ${result.guides.length===1?'Guide':'Guides'} decrypted.`);
    return {guideCount:result.guides.length,version:result.version,byteCount:result.byteCount};
  } finally { if (job === state.jobSequence) setBusy(false); }
}
async function encrypt() {
  if (state.busy) throw new Error('Please wait for the current operation to finish.');
  clearError();
  if (!state.decoded) throw new Error('Please decrypt the export first.');
  const tag = normalizeTag($('target-tag').value);
  state.encrypted = null; $('encrypted-output').hidden = true; $('target-tag').value = tag; setBusy(true,'encrypt');
  const job = state.jobSequence;
  try {
    const result = await process('encrypt', {tag});
    state.encrypted = {output:result.output,tag};
    $('encrypted-details').textContent = `For ${tag} · ${state.decoded.guides.length} ${state.decoded.guides.length===1?'Guide':'Guides'} · Version ${state.decoded.version}`;
    $('encrypted-output').hidden = false; notify('New import file created.');
    return {targetTag:tag,guideCount:state.decoded.guides.length,version:state.decoded.version,importFileReady:true};
  } finally { if (job === state.jobSequence) setBusy(false); }
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),30000);
}
async function copy(text) {
  try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(text); notify('Copied to clipboard.'); }
  catch { showError('Copying is unavailable in this browser. You can download the file instead.'); }
}
function report(error) { if (error?.name !== 'AbortError') showError(error instanceof Error ? error.message : 'Processing failed.'); }

for (const mode of ['file','text']) {
  $('tab-'+mode).addEventListener('click', () => useMode(mode));
  $('tab-'+mode).addEventListener('keydown', event => {
    if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault(); const next = event.key==='Home'?'file':event.key==='End'?'text':state.mode==='file'?'text':'file'; useMode(next); $('tab-'+next).focus();
    }
  });
}
$('file-picker').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', event => { void readFile(event.target.files[0]); event.target.value=''; });
$('file-picker').addEventListener('dragover', event => { event.preventDefault(); $('file-picker').classList.add('dragover'); });
$('file-picker').addEventListener('dragleave', () => $('file-picker').classList.remove('dragover'));
$('file-picker').addEventListener('drop', event => { event.preventDefault(); $('file-picker').classList.remove('dragover'); const file=event.dataTransfer.files[0]; void readFile(file); });
$('import-text').addEventListener('input', invalidate);
$('source-tag').addEventListener('input', invalidate);
$('target-tag').addEventListener('input', () => { state.encrypted=null; $('encrypted-output').hidden=true; clearError(); });
$('decrypt-form').addEventListener('submit', event => { event.preventDefault(); void decrypt().catch(report); });
$('encrypt-form').addEventListener('submit', event => { event.preventDefault(); void encrypt().catch(report); });
$('guide-select').addEventListener('change', () => { state.selected=Number($('guide-select').value); renderPreview(); });
$('copy-guide').addEventListener('click', () => { if(state.decoded) void copy(state.decoded.guides[state.selected]); });
$('download-guide').addEventListener('click', () => { if(state.decoded) download(new Blob([state.decoded.guides[state.selected]],{type:'text/plain;charset=utf-8'}),safeFilename(guideTitle(state.decoded.guides[state.selected],state.selected))+'.txt'); });
$('download-zip').addEventListener('click', () => { if(state.decoded) download(makeGuideZip(state.decoded.guides),'restedxp_decrypted_guides.zip'); });
$('copy-export').addEventListener('click', () => { if(state.encrypted) void copy(state.encrypted.output); });
$('download-export').addEventListener('click', () => { if(state.encrypted) download(new Blob([state.encrypted.output],{type:'text/plain;charset=utf-8'}),`guide_${safeFilename(state.encrypted.tag.replace('#','_'))}.txt`); });
window.addEventListener('pagehide',stopWorker);

// WebMCP shares the same validation, controls and actions as the visible UI.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    {name:'decrypt_guide_export',title:'Decrypt a RestedXP export',description:'Decrypt an import text using the original BattleTag and display the guides in the interface. Does not upload any file.',inputSchema:{type:'object',properties:{importText:{type:'string'},sourceTag:{type:'string'}},required:['importText','sourceTag'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input){if(!input || typeof input.importText!=='string' || !input.importText.trim() || input.importText.length>MAX_INPUT) throw new Error('A valid import text is required.');const tag=normalizeTag(input.sourceTag);if(state.busy) throw new Error('Please wait for the current operation to finish.');useMode('text');invalidate();$('import-text').value=input.importText;$('source-tag').value=tag;try{return await decrypt();}catch(error){report(error);throw error;}}},
    {name:'reencrypt_guide_export',title:'Re-encrypt a RestedXP export',description:'Create an import file from the currently displayed decrypted guides for the destination BattleTag. Shows download and copy controls without starting a download.',inputSchema:{type:'object',properties:{targetTag:{type:'string'}},required:['targetTag'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){const tag=normalizeTag(input?.targetTag);if(state.busy) throw new Error('Please wait for the current operation to finish.');if(!state.decoded) throw new Error('Please decrypt the export first.');$('target-tag').value=tag;try{return await encrypt();}catch(error){report(error);throw error;}}}
  ];
  for (const tool of tools) { try { void Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{}); } catch {} }
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
