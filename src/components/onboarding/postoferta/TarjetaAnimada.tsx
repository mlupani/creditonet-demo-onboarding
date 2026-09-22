"use client";

interface TarjetaAnimadaProps {
  numero: string;
  vencimiento: string;
  nombreTitular: string;
  marca: string;
  tipo: "DEBITO" | "CREDITO" | null;
  cvv: string;
  mostrarReverso: boolean;
}

// Detecta la marca (red) a partir del BIN. Se usa tanto para la animación de la tarjeta
// como para completar el dato al tokenizar en carga presencial.
export function detectarMarca(numeroCrudo: string): string {
  const numero = numeroCrudo.replace(/\D/g, "");
  if (!numero) return "";

  const primerDigito = numero[0];
  const cuatroDigitos = Number(numero.slice(0, 4));

  if (primerDigito === "4") return "Visa";
  if (
    (primerDigito === "5" && numero.length >= 2 && Number(numero[1]) >= 1 && Number(numero[1]) <= 5) ||
    (numero.length >= 4 && cuatroDigitos >= 2221 && cuatroDigitos <= 2720)
  ) {
    return "Mastercard";
  }
  if (primerDigito === "3") return "American Express";
  return "";
}

function detectarTipo(numeroCrudo: string): { marca: string; tipo: string | null } {
  const numero = numeroCrudo.replace(/\D/g, "");
  if (!numero) return { marca: "", tipo: null };

  const marca = detectarMarca(numeroCrudo);

  // Detectar tipo por reglas simplificadas de BIN (necesita más dígitos que la marca)
  let tipo: string | null = null;
  if (marca === "Visa") {
    // Visa débito típicamente: 402720-402723, 403000-404999, etc.
    tipo = numero.length >= 6 ? (Number(numero.slice(0, 6)) >= 402720 && Number(numero.slice(0, 6)) <= 402723 ? "Débito" : "Crédito") : "Crédito";
  } else if (marca === "Mastercard") {
    tipo = "Crédito"; // Por defecto Mastercard es crédito
  }

  return { marca, tipo };
}

// Logotipo real de Visa: wordmark itálico blanco.
function LogoVisa() {
  return (
    <span
      className="text-2xl font-black italic tracking-tight text-white"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      VISA
    </span>
  );
}

// Logotipo real de Mastercard: dos círculos superpuestos rojo y amarillo.
function LogoMastercard() {
  return (
    <div className="flex items-center">
      <div className="h-9 w-9 rounded-full bg-[#EB001B]" />
      <div className="-ml-3.5 h-9 w-9 rounded-full bg-[#F79E1B] mix-blend-screen" />
    </div>
  );
}

function LogoAmex() {
  return <span className="text-lg font-extrabold tracking-tight text-white">AMEX</span>;
}

// Chip EMV dorado, como en una tarjeta física.
function ChipEMV() {
  return (
    <div className="h-7 w-9 rounded-md bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 shadow-inner">
      <div className="grid h-full w-full grid-cols-3 grid-rows-2 gap-px p-0.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[1px] bg-yellow-700/40" />
        ))}
      </div>
    </div>
  );
}

// Colores de marca reales: Visa (azul marino #1A1F71) y Mastercard (negro/gris, el color lo
// aporta el logo). Sin marca detectada, gris neutro genérico. Compartido con TarjetaMini.
function fondoPorMarca(marca: string): string {
  if (marca === "Visa") return "bg-gradient-to-br from-[#1A1F71] via-[#232a8a] to-[#0d1140]";
  if (marca === "Mastercard") return "bg-gradient-to-br from-neutral-800 via-neutral-900 to-black";
  if (marca === "American Express") return "bg-gradient-to-br from-[#016fd0] to-[#014b91]";
  return "bg-gradient-to-br from-gray-500 to-gray-700";
}

function LogoMarca({ marca }: { marca: string }) {
  if (marca === "Visa") return <LogoVisa />;
  if (marca === "Mastercard") return <LogoMastercard />;
  if (marca === "American Express") return <LogoAmex />;
  return null;
}

