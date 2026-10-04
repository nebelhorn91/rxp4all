import {normalizeTag} from './crypto.js';
import {GUIDE_PACKS} from './guide-packs.js';

const $ = id => document.getElementById(id);
let worker = null, pending = null, requestId = 0, revision = 0, busy = false, output = null, toastTimer;
const lifecycle = new AbortController();

function showError(message) { $('generator-error').textContent=message; $('generator-error').hidden=false; }
function clearError() { $('generator-error').hidden=true; $('generator-error').textContent=''; }
function setBusy(value) {
  busy=value; $('generate-button').disabled=value; $('generator-loading').hidden=!value;
  $('generate-label').textContent=value?'Generating …':'Generate import code';
  $('generator-card').setAttribute('aria-busy',String(value));
}
function notify(message) { clearTimeout(toastTimer); $('generator-toast').textContent=message; $('generator-toast').hidden=false; toastTimer=setTimeout(()=>{$('generator-toast').hidden=true;},3000); }
function stopWorker() {
  worker?.terminate(); worker=null;
  if(pending){const current=pending;pending=null;current.reject(new DOMException('Generation cancelled.','AbortError'));}
}
function invalidate() {
  revision++; stopWorker(); output=null; clearError(); setBusy(false);
  $('generator-result').hidden=true; $('import-code').value=''; $('result-meta').textContent='';
}
function selectedPack() { return GUIDE_PACKS.find(pack=>pack.id===$('guide-pack').value); }
function refreshPackLabel() {
  const pack=selectedPack();
  $('pack-levels').textContent=pack?.levels??'';
  $('pack-note').textContent=pack?.note??'';$('pack-note').hidden=!pack?.note;
  $('source-repository').textContent=pack?.sourceName??'restedxp-reencrypt';
  $('source-repository').href=pack?.sourceUrl??'https://github.com/mkccl/restedxp-reencrypt';
  $('pack-attribution').hidden=!pack?.attribution;
  if(pack?.attribution){
    $('guide-creator').textContent=pack.attribution.creator;
    $('guide-license').textContent=pack.attribution.license;
    $('guide-license').href=pack.attribution.licenseUrl;
  }
}
function process(tag,packId) {
  if(pending) return Promise.reject(new Error('Please wait for the current operation to finish.'));
  if(!worker){
    try{worker=new Worker(new URL('./processor.js',import.meta.url),{type:'module'});}
    catch{return Promise.reject(new Error('Generation could not be started. Please use an up-to-date browser.'));}
    worker.addEventListener('message',({data})=>{
      if(!pending||pending.id!==data.id)return;
      if(data.type==='progress'){
        $('loading-label').textContent=data.progress.stage==='loading'?'Loading guide pack …':'Preparing your import code …';return;
      }
      const current=pending;pending=null;
      if(data.type==='error')current.reject(new Error(data.error));else current.resolve(data.result);
    });
    worker.addEventListener('error',event=>{
      event.preventDefault();const current=pending;pending=null;worker?.terminate();worker=null;
      current?.reject(new Error('Generation was interrupted. Please try again.'));
    });
  }
  return new Promise((resolve,reject)=>{const id=++requestId;pending={id,resolve,reject};worker.postMessage({id,action:'generate',tag,packId});});
}
async function generate() {
  if(busy)throw new Error('Please wait for the current operation to finish.');
  clearError();
  const tag=normalizeTag($('battle-tag').value),pack=selectedPack();
  if(!pack)throw new Error('Please choose a supported guide pack.');
  output=null; $('generator-result').hidden=true; $('import-code').value='';
  $('battle-tag').value=tag;setBusy(true);const currentRevision=revision;
  try{
    const result=await process(tag,pack.id);
    if(currentRevision!==revision)throw new DOMException('Generation cancelled.','AbortError');
    output=result;$('import-code').value=result.output;
    $('result-meta').textContent=`${result.packName} · ${result.guideCount} guides · For ${result.tag}`;
    $('generator-result').hidden=false;notify('Your import code is ready.');
    return {pack:result.packId,battleTag:result.tag,guideCount:result.guideCount,version:result.version,importCodeReady:true};
  }finally{if(currentRevision===revision)setBusy(false);}
}
function report(error){if(error?.name!=='AbortError')showError(error instanceof Error?error.message:'Generation failed.');}
function selectCode(){if(!output)return;$('import-code').focus();$('import-code').select();$('import-code').setSelectionRange(0,$('import-code').value.length);}
async function copyCode(){
  if(!output)return;
  try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(output.output);notify('Import code copied.');}
  catch{selectCode();showError('Automatic copying is unavailable. The full code is selected: copy it manually, or download the file.');}
}
function downloadCode(){
  if(!output)return;
  const blob=new Blob([output.output],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  const tag=output.tag.replace(/[^\p{L}\p{N}_.-]/gu,'_');
  anchor.href=url;anchor.download=`${output.packId}_guide_${tag}.txt`;document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
for(const pack of GUIDE_PACKS){const option=document.createElement('option');option.value=pack.id;option.textContent=pack.label;$('guide-pack').append(option);}
refreshPackLabel();
$('generate-form').addEventListener('submit',event=>{event.preventDefault();void generate().catch(report);});
$('battle-tag').addEventListener('input',invalidate);
$('guide-pack').addEventListener('change',()=>{invalidate();refreshPackLabel();});
$('copy-code').addEventListener('click',()=>{void copyCode();});
$('download-code').addEventListener('click',downloadCode);
$('import-code').addEventListener('click',selectCode);
window.addEventListener('pagehide',()=>{stopWorker();lifecycle.abort();});

if(document.modelContext?.registerTool){
  const tool={name:'generate_restedxp_import_code',title:'Generate a RestedXP import code',description:'Generate and display a copyable import code for the selected guide pack and destination BattleTag. Loads the guide pack from the public source repository; the BattleTag stays local. Does not copy to the clipboard or start a download.',inputSchema:{type:'object',properties:{battleTag:{type:'string'},packId:{type:'string',enum:GUIDE_PACKS.map(pack=>pack.id)}},required:['battleTag','packId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input){const tag=normalizeTag(input?.battleTag);if(!GUIDE_PACKS.some(pack=>pack.id===input?.packId))throw new Error('Please choose a supported guide pack.');if(busy)throw new Error('Please wait for the current operation to finish.');invalidate();$('battle-tag').value=tag;$('guide-pack').value=input.packId;refreshPackLabel();try{return await generate();}catch(error){report(error);throw error;}}};
  try{void Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
}
