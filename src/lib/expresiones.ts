// Expresiones de las reglas del Motor de riesgo interno (doc Motor de Riesgo v1 · 27/09/2026 §3).
//
// Una expresión combina variables con prefijo de origen (CNET-, BCRA-, BURO-), valores y los
// operadores ( ) * / + - = ≠ < <= > >= AND. Tiene que resolver a verdadero / falso: si es
// verdadera, la regla dispara su acción (Rechazar o Verificar).

export type ValorVariable = number | string;

type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "var"; v: string }
  | { t: "op"; v: string };

type Nodo =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "var"; v: string }
  | { k: "neg"; a: Nodo }
  | { k: "bin"; op: string; a: Nodo; b: Nodo };

type Tipo = "numero" | "texto" | "booleano";

export const OPERADORES = ["(", ")", "*", "/", "+", "-", "=", "≠", "<", "<=", ">", ">=", "AND"];

const COMPARADORES = new Set(["=", "≠", "<", "<=", ">", ">="]);
const RE_VARIABLE = /^(?:CNET|BCRA|BURO)-[\p{L}\d_]+/u;

function tokenizar(texto: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < texto.length) {
    const resto = texto.slice(i);
    const espacio = /^\s+/.exec(resto);
    if (espacio) {
      i += espacio[0].length;
      continue;
    }
    const variable = RE_VARIABLE.exec(resto);
    if (variable) {
      tokens.push({ t: "var", v: variable[0] });
      i += variable[0].length;
      continue;
    }
    const numero = /^\d+(?:\.\d+)?/.exec(resto);
    if (numero) {
      tokens.push({ t: "num", v: Number(numero[0]) });
      i += numero[0].length;
      continue;
    }
    if (resto[0] === '"') {
      const fin = resto.indexOf('"', 1);
      if (fin < 0) throw new Error("Falta cerrar las comillas del texto.");
      tokens.push({ t: "str", v: resto.slice(1, fin) });
      i += fin + 1;
      continue;
    }
    const conector = /^(?:AND|Y|I)(?![\p{L}\d_-])/iu.exec(resto);
    if (conector) {
      tokens.push({ t: "op", v: "AND" });
      i += conector[0].length;
      continue;
    }
    const op = /^(?:<=|>=|!=|<>|[()*/+\-=≠<>])/.exec(resto);
    if (op) {
      tokens.push({ t: "op", v: op[0] === "!=" || op[0] === "<>" ? "≠" : op[0] });
      i += op[0].length;
      continue;
    }
    const palabra = /^[^\s()]+/.exec(resto)?.[0] ?? resto[0];
    throw new Error(
      /^[A-Za-z]{4}-/.test(palabra)
        ? `“${palabra}” no tiene un prefijo de origen válido (CNET-, BCRA- o BURO-).`
        : `No se reconoce “${palabra}”.`
    );
  }
  return tokens;
}

function parsear(tokens: Token[]): Nodo {
  let pos = 0;
  const ver = () => tokens[pos];
  const esOp = (v: string) => ver()?.t === "op" && ver().v === v;

  function conjuncion(): Nodo {
    let a = comparacion();
    while (esOp("AND")) {
      pos++;
      a = { k: "bin", op: "AND", a, b: comparacion() };
    }
    return a;
  }
  function comparacion(): Nodo {
    const a = suma();
    const t = ver();
    if (t?.t === "op" && COMPARADORES.has(t.v)) {
      pos++;
      return { k: "bin", op: t.v, a, b: suma() };
    }
    return a;
  }
  function suma(): Nodo {
    let a = producto();
    while (esOp("+") || esOp("-")) {
      const op = tokens[pos++].v as string;
      a = { k: "bin", op, a, b: producto() };
    }
    return a;
  }
  function producto(): Nodo {
    let a = unario();
    while (esOp("*") || esOp("/")) {
      const op = tokens[pos++].v as string;
      a = { k: "bin", op, a, b: unario() };
    }
    return a;
  }
  function unario(): Nodo {
    if (esOp("-")) {
      pos++;
      return { k: "neg", a: unario() };
    }
    return primario();
  }
  function primario(): Nodo {
    const t = tokens[pos++];
    if (!t) throw new Error("La expresión está incompleta.");
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "str") return { k: "str", v: t.v };
    if (t.t === "var") return { k: "var", v: t.v };
    if (t.v === "(") {
      const n = conjuncion();
      if (!esOp(")")) throw new Error("Falta cerrar un paréntesis.");
      pos++;
      return n;
    }
    throw new Error(`Falta un valor o una variable antes de “${t.v}”.`);
  }

  if (tokens.length === 0) throw new Error("Armá la expresión de la regla.");
  const raiz = conjuncion();
  if (pos < tokens.length) {
    const t = tokens[pos];
    throw new Error(
      t.t === "op" && t.v === ")"
        ? "Sobra un paréntesis de cierre."
        : "Falta un operador entre dos elementos."
    );
  }
  return raiz;
}

