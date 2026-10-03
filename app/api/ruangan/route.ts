import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.ruangan.findMany({ orderBy: { kapasitas: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const kapasitas = Number(body?.kapasitas);
  const fasilitas = body?.fasilitas ? String(body.fasilitas).trim() : null;
  if (!name || !Number.isInteger(kapasitas) || kapasitas <= 0)
    return NextResponse.json({ error: "name wajib; kapasitas harus bilangan bulat > 0" }, { status: 400 });
  const dup = await prisma.ruangan.findUnique({ where: { name } });
  if (dup) return NextResponse.json({ error: "Nama ruangan sudah dipakai" }, { status: 409 });
  const created = await prisma.ruangan.create({ data: { name, kapasitas, fasilitas } });
  return NextResponse.json(created, { status: 201 });
}
