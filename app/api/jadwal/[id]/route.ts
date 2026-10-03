import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateJadwal, getAllJadwalRaw, JadwalInput } from "@/lib/jadwal";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const j = await prisma.jadwal.findUnique({ where: { id } });
  if (!j) return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
  const body = await req.json().catch(() => null);

  const ruanganId =
    body?.ruanganId !== undefined ? Number(body.ruanganId) : j.ruanganId;
  const slotId = body?.slotId !== undefined ? Number(body.slotId) : j.slotId;
  if (!Number.isInteger(ruanganId) || ruanganId <= 0 || !Number.isInteger(slotId) || slotId <= 0)
    return NextResponse.json({ error: "ruanganId dan slotId harus bilangan bulat > 0" }, { status: 400 });

  const input: JadwalInput = { kelasId: j.kelasId, dosenId: j.dosenId, ruanganId, slotId };
  const existing = await getAllJadwalRaw();
  const pel = await validateJadwal(input, { existing, excludeId: id });
  if (pel.length > 0)
    return NextResponse.json({ error: "Melanggar hard constraint", pelanggaran: pel }, { status: 409 });

  const updated = await prisma.jadwal.update({
    where: { id },
    data: { ruanganId, slotId },
    include: { kelas: true, dosen: true, ruangan: true, slot: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const j = await prisma.jadwal.findUnique({ where: { id } });
  if (!j) return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
  await prisma.jadwal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
