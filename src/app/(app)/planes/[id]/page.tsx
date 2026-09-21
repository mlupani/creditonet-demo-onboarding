"use client";

import { useParams } from "next/navigation";
import { DetallePlan } from "@/components/planes/DetallePlan";

export default function PlanPage() {
  const { id } = useParams<{ id: string }>();
  return <DetallePlan id={decodeURIComponent(id)} />;
}
