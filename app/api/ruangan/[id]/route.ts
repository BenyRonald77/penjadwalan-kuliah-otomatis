import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const r = await prisma.ruangan.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: "Ruangan tidak ditemukan" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const data: { name?: string; kapasitas?: number; fasilitas?: string | null } = {};
  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "name tidak boleh kosong" }, { status: 400 });
    const dup = await prisma.ruangan.findUnique({ where: { name } });
    if (dup && dup.id !== id) return NextResponse.json({ error: "Nama ruangan sudah dipakai" }, { status: 409 });
    data.name = name;
  }
  if (body?.kapasitas !== undefined) {
    const kapasitas = Number(body.kapasitas);
    if (!Number.isInteger(kapasitas) || kapasitas <= 0)
      return NextResponse.json({ error: "kapasitas harus bilangan bulat > 0" }, { status: 400 });
    data.kapasitas = kapasitas;
  }
  if (body?.fasilitas !== undefined) data.fasilitas = body.fasilitas ? String(body.fasilitas) : null;
  const updated = await prisma.ruangan.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const r = await prisma.ruangan.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: "Ruangan tidak ditemukan" }, { status: 404 });
  const dipakai = await prisma.jadwal.count({ where: { ruanganId: id } });
  if (dipakai > 0)
    return NextResponse.json(
      { error: `Ruangan dipakai ${dipakai} jadwal; hapus jadwal dulu` },
      { status: 409 }
    );
  await prisma.ruangan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
