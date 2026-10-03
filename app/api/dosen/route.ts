import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.dosen.findMany({
    orderBy: { id: "asc" },
    include: { preferensi: { include: { slot: true }, orderBy: { slotId: "asc" } } },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const nidn = String(body?.nidn ?? "").trim();
  if (!name || !nidn) return NextResponse.json({ error: "name dan nidn wajib diisi" }, { status: 400 });
  const dup = await prisma.dosen.findUnique({ where: { nidn } });
  if (dup) return NextResponse.json({ error: "nidn sudah terdaftar" }, { status: 409 });
  const created = await prisma.dosen.create({ data: { name, nidn } });
  return NextResponse.json(created, { status: 201 });
}
