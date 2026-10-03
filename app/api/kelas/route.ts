import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.kelas.findMany({
    orderBy: { id: "asc" },
    include: { dosen: true },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const jumlahMahasiswa = Number(body?.jumlahMahasiswa);
  const dosenId = Number(body?.dosenId);
  const slotPerMinggu = Number(body?.slotPerMinggu);
  if (!name) return NextResponse.json({ error: "name wajib diisi" }, { status: 400 });
  if (!Number.isInteger(jumlahMahasiswa) || jumlahMahasiswa <= 0)
    return NextResponse.json({ error: "jumlahMahasiswa harus bilangan bulat > 0" }, { status: 400 });
  if (!Number.isInteger(slotPerMinggu) || slotPerMinggu < 1)
    return NextResponse.json({ error: "slotPerMinggu harus >= 1" }, { status: 400 });
  const d = await prisma.dosen.findUnique({ where: { id: dosenId } });
  if (!d) return NextResponse.json({ error: "Dosen tidak ditemukan" }, { status: 404 });
  const totalSlot = await prisma.slotWaktu.count();
  if (slotPerMinggu > totalSlot)
    return NextResponse.json(
      { error: `slotPerMinggu (${slotPerMinggu}) melebihi jumlah slot tersedia (${totalSlot})` },
      { status: 400 }
    );
  const created = await prisma.kelas.create({
    data: { name, jumlahMahasiswa, dosenId, slotPerMinggu },
  });
  return NextResponse.json(created, { status: 201 });
}
