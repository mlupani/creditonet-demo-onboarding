"use client";

import { useState } from "react";
import {
  arbolDeExpresion,
  condicionATexto,
  filaVacia,
  grupoVacio,
  type CondFila,
  type CondGrupo,
  type CondNodo,
} from "@/lib/expresiones";
import { FUENTES, tiposVariables, variablesDeFuentes, type MotorRiesgo } from "@/lib/motores";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconTrash } from "@/components/icons";

const COMPARADORES = [
  { op: "=", label: "igual" },
  { op: "≠", label: "distinto" },
  { op: "<", label: "menor" },
  { op: "<=", label: "menor o igual" },
  { op: ">", label: "mayor" },
  { op: ">=", label: "mayor o igual" },
];

const CAMPO =
  "h-9 rounded-lg border border-ink-300 bg-white px-2 text-sm text-ink-800 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

// Reemplaza el nodo `id` por lo que devuelva `fn`; el resto del árbol queda igual.
function actualizar(n: CondNodo, id: string, fn: (n: CondNodo) => CondNodo): CondNodo {
  if (n.id === id) return fn(n);
  if (n.tipo === "grupo") return { ...n, hijos: n.hijos.map((h) => actualizar(h, id, fn)) };
  return n;
}

function quitar(g: CondGrupo, id: string): CondGrupo {
  return {
    ...g,
    hijos: g.hijos.filter((h) => h.id !== id).map((h) => (h.tipo === "grupo" ? quitar(h, id) : h)),
  };
}

/** Condición "Si:" de la regla, armada con grupos Y / O / NO y filas variable · operador · valor. */
export function ConstructorCondicion({
  valor,
  onChange,
  fuentes,
  idBase,
}: {
  valor: string;
  onChange: (expresion: string) => void;
  fuentes: MotorRiesgo["fuentes"];
  idBase: string;
}) {
  // Una condición nueva arranca con una fila vacía lista para completar.
  const [arbol, setArbol] = useState<CondGrupo>(() => {
    const a = arbolDeExpresion(valor) ?? grupoVacio();
    return a.hijos.length > 0 ? a : { ...a, hijos: [filaVacia()] };
  });
  const variables = variablesDeFuentes(fuentes);
  const tipos = tiposVariables(fuentes);

  function cambiar(siguiente: CondGrupo) {
    setArbol(siguiente);
    onChange(condicionATexto(siguiente, tipos));
  }
  const editar = (id: string, fn: (n: CondNodo) => CondNodo) => cambiar(actualizar(arbol, id, fn) as CondGrupo);
  const agregar = (id: string, nuevo: CondNodo) =>
    editar(id, (n) => (n.tipo === "grupo" ? { ...n, hijos: [...n.hijos, nuevo] } : n));

  // Funciones de render (no componentes): así los campos no se remontan al escribir.
  function renderFila(f: CondFila) {
    const esTexto = tipos[f.variable] === "texto";
    const conocida = variables.some((v) => v.nombre === f.variable);
    return (
      <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white p-2">
        <select
          value={f.variable}
          onChange={(e) => editar(f.id, (n) => ({ ...n, variable: e.target.value }))}
          aria-label="Variable"
          className={`${CAMPO} min-w-0 flex-1 basis-56 font-mono text-xs`}
        >
          <option value="">Variable…</option>
          {f.variable && !conocida && <option value={f.variable}>{f.variable}</option>}
          {FUENTES.map((fu) => {
            const delaFuente = variables.filter((v) => v.fuente === fu.id);
            return delaFuente.length === 0 ? null : (
              <optgroup key={fu.id} label={fu.label}>
                {delaFuente.map((v) => (
                  <option key={v.nombre} value={v.nombre}>
                    {v.nombre}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <select
          value={f.op}
          onChange={(e) => editar(f.id, (n) => ({ ...n, op: e.target.value }))}
          aria-label="Operador"
          className={`${CAMPO} w-36`}
        >
          {COMPARADORES.filter((c) => !esTexto || c.op === "=" || c.op === "≠").map((c) => (
            <option key={c.op} value={c.op}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          value={f.valor}
          onChange={(e) => editar(f.id, (n) => ({ ...n, valor: e.target.value }))}
          aria-label="Valor"
          placeholder={esTexto ? "Texto" : "Valor"}
          inputMode={esTexto ? "text" : "decimal"}
          className={`${CAMPO} w-32`}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => cambiar(quitar(arbol, f.id))}
          aria-label="Borrar condición"
        >
          <IconTrash width={14} height={14} />
          Borrar
        </Button>
      </div>
    );
  }

  function renderGrupo(g: CondGrupo, raiz = false) {
    const boton = (activo: boolean) =>
      `h-7 rounded px-2.5 text-xs font-bold transition ${
        activo ? "bg-brand-600 text-white shadow-xs" : "text-ink-600 hover:bg-white"
      }`;
    return (
      <div key={g.id} className={`space-y-2 rounded-xl border p-3 ${raiz ? "border-ink-200 bg-ink-25" : "border-brand-200 bg-brand-50/40"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-lg border border-ink-200 bg-ink-50 p-0.5" role="group" aria-label="Cómo se combinan las condiciones">
            <button
              type="button"
              aria-pressed={g.conector === "AND"}
              onClick={() => editar(g.id, (n) => ({ ...n, conector: "AND" }))}
              title="Se tienen que cumplir todas"
              className={boton(g.conector === "AND")}
            >
              Y
            </button>
            <button
              type="button"
              aria-pressed={g.conector === "OR"}
              onClick={() => editar(g.id, (n) => ({ ...n, conector: "OR" }))}
              title="Alcanza con que se cumpla una"
              className={boton(g.conector === "OR")}
            >
              O
            </button>
            <button
              type="button"
              aria-pressed={g.negado}
              onClick={() => editar(g.id, (n) => (n.tipo === "grupo" ? { ...n, negado: !n.negado } : n))}
              title="Niega el grupo: se cumple cuando NO se cumple lo de adentro"
              className={boton(g.negado)}
            >
              NO
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => agregar(g.id, filaVacia())}>
              <IconPlus width={13} height={13} />
              Añadir regla
            </Button>
            <Button size="sm" variant="outline" onClick={() => agregar(g.id, { ...grupoVacio(), hijos: [filaVacia()] })}>
              <IconPlus width={13} height={13} />
              Añadir grupo
            </Button>
            {!raiz && (
              <Button size="sm" variant="ghost" onClick={() => cambiar(quitar(arbol, g.id))}>
                <IconTrash width={14} height={14} />
                Borrar grupo
              </Button>
            )}
          </div>
        </div>
        {g.hijos.length === 0 ? (
          <p className="px-1 text-sm text-ink-400">Sin condiciones: añadí una regla.</p>
        ) : (
          <div className="space-y-2 border-l-2 border-ink-200 pl-3">
            {g.hijos.map((h) => (h.tipo === "cond" ? renderFila(h) : renderGrupo(h)))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id={`${idBase}-condicion`}>
      {renderGrupo(arbol, true)}
    </div>
  );
}