export function TarjetaAnimada({
  numero,
  vencimiento,
  nombreTitular,
  marca,
  cvv,
  mostrarReverso,
}: TarjetaAnimadaProps) {
  const { marca: marcaDetectada, tipo: tipoDetectado } = detectarTipo(numero);
  const marcaFinal = marca || marcaDetectada;
  const tipoFinal = tipoDetectado;
  const numeroFormato = numero
    ? numero
        .replace(/\s+/g, "")
        .replace(/(\d{4})/g, "$1 ")
        .trim()
    : "•••• •••• •••• ••••";

  const cvvFormato = cvv ? cvv.replace(/./g, "•") : "•••";

  return (
    <div className="h-56 w-full max-w-sm">
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: mostrarReverso ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Frente de la tarjeta */}
        <div
          className={`absolute w-full h-full rounded-2xl p-6 text-white shadow-lg flex flex-col justify-between ${fondoPorMarca(marcaFinal)}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex items-start justify-between">
            <ChipEMV />
            {tipoFinal && marcaFinal && (
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                {marcaFinal} {tipoFinal}
              </p>
            )}
          </div>

          {/* Número de tarjeta */}
          <div className="space-y-2">
            <p className="text-2xl font-mono tracking-wider">{numeroFormato}</p>
          </div>

          {/* Datos inferiores */}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] opacity-75">TITULAR</p>
              <p className="text-sm font-semibold truncate max-w-[10rem]">
                {nombreTitular || "NOMBRE TITULAR"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] opacity-75">VENCE</p>
              <p className="text-base font-mono font-bold">{vencimiento || "MM/AA"}</p>
            </div>
            <div className="shrink-0">
              <LogoMarca marca={marcaFinal} />
            </div>
          </div>
        </div>

        {/* Reverso de la tarjeta */}
        <div
          className="absolute w-full h-full rounded-2xl bg-gradient-to-b from-gray-900 to-black text-white shadow-lg flex flex-col justify-center p-6"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="w-full h-12 bg-gray-700 mb-6 rounded"></div>
          <div className="flex justify-end gap-2">
            <p className="text-xs font-semibold opacity-75">CVV</p>
            <p className="text-xl font-mono font-bold tracking-widest">{cvvFormato}</p>
          </div>
          <p className="text-xs text-gray-400 mt-6 text-center">Escriba el código de seguridad</p>
        </div>
      </div>
    </div>
  );
}

// Versión chica y estática (sin flip ni CVV) para mostrar una tarjeta ya tokenizada: mismos
// colores y logo de marca que TarjetaAnimada, con los datos enmascarados que devuelve el
// proveedor (nunca el número completo).
export function TarjetaMini({
  marca,
  tipo,
  nombreTitular,
  primeros4,
  ultimos4,
  vencimiento,
}: {
  marca: string | null;
  tipo: "DEBITO" | "CREDITO" | null;
  nombreTitular: string | null;
  primeros4: string | null;
  ultimos4: string | null;
  vencimiento: string | null;
}) {
  const marcaFinal = marca ?? "";
  return (
    <div
      className={`w-full max-w-[240px] shrink-0 rounded-xl p-4 text-white shadow-md ${fondoPorMarca(marcaFinal)}`}
    >
      <div className="flex items-start justify-between">
        <div className="h-5 w-7 rounded bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600" />
        {tipo && (
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/80">
            {tipo === "CREDITO" ? "Crédito" : "Débito"}
          </p>
        )}
      </div>
      <p className="mt-3 font-mono text-sm tracking-wider">
        {primeros4 ?? "••••"} •• •••• {ultimos4 ?? "••••"}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[8px] opacity-75">TITULAR</p>
          <p className="max-w-[9rem] truncate text-xs font-semibold">{nombreTitular || "—"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[8px] opacity-75">VENCE</p>
          <p className="font-mono text-xs font-bold">{vencimiento ?? "--/--"}</p>
        </div>
        <div className="shrink-0">
          <LogoMarca marca={marcaFinal} />
        </div>
      </div>
    </div>
  );
}
