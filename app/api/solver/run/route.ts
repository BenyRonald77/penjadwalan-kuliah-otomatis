import { NextResponse } from "next/server";
import { runSolver } from "@/lib/jadwal";

export async function POST() {
  const result = await runSolver();
  return NextResponse.json(result);
}
