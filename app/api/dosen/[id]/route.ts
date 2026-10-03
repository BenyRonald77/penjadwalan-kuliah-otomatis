import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const d = await prisma.dosen.findUnique({ where: { id } });
  if (!d) return NextResponse.json({ error: "Dosen tidak ditemukan" }, { status: 404 });
  const dipakai = await prisma.kelas.count({ where: { dosenId: id } });
  if (dipakai > 0)
    return NextResponse.json(
      { error: `Dosen masih mengampu ${dipakai} kelas; hapus/ubah kelas dulu` },
      { status: 409 }
    );
  await prisma.dosen.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
