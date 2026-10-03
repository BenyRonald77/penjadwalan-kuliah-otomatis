import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const s = await prisma.slotWaktu.findUnique({ where: { id } });
  if (!s) return NextResponse.json({ error: "Slot tidak ditemukan" }, { status: 404 });
  const dipakai = await prisma.jadwal.count({ where: { slotId: id } });
  if (dipakai > 0)
    return NextResponse.json(
      { error: `Slot dipakai ${dipakai} jadwal; hapus jadwal dulu` },
      { status: 409 }
    );
  await prisma.slotWaktu.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