function tipar(n: Nodo, tipos: Record<string, Tipo>): Tipo {
  switch (n.k) {
    case "num":
      return "numero";
    case "str":
      return "texto";
    case "var": {
      const t = tipos[n.v];
      if (!t) throw new Error(`La variable “${n.v}” no existe o su fuente no está habilitada.`);
      return t;
    }
    case "neg":
      if (tipar(n.a, tipos) !== "numero") throw new Error("El signo menos sólo aplica a números.");
      return "numero";
    case "bin": {
      const a = tipar(n.a, tipos);
      const b = tipar(n.b, tipos);
      if (n.op === "AND") {
        if (a !== "booleano" || b !== "booleano")
          throw new Error("AND une dos condiciones (comparaciones), no valores sueltos.");
        return "booleano";
      }
      if (COMPARADORES.has(n.op)) {
        if (a === "booleano" || b === "booleano")
          throw new Error(`“${n.op}” compara valores, no condiciones.`);
        if (a !== b) throw new Error(`“${n.op}” compara un número con un texto.`);
        if (a === "texto" && n.op !== "=" && n.op !== "≠")
          throw new Error("Los textos sólo se comparan con = o ≠.");
        return "booleano";
      }
      if (a !== "numero" || b !== "numero")
        throw new Error(`“${n.op}” opera sólo entre números.`);
      return "numero";
    }
  }
}

function evaluar(n: Nodo, valores: Record<string, ValorVariable | null>): ValorVariable | boolean | null {
  switch (n.k) {
    case "num":
    case "str":
      return n.v;
    case "var":
      return valores[n.v] ?? null;
    case "neg": {
      const a = evaluar(n.a, valores);
      return a === null ? null : -(a as number);
    }
    case "bin": {
      const a = evaluar(n.a, valores);
      const b = evaluar(n.b, valores);
      if (n.op === "AND") return a === null || b === null ? null : a === true && b === true;
      if (a === null || b === null) return null;
      switch (n.op) {
        case "=":
          return a === b;
        case "≠":
          return a !== b;
        case "<":
          return a < b;
        case "<=":
          return a <= b;
        case ">":
          return a > b;
        case ">=":
          return a >= b;
        case "+":
          return (a as number) + (b as number);
        case "-":
          return (a as number) - (b as number);
        case "*":
          return (a as number) * (b as number);
        case "/":
          return (b as number) === 0 ? null : (a as number) / (b as number);
      }
      return null;
    }
  }
}

function variablesDe(n: Nodo, acc: string[] = []): string[] {
  if (n.k === "var" && !acc.includes(n.v)) acc.push(n.v);
  if (n.k === "neg") variablesDe(n.a, acc);
  if (n.k === "bin") {
    variablesDe(n.a, acc);
    variablesDe(n.b, acc);
  }
  return acc;
}

/**
 * Valida la expresión contra las variables disponibles (las de las fuentes habilitadas en el
 * grupo). Devuelve el mensaje de error o null si es válida.
 */
export function validarExpresion(texto: string, tipos: Record<string, Tipo>): string | null {
  try {
    if (tipar(parsear(tokenizar(texto)), tipos) !== "booleano")
      return "La expresión tiene que ser una condición (verdadera o falsa): agregá una comparación.";
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Variables que usa la expresión, en orden de aparición (vacío si no se puede leer). */
export function variablesDeExpresion(texto: string): string[] {
  try {
    return variablesDe(parsear(tokenizar(texto)));
  } catch {
    return [];
  }
}

/**
 * Evalúa la expresión. Devuelve true / false, o null si falta el dato de alguna variable o
 * la expresión no se puede leer.
 */
export function evaluarExpresion(
  texto: string,
  valores: Record<string, ValorVariable | null>
): boolean | null {
  try {
    const r = evaluar(parsear(tokenizar(texto)), valores);
    return typeof r === "boolean" ? r : null;
  } catch {
    return null;
  }
}
