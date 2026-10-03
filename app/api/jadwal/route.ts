import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateJadwal, getAllJadwalRaw } from "@/lib/jadwal";

export async function GET() {
  const rows = await prisma.jadwal.findMany({
    orderBy: { id: "asc" },
    include: { kelas: true, dosen: true, ruangan: true, slot: true },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const kelasId = Number(body?.kelasId);
  const ruanganId = Number(body?.ruanganId);
  const slotId = Number(body?.slotId);
  for (const [k, v] of Object.entries({ kelasId, ruanganId, slotId })) {
    if (!Number.isInteger(v) || v <= 0)
      return NextResponse.json({ error: `${k} wajib bilangan bulat > 0` }, { status: 400 });
  }
  const [kelas, slot] = await Promise.all([
    prisma.kelas.findUnique({ where: { id: kelasId } }),
    prisma.slotWaktu.findUnique({ where: { id: slotId } }),
  ]);
  if (!kelas) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  if (!slot) return NextResponse.json({ error: "Slot tidak ditemukan" }, { status: 404 });
  // dosenId selalu = dosen pengampu kelas
  const dosenId = kelas.dosenId;

  const existing = await getAllJadwalRaw();
  const pel = await validateJadwal({ kelasId, dosenId, ruanganId, slotId }, { existing });
  if (pel.length > 0) return NextResponse.json({ error: "Melanggar hard constraint", pelanggaran: pel }, { status: 409 });

  const created = await prisma.jadwal.create({
    data: { kelasId, dosenId, ruanganId, slotId },
    include: { kelas: true, dosen: true, ruangan: true, slot: true },
  });
  return NextResponse.json(created, { status: 201 });
}
