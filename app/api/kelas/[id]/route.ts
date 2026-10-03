import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const k = await prisma.kelas.findUnique({ where: { id } });
  if (!k) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const data: { name?: string; jumlahMahasiswa?: number; dosenId?: number; slotPerMinggu?: number } = {};
  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "name tidak boleh kosong" }, { status: 400 });
    data.name = name;
  }
  if (body?.jumlahMahasiswa !== undefined) {
    const n = Number(body.jumlahMahasiswa);
    if (!Number.isInteger(n) || n <= 0)
      return NextResponse.json({ error: "jumlahMahasiswa harus bilangan bulat > 0" }, { status: 400 });
    data.jumlahMahasiswa = n;
  }
  if (body?.dosenId !== undefined) {
    const dosenId = Number(body.dosenId);
    const d = await prisma.dosen.findUnique({ where: { id: dosenId } });
    if (!d) return NextResponse.json({ error: "Dosen tidak ditemukan" }, { status: 404 });
    data.dosenId = dosenId;
  }
  if (body?.slotPerMinggu !== undefined) {
    const spm = Number(body.slotPerMinggu);
    if (!Number.isInteger(spm) || spm < 1)
      return NextResponse.json({ error: "slotPerMinggu harus >= 1" }, { status: 400 });
    const totalSlot = await prisma.slotWaktu.count();
    if (spm > totalSlot)
      return NextResponse.json(
        { error: `slotPerMinggu (${spm}) melebihi jumlah slot tersedia (${totalSlot})` },
        { status: 400 }
      );
    data.slotPerMinggu = spm;
  }
  const updated = await prisma.kelas.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const k = await prisma.kelas.findUnique({ where: { id } });
  if (!k) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  const dipakai = await prisma.jadwal.count({ where: { kelasId: id } });
  if (dipakai > 0)
    return NextResponse.json(
      { error: `Kelas punya ${dipakai} jadwal; hapus jadwal dulu` },
      { status: 409 }
    );
  await prisma.kelas.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
