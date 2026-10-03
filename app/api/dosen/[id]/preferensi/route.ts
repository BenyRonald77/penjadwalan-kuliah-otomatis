import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Set skor preferensi dosen untuk satu slot (upsert)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const dosenId = Number(params.id);
  const body = await req.json().catch(() => null);
  const slotId = Number(body?.slotId);
  const skor = Number(body?.skor);
  if (!slotId || !Number.isInteger(skor) || skor < 1 || skor > 5)
    return NextResponse.json({ error: "slotId wajib; skor harus 1–5" }, { status: 400 });
  const [d, s] = await Promise.all([
    prisma.dosen.findUnique({ where: { id: dosenId } }),
    prisma.slotWaktu.findUnique({ where: { id: slotId } }),
  ]);
  if (!d) return NextResponse.json({ error: "Dosen tidak ditemukan" }, { status: 404 });
  if (!s) return NextResponse.json({ error: "Slot tidak ditemukan" }, { status: 404 });
  const pref = await prisma.preferensi.upsert({
    where: { dosenId_slotId: { dosenId, slotId } },
    update: { skor },
    create: { dosenId, slotId, skor },
  });
  return NextResponse.json(pref);
}

// Hapus preferensi untuk satu slot: body {slotId}
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const dosenId = Number(params.id);
  const body = await req.json().catch(() => null);
  const slotId = Number(body?.slotId);
  if (!slotId) return NextResponse.json({ error: "slotId wajib" }, { status: 400 });
  await prisma.preferensi.deleteMany({ where: { dosenId, slotId } });
  return NextResponse.json({ ok: true });
}
