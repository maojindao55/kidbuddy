import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTsModule(url) {
  const source = await readFile(url, 'utf8');
  const compiled = ts.transpileModule(`${source}\n// cache-bust:${Date.now()}:${Math.random()}`, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
}

const { A4_HEIGHT_PT, A4_WIDTH_PT, buildA4JpegPdf } = await importTsModule(new URL('./pdfBuilder.ts', import.meta.url));

const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);

assert.throws(() => buildA4JpegPdf([]), /至少需要一页/);

for (const count of [1, 3]) {
  const pages = Array.from({ length: count }, (_, idx) => ({
    jpegBytes: fakeJpeg,
    width: 1240 + idx,
    height: 1754 + idx,
  }));
  const bytes = buildA4JpegPdf(pages);
  const latin1 = Buffer.from(bytes).toString('latin1');

  assert.ok(latin1.startsWith('%PDF-1.4\n'), 'PDF header present');
  assert.ok(latin1.endsWith('%%EOF\n'), 'PDF EOF marker present');
  assert.match(latin1, new RegExp(`/Count ${count}\\b`), `page count ${count}`);
  assert.ok(latin1.includes(`/MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}]`), 'uses A4 MediaBox');
  assert.ok(latin1.includes('/Filter /DCTDecode'), 'embeds JPEG via DCTDecode');

  // Verify every xref byte offset resolves directly to `<id> 0 obj`
  const startxrefMatch = latin1.match(/startxref\n(\d+)\n%%EOF/);
  assert.ok(startxrefMatch, 'has startxref');
  const xrefOffset = Number(startxrefMatch[1]);
  assert.equal(latin1.slice(xrefOffset, xrefOffset + 5), 'xref\n', 'startxref points cleanly to xref table');

  const nEntries = Array.from(latin1.slice(xrefOffset).matchAll(/^(\d{10}) 00000 n $/gm));
  assert.equal(nEntries.length, 2 + count * 3, 'all object entries listed in xref');
  nEntries.forEach((m, idx) => {
    const off = Number(m[1]);
    const expectedPrefix = `${idx + 1} 0 obj\n`;
    assert.equal(latin1.slice(off, off + expectedPrefix.length), expectedPrefix, `xref offset for obj ${idx + 1}`);
  });
}

console.log('pdfBuilder.test.mjs: ok');
