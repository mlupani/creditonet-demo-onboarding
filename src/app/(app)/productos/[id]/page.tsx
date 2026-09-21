"use client";

import { useParams } from "next/navigation";
import { DetalleProducto } from "@/components/productos/DetalleProducto";

export default function ProductoPage() {
  const { id } = useParams<{ id: string }>();
  return <DetalleProducto id={decodeURIComponent(id)} />;
}
