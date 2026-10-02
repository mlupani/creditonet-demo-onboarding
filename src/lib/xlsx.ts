// Escritor mínimo de .xlsx sin dependencias: una hoja de texto empaquetada en un zip sin compresión.

const TEXTO = new TextEncoder();

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function columna(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function zip(partes: [string, string][]): Uint8Array {
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let offset = 0;
  for (const [nombre, contenido] of partes) {
    const n = TEXTO.encode(nombre);
    const d = TEXTO.encode(contenido);
    const crc = crc32(d);
    const local = new Uint8Array(30 + n.length + d.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // nombres en UTF-8
    lv.setUint32(14, crc, true);
    lv.setUint32(18, d.length, true);
    lv.setUint32(22, d.length, true);
    lv.setUint16(26, n.length, true);
    local.set(n, 30);
    local.set(d, 30 + n.length);
    const central = new Uint8Array(46 + n.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, d.length, true);
    cv.setUint32(24, d.length, true);
    cv.setUint16(28, n.length, true);
    cv.setUint32(42, offset, true);
    central.set(n, 46);
    locales.push(local);
    centrales.push(central);
    offset += local.length;
  }
  const tamCentral = centrales.reduce((a, c) => a + c.length, 0);
  const fin = new Uint8Array(22);
  const fv = new DataView(fin.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, partes.length, true);
  fv.setUint16(10, partes.length, true);
  fv.setUint32(12, tamCentral, true);
  fv.setUint32(16, offset, true);
  const out = new Uint8Array(offset + tamCentral + 22);
  let p = 0;
  for (const bloque of [...locales, ...centrales, fin]) {
    out.set(bloque, p);
    p += bloque.length;
  }
  return out;
}

/** Libro .xlsx de una sola hoja; la primera fila se muestra en negrita. */
export function crearXlsx(hoja: string, filas: string[][]): Uint8Array {
  const xmlFilas = filas
    .map(
      (fila, r) =>
        `<row r="${r + 1}">` +
        fila
          .map((v, c) => `<c r="${columna(c)}${r + 1}" t="inlineStr"${r === 0 ? ' s="1"' : ""}><is><t>${esc(v)}</t></is></c>`)
          .join("") +
        "</row>",
    )
    .join("");
  const cab = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const ns = "http://schemas.openxmlformats.org/";
  return zip([
    [
      "[Content_Types].xml",
      `${cab}<Types xmlns="${ns}package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `${cab}<Relationships xmlns="${ns}package/2006/relationships"><Relationship Id="rId1" Type="${ns}officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `${cab}<workbook xmlns="${ns}spreadsheetml/2006/main" xmlns:r="${ns}officeDocument/2006/relationships"><sheets><sheet name="${esc(hoja)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `${cab}<Relationships xmlns="${ns}package/2006/relationships"><Relationship Id="rId1" Type="${ns}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${ns}officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    [
      "xl/styles.xml",
      `${cab}<styleSheet xmlns="${ns}spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
    ],
    ["xl/worksheets/sheet1.xml", `${cab}<worksheet xmlns="${ns}spreadsheetml/2006/main"><sheetData>${xmlFilas}</sheetData></worksheet>`],
  ]);
}
