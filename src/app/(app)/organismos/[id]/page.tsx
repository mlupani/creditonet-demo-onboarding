"use client";

import { useParams } from "next/navigation";
import { DetalleOrganismo } from "@/components/organismos/DetalleOrganismo";

export default function OrganismoPage() {
  const { id } = useParams<{ id: string }>();
  return <DetalleOrganismo id={decodeURIComponent(id)} />;
}
