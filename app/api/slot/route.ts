import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
const HARI_ORDER: Record<string, number> = { Senin: 0, Selasa: 1, Rabu: 2, Kamis: 3, Jumat: 4 };

export async function GET() {
  const rows = await prisma.slotWaktu.findMany({ orderBy: { id: "asc" } });
  rows.sort((a, b) => HARI_ORDER[a.hari] - HARI_ORDER[b.hari] || a.jamMulai.localeCompare(b.jamMulai));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const hari = String(body?.hari ?? "").trim();
  const jamMulai = String(body?.jamMulai ?? "").trim();
  const jamSelesai = String(body?.jamSelesai ?? "").trim();
  if (!HARI.includes(hari)) return NextResponse.json({ error: "hari harus Senin–Jumat" }, { status: 400 });
  if (!/^\d{2}:\d{2}$/.test(jamMulai) || !/^\d{2}:\d{2}$/.test(jamSelesai))
    return NextResponse.json({ error: "jamMulai/jamSelesai format HH:MM" }, { status: 400 });
  if (jamSelesai <= jamMulai)
    return NextResponse.json({ error: "jamSelesai harus setelah jamMulai" }, { status: 400 });
  const dup = await prisma.slotWaktu.findUnique({ where: { hari_jamMulai: { hari, jamMulai } } });
  if (dup) return NextResponse.json({ error: "Slot hari+jamMulai sudah ada" }, { status: 409 });
  const created = await prisma.slotWaktu.create({
    data: { hari, jamMulai, jamSelesai, label: `${hari} ${jamMulai}–${jamSelesai}` },
  });
  return NextResponse.json(created, { status: 201 });
}
