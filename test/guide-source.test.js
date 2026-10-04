import test from 'node:test';
import assert from 'node:assert/strict';
import {extractLuaGuides, loadGuidePack} from '../dist/guide-source.js';
import {decryptExport, encryptGuides} from '../dist/crypto.js';

const guide = '#forever\n#name Example route\n#group Example Forever\nstep\n    +Example\n';
const lua = text => `RXPGuides.RegisterGuide([[\n${text}]])`;

test('extracts literal guide text while ignoring Lua comments and other strings', () => {
  const source = `-- ${lua(guide)}\n--[=[${lua(guide)}]=]\nlocal example = [=[${lua(guide)}]=]\nlocal quote = "RXPGuides.RegisterGuide(\\\"fake\\\")"\n${lua(guide)}`;
  assert.deepEqual(extractLuaGuides(source),[guide]);
});

test('supports long-string delimiters and preserves Unicode, filters and guide metadata', () => {
  const text = guide.replace('Example route','Élf route')+'step << Horde !Mage\n    +Keep [[this]] text\n';
  assert.deepEqual(extractLuaGuides(`RXPGuides.RegisterGuide([=[\n${text}]=])`),[text]);
  assert.deepEqual(extractLuaGuides(lua(guide.replaceAll('\n','\r\n'))),[guide.replaceAll('\n','\r\n')]);
});

test('rejects incomplete sources and dynamic Lua expressions', () => {
  for (const source of [lua(guide).slice(0,-2),'RXPGuides.RegisterGuide(buildGuide())',lua(guide).replace(']])',']], other)'), '-- no guide']) {
    assert.throws(()=>extractLuaGuides(source),/unsupported or incomplete/);
  }
});

test('rejects guides for another game and invalid metadata', () => {
  for (const text of [guide.replace('#forever','#classic'),guide.replace('#name Example route',''),guide.replace('#group Example Forever',''),guide.replace('step',''),guide+'\0']) {
    assert.throws(()=>extractLuaGuides(lua(text)),/unsupported or incomplete/);
  }
});

const pack = {
  format:'lua', version:40000, urls:['https://example.invalid/a.lua','https://example.invalid/b.lua'],
  attribution:{creator:'Example author',license:'CC BY-NC-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-nc-sa/4.0/'}
};

test('loads all routes, retains provenance and creates an account-specific import code', async t => {
  const requests = [];
  t.mock.method(globalThis,'fetch',async (url,options)=> {
    requests.push({url,options});
    return new Response(lua(guide.replace('Example route',url.endsWith('a.lua')?'Alliance':'Horde')));
  });
  const stages = [];
  const source = await loadGuidePack(pack,progress=>stages.push(progress.stage));
  assert.equal(source.guides.length,2);
  assert.deepEqual(stages,['loading','generating']);
  for (const [index,text] of source.guides.entries()) {
    assert.ok(text.startsWith('#forever\n'));
    assert.ok(text.includes(pack.urls[index]));
    assert.ok(text.includes(pack.attribution.licenseUrl));
  }
  const tag = 'TestPlayer#5678';
  const output = await encryptGuides(source.guides,tag,source.version);
  assert.deepEqual((await decryptExport(output,tag)).guides,source.guides);
  await assert.rejects(decryptExport(output,'AnotherPlayer#1234'));
  assert.ok(requests.every(({url,options})=>!url.includes(tag)&&options.credentials==='omit'&&options.referrerPolicy==='no-referrer'));
});

test('fails the entire pack when a source is missing or damaged', async t => {
  const mockedFetch=t.mock.method(globalThis,'fetch',async url=>new Response(url.endsWith('a.lua')?lua(guide):'damaged'));
  await assert.rejects(loadGuidePack(pack),/unsupported or incomplete/);
  mockedFetch.mock.mockImplementation(async () => new Response('',{status:404}));
  await assert.rejects(loadGuidePack(pack),/HTTP 404/);
  mockedFetch.mock.mockImplementation(async () => { throw new TypeError('offline'); });
  await assert.rejects(loadGuidePack(pack),/connection/);
});

test('continues to decode the existing encrypted pack format', async t => {
  const output = await encryptGuides([guide],'Source#1234',40000);
  t.mock.method(globalThis,'fetch',async ()=>new Response(output));
  const source = await loadGuidePack({url:'https://example.invalid/export.txt',sourceTag:'Source#1234'});
  assert.deepEqual(source.guides,[guide]);
  assert.equal(source.version,40000);
});
