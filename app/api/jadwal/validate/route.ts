import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Pelanggaran, JadwalInput } from "@/lib/jadwal";

// Body opsional {jadwal: [{kelasId, dosenId, ruanganId, slotId}]}.
// Tanpa body -> validasi jadwal yang tersimpan.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  let daftar: JadwalInput[];
  if (Array.isArray(body?.jadwal)) {
    daftar = body.jadwal.map((j: Record<string, unknown>) => ({
      kelasId: Number(j.kelasId),
      dosenId: Number(j.dosenId),
      ruanganId: Number(j.ruanganId),
      slotId: Number(j.slotId),
    }));
  } else {
    const rows = await prisma.jadwal.findMany({
      select: { kelasId: true, dosenId: true, ruanganId: true, slotId: true },
    });
    daftar = rows;
  }

  const pelanggaran: Pelanggaran[] = [];
  const kelasMap = new Map<number, { name: string; jumlahMahasiswa: number }>();
  const ruangMap = new Map<number, { name: string; kapasitas: number }>();
  const dosenMap = new Map<number, string>();
  const [kelasList, ruangList, dosenList] = await Promise.all([
    prisma.kelas.findMany({ select: { id: true, name: true, jumlahMahasiswa: true } }),
    prisma.ruangan.findMany({ select: { id: true, name: true, kapasitas: true } }),
    prisma.dosen.findMany({ select: { id: true, name: true } }),
  ]);
  for (const k of kelasList) kelasMap.set(k.id, k);
  for (const r of ruangList) ruangMap.set(r.id, r);
  for (const d of dosenList) dosenMap.set(d.id, d.name);

  for (let i = 0; i < daftar.length; i++) {
    const a = daftar[i];
    const kInfo = kelasMap.get(a.kelasId);
    const rInfo = ruangMap.get(a.ruanganId);
    if (kInfo && rInfo && rInfo.kapasitas < kInfo.jumlahMahasiswa) {
      pelanggaran.push({
        type: "kapasitas_kurang",
        detail: `Kapasitas ${rInfo.name} (${rInfo.kapasitas}) kurang untuk ${kInfo.name} (${kInfo.jumlahMahasiswa} mahasiswa)`,
      });
    }
    for (let k = i + 1; k < daftar.length; k++) {
      const b = daftar[k];
      if (a.slotId !== b.slotId) continue;
      const nm = (id: number, m: Map<number, string>) => m.get(id) ?? `#${id}`;
      if (a.dosenId === b.dosenId)
        pelanggaran.push({
          type: "bentrok_dosen",
          detail: `${nm(a.dosenId, dosenMap)} mengajar 2 kelas pada slotId=${a.slotId} (item ${i + 1} & ${k + 1})`,
        });
      if (a.ruanganId === b.ruanganId)
        pelanggaran.push({
          type: "bentrok_ruangan",
          detail: `${rInfo?.name ?? a.ruanganId} dipakai 2 kelas pada slotId=${a.slotId} (item ${i + 1} & ${k + 1})`,
        });
      if (a.kelasId === b.kelasId)
        pelanggaran.push({
          type: "bentrok_kelas",
          detail: `${kInfo?.name ?? a.kelasId} terjadwal 2x pada slotId=${a.slotId} (item ${i + 1} & ${k + 1})`,
        });
    }
  }

  return NextResponse.json({ valid: pelanggaran.length === 0, pelanggaran });
}
