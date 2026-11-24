"use client";

import { Suspense } from "react";
import { PantallaBandeja } from "@/components/bandeja/Bandeja";

export default function CajaBandejaPage() {
  return (
    <Suspense fallback={null}>
      <PantallaBandeja />
    </Suspense>
  );
}
