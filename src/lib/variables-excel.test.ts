import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { crearXlsx } from "./xlsx";
import { VARIABLES, variablesAFilas } from "./motores";

// Lee las entradas de un zip "stored" (sin compresión) desde el directorio central.
function entradas(zip: Uint8Array): Record<string, string> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fin = zip.byteLength - 22;
  assert.equal(dv.getUint32(fin, true), 0x06054b50);
  const total = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const out: Record<string, string> = {};
  for (let i = 0; i < total; i++) {
    const metodo = dv.getUint16(p + 10, true);
    const tam = dv.getUint32(p + 24, true);
    const nLen = dv.getUint16(p + 28, true);
    const eLen = dv.getUint16(p + 30, true);
    const cLen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const nombre = Buffer.from(zip.subarray(p + 46, p + 46 + nLen)).toString();
    const datos = zip.subarray(off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true));
    const crudo = Buffer.from(datos.subarray(0, tam));
    out[nombre] = (metodo === 8 ? inflateRawSync(crudo) : crudo).toString("utf8");
    p += 46 + nLen + eLen + cLen;
  }
  return out;
}

test("crearXlsx genera un libro con las partes mínimas y escapa el texto", () => {
  const e = entradas(crearXlsx("Variables", [["Nombre", "Origen"], ["A & <B>", "Base interna"]]));
  for (const parte of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml"]) {
    assert.ok(parte in e, `falta ${parte}`);
  }
  assert.match(e["xl/workbook.xml"], /name="Variables"/);
  assert.match(e["xl/worksheets/sheet1.xml"], /A &amp; &lt;B&gt;/);
  assert.match(e["xl/worksheets/sheet1.xml"], /Base interna/);
});

test("variablesAFilas incluye encabezado y una fila por variable con su origen", () => {
  const filas = variablesAFilas(VARIABLES);
  assert.deepEqual(filas[0], ["Variable", "Origen", "Tipo", "Descripción"]);
  assert.equal(filas.length, VARIABLES.length + 1);
  const edad = filas.find((f) => f[0] === "CNET-edad");
  assert.equal(edad?.[1], "Base interna");
  assert.ok(filas.slice(1).every((f) => f[1] && f[0].startsWith(VARIABLES.find((v) => v.nombre === f[0])!.fuente)));
});
