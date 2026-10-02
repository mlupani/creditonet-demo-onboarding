"use client";

import { createContext, useContext } from "react";

// Cuando es true, los campos muestran sus errores aunque todavía no se hayan tocado (por ejemplo
// al intentar avanzar de pantalla con obligatorios sin completar).
const ForzarErroresContext = createContext(false);

export const ForzarErroresProvider = ForzarErroresContext.Provider;
export const useForzarErrores = () => useContext(ForzarErroresContext);
