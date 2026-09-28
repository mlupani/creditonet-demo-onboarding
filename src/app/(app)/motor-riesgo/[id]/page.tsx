"use client";

import { useParams } from "next/navigation";
import { DetalleMotor } from "@/components/motores/DetalleMotor";

export default function GrupoReglasPage() {
  const { id } = useParams<{ id: string }>();
  return <DetalleMotor id={decodeURIComponent(id)} />;
}
