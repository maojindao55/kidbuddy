/**
 * 轻量级纯 TypeScript PDF 1.4 A4 图片页面构建器（零第三方依赖）。
 * 将每页渲染好的 A4 JPEG Canvas 直接封包为可打印的 PDF 文件。
 */

export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;

export interface PdfJpegPage {
  jpegBytes: Uint8Array;
  width: number;
  height: number;
}

export function buildA4JpegPdf(pages: PdfJpegPage[]): Uint8Array {
  if (!pages.length) {
    throw new Error('至少需要一页内容才能导出 PDF');
  }

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let byteLen = 0;

  const pushBytes = (bytes: Uint8Array) => {
    parts.push(bytes);
    byteLen += bytes.length;
  };
  const pushAscii = (text: string) => {
    pushBytes(encoder.encode(text));
  };

  pushAscii('%PDF-1.4\n');
  pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const pageCount = pages.length;
  const totalObjects = 2 + pageCount * 3;
  const offsets = new Array<number>(totalObjects + 1).fill(0);

  const pageRefs: string[] = [];
  for (let i = 0; i < pageCount; i += 1) {
    pageRefs.push(`${3 + i * 3} 0 R`);
  }

  // Object 1: Catalog
  offsets[1] = byteLen;
  pushAscii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  offsets[2] = byteLen;
  pushAscii(`2 0 obj\n<< /Type /Pages /Kids [ ${pageRefs.join(' ')} ] /Count ${pageCount} >>\nendobj\n`);

  // Objects 3..N: Page + Image XObject + Content stream per page
  for (let i = 0; i < pageCount; i += 1) {
    const p = pages[i];
    const pageObj = 3 + i * 3;
    const imgObj = pageObj + 1;
    const contentObj = pageObj + 2;

    offsets[pageObj] = byteLen;
    pushAscii(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] /Resources << /XObject << /Im0 ${imgObj} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`,
    );

    const w = Math.max(1, Math.round(p.width));
    const h = Math.max(1, Math.round(p.height));
    offsets[imgObj] = byteLen;
    pushAscii(
      `${imgObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.length} >>\nstream\n`,
    );
    pushBytes(p.jpegBytes);
    pushAscii('\nendstream\nendobj\n');

    const streamBody = `q\n${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm\n/Im0 Do\nQ\n`;
    const streamBytes = encoder.encode(streamBody);
    offsets[contentObj] = byteLen;
    pushAscii(`${contentObj} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
    pushBytes(streamBytes);
    pushAscii('endstream\nendobj\n');
  }

  const xrefOffset = byteLen;
  pushAscii(`xref\n0 ${totalObjects + 1}\n`);
  pushAscii('0000000000 65535 f \n');
  for (let objId = 1; objId <= totalObjects; objId += 1) {
    pushAscii(`${String(offsets[objId]).padStart(10, '0')} 00000 n \n`);
  }

  pushAscii(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(byteLen);
  let pos = 0;
  for (const chunk of parts) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}
