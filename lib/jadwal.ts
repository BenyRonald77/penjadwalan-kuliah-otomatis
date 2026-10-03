import { prisma } from "./prisma";

export type PelanggaranType =
  | "bentrok_dosen"
  | "bentrok_ruangan"
  | "kapasitas_kurang"
  | "bentrok_kelas";

export interface Pelanggaran {
  type: PelanggaranType;
  detail: string;
}

export interface JadwalInput {
  kelasId: number;
  dosenId: number;
  ruanganId: number;
  slotId: number;
}

interface KelasInfo {
  id: number;
  jumlahMahasiswa: number;
  dosenId: number;
}

interface RuanganInfo {
  id: number;
  kapasitas: number;
}

/** Validasi satu jadwal input terhadap daftar jadwal lain + master data.
 *  `existing` = jadwal lain yang sudah ada (tanpa jadwal yang sedang diedit).
 *  `excludeId` = id jadwal yang sedang diedit (diabaikan saat cek bentrok).
 */
export async function validateJadwal(
  input: JadwalInput,
  opts: { existing?: Array<JadwalInput & { id: number }>; excludeId?: number } = {}
): Promise<Pelanggaran[]> {
  const pel: Pelanggaran[] = [];
  const existing = (opts.existing ?? []).filter((j) => j.id !== opts.excludeId);

  const [kelas, ruangan] = await Promise.all([
    prisma.kelas.findUnique({ where: { id: input.kelasId } }),
    prisma.ruangan.findUnique({ where: { id: input.ruanganId } }),
  ]);
  if (!kelas) {
    pel.push({ type: "bentrok_kelas", detail: `Kelas id=${input.kelasId} tidak ditemukan` });
    return pel;
  }
  if (!ruangan) {
    pel.push({ type: "kapasitas_kurang", detail: `Ruangan id=${input.ruanganId} tidak ditemukan` });
    return pel;
  }

  if (ruangan.kapasitas < kelas.jumlahMahasiswa) {
    pel.push({
      type: "kapasitas_kurang",
      detail: `Kapasitas ruangan ${ruangan.name} (${ruangan.kapasitas}) kurang untuk kelas ${kelas.name} (${kelas.jumlahMahasiswa} mahasiswa)`,
    });
  }

  const bentrokDosen = existing.find(
    (j) => j.slotId === input.slotId && j.dosenId === input.dosenId
  );
  if (bentrokDosen) {
    pel.push({
      type: "bentrok_dosen",
      detail: `Dosen sudah mengajar kelas lain pada slot ini (jadwal id=${bentrokDosen.id})`,
    });
  }

  const bentrokRuangan = existing.find(
    (j) => j.slotId === input.slotId && j.ruanganId === input.ruanganId
  );
  if (bentrokRuangan) {
    pel.push({
      type: "bentrok_ruangan",
      detail: `Ruangan ${ruangan.name} sudah dipakai kelas lain pada slot ini (jadwal id=${bentrokRuangan.id})`,
    });
  }

  const bentrokKelas = existing.find(
    (j) => j.slotId === input.slotId && j.kelasId === input.kelasId
  );
  if (bentrokKelas) {
    pel.push({
      type: "bentrok_kelas",
      detail: `Kelas ${kelas.name} sudah punya jadwal pada slot ini (jadwal id=${bentrokKelas.id})`,
    });
  }

  return pel;
}

export async function getAllJadwalRaw(): Promise<Array<JadwalInput & { id: number }>> {
  const rows = await prisma.jadwal.findMany({
    select: { id: true, kelasId: true, dosenId: true, ruanganId: true, slotId: true },
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Solver: greedy + backtracking terbatas
// ---------------------------------------------------------------------------

interface Candidate {
  slotId: number;
  ruanganId: number;
  skor: number;
}

interface Assignment {
  kelasId: number;
  dosenId: number;
  slotId: number;
  ruanganId: number;
}

export interface SolverResult {
  jadwalDibuat: number;
  totalSkorPreferensi: number;
  pelanggaran: Pelanggaran[];
  gagal: Array<{ kelasId: number; kelas: string; alasan: string }>;
}

const HARI_ORDER: Record<string, number> = {
  Senin: 0,
  Selasa: 1,
  Rabu: 2,
  Kamis: 3,
  Jumat: 4,
};

export async function runSolver(): Promise<SolverResult> {
  const [kelasList, slotList, ruanganList, preferensiList] = await Promise.all([
    prisma.kelas.findMany({ orderBy: { id: "asc" } }),
    prisma.slotWaktu.findMany(),
    prisma.ruangan.findMany(),
    prisma.preferensi.findMany(),
  ]);

  const skorPref = new Map<string, number>(); // `${dosenId}:${slotId}` -> skor
  for (const p of preferensiList) skorPref.set(`${p.dosenId}:${p.slotId}`, p.skor);

  const slotsSorted = [...slotList].sort(
    (a, b) =>
      (HARI_ORDER[a.hari] ?? 99) - (HARI_ORDER[b.hari] ?? 99) ||
      a.jamMulai.localeCompare(b.jamMulai)
  );
  const ruanganSorted = [...ruanganList].sort((a, b) => a.kapasitas - b.kapasitas);

  const kelasInfo = new Map<number, KelasInfo>();
  for (const k of kelasList)
    kelasInfo.set(k.id, { id: k.id, jumlahMahasiswa: k.jumlahMahasiswa, dosenId: k.dosenId });

  // Kelas tersulit dulu: jumlahMahasiswa besar, lalu slotPerMinggu banyak.
  const order = [...kelasList].sort(
    (a, b) =>
      b.jumlahMahasiswa - a.jumlahMahasiswa ||
      b.slotPerMinggu - a.slotPerMinggu ||
      a.id - b.id
  );

  const assigned: Assignment[] = [];
  const gagal: SolverResult["gagal"] = [];

  const dosenUsed = new Set<string>(); // `${dosenId}:${slotId}`
  const ruanganUsed = new Set<string>();
  const kelasUsed = new Set<string>();

  function candidatesFor(k: KelasInfo): Candidate[] {
    const out: Candidate[] = [];
    for (const s of slotsSorted) {
      if (kelasUsed.has(`${k.id}:${s.id}`)) continue;
      if (dosenUsed.has(`${k.dosenId}:${s.id}`)) continue;
      const skor = skorPref.get(`${k.dosenId}:${s.id}`) ?? 3;
      for (const r of ruanganSorted) {
        if (r.kapasitas < k.jumlahMahasiswa) continue;
        if (ruanganUsed.has(`${r.id}:${s.id}`)) continue;
        out.push({ slotId: s.id, ruanganId: r.id, skor });
      }
    }
    // skor tertinggi dulu; tie-break: slot paling awal, ruangan terkecil yang cukup
    out.sort((a, b) => {
      const sa = slotsSorted.findIndex((s) => s.id === a.slotId);
      const sb = slotsSorted.findIndex((s) => s.id === b.slotId);
      return (
        b.skor - a.skor ||
        sa - sb ||
        ruanganSorted.findIndex((r) => r.id === a.ruanganId) -
          ruanganSorted.findIndex((r) => r.id === b.ruanganId)
      );
    });
    return out;
  }

  function place(a: Assignment) {
    assigned.push(a);
    dosenUsed.add(`${a.dosenId}:${a.slotId}`);
    ruanganUsed.add(`${a.ruanganId}:${a.slotId}`);
    kelasUsed.add(`${a.kelasId}:${a.slotId}`);
  }
  function unplace(n: number) {
    for (let i = 0; i < n; i++) {
      const a = assigned.pop();
      if (!a) break;
      dosenUsed.delete(`${a.dosenId}:${a.slotId}`);
      ruanganUsed.delete(`${a.ruanganId}:${a.slotId}`);
      kelasUsed.delete(`${a.kelasId}:${a.slotId}`);
    }
  }

  // Backtracking terbatas: coba alokasikan unit-index `u` dari kelas `k`.
  function allocateUnit(
    k: KelasInfo,
    u: number,
    depth: number,
    skipFirst = 0
  ): boolean {
    if (u >= (kelasList.find((x) => x.id === k.id)?.slotPerMinggu ?? 0)) return true;
    const cands = candidatesFor(k);
    for (let i = skipFirst; i < cands.length; i++) {
      const c = cands[i];
      place({ kelasId: k.id, dosenId: k.dosenId, slotId: c.slotId, ruanganId: c.ruanganId });
      if (allocateUnit(k, u + 1, depth)) return true;
      unplace(1);
    }
    // Backtracking: lepas hingga 3 assignment terakhir, coba alternatif
    if (depth < 4 && assigned.length > 0) {
      const last = assigned[assigned.length - 1];
      unplace(1);
      // coba unit ini dengan kandidat yang melewati pilihan awal
      if (last && allocateUnitWithBacktrack(k, u, depth + 1, last)) return true;
      // restore bila gagal
      place(last);
      unplace(1);
    }
    return false;
  }

  // Varian yang mencoba kandidat alternatif untuk unit yang buntu.
  function allocateUnitWithBacktrack(
    k: KelasInfo,
    u: number,
    depth: number,
    avoid: Assignment
  ): boolean {
    const cands = candidatesFor(k).filter(
      (c) => !(c.slotId === avoid.slotId && c.ruanganId === avoid.ruanganId)
    );
    for (const c of cands.slice(0, 12)) {
      place({ kelasId: k.id, dosenId: k.dosenId, slotId: c.slotId, ruanganId: c.ruanganId });
      if (allocateUnit(k, u + 1, depth)) return true;
      unplace(1);
    }
    return false;
  }

  for (const k of order) {
    const info = kelasInfo.get(k.id)!;
    const before = assigned.length;
    const ok = allocateUnit(info, 0, 0);
    if (!ok) {
      unplace(assigned.length - before); // lepas parsial
      gagal.push({
        kelasId: k.id,
        kelas: k.name,
        alasan: `Tidak ditemukan ${k.slotPerMinggu} slot feasible tanpa melanggar hard constraint (kapasitas/ruang/dosen/kelas)`,
      });
    }
  }

  // Tulis ke DB (idempoten: hapus lama dulu)
  await prisma.jadwal.deleteMany({});
  if (assigned.length > 0) {
    await prisma.jadwal.createMany({
      data: assigned.map((a) => ({
        kelasId: a.kelasId,
        dosenId: a.dosenId,
        ruanganId: a.ruanganId,
        slotId: a.slotId,
      })),
    });
  }

  // Verifikasi ulang hasil terhadap hard constraints
  const pelanggaran: Pelanggaran[] = [];
  const seenDosen = new Map<string, number>();
  const seenRuang = new Map<string, number>();
  const seenKelas = new Map<string, number>();
  const ruangCap = new Map<number, RuanganInfo>();
  for (const r of ruanganList) ruangCap.set(r.id, { id: r.id, kapasitas: r.kapasitas });
  for (const a of assigned) {
    const kd = `${a.dosenId}:${a.slotId}`;
    const kr = `${a.ruanganId}:${a.slotId}`;
    const kk = `${a.kelasId}:${a.slotId}`;
    if (seenDosen.has(kd))
      pelanggaran.push({ type: "bentrok_dosen", detail: `dosenId=${a.dosenId} slotId=${a.slotId}` });
    if (seenRuang.has(kr))
      pelanggaran.push({ type: "bentrok_ruangan", detail: `ruanganId=${a.ruanganId} slotId=${a.slotId}` });
    if (seenKelas.has(kk))
      pelanggaran.push({ type: "bentrok_kelas", detail: `kelasId=${a.kelasId} slotId=${a.slotId}` });
    const cap = ruangCap.get(a.ruanganId);
    const ki = kelasInfo.get(a.kelasId);
    if (cap && ki && cap.kapasitas < ki.jumlahMahasiswa)
      pelanggaran.push({
        type: "kapasitas_kurang",
        detail: `kelasId=${a.kelasId} ruanganId=${a.ruanganId}`,
      });
    seenDosen.set(kd, 1);
    seenRuang.set(kr, 1);
    seenKelas.set(kk, 1);
  }

  let totalSkor = 0;
  for (const a of assigned) totalSkor += skorPref.get(`${a.dosenId}:${a.slotId}`) ?? 3;

  return { jadwalDibuat: assigned.length, totalSkorPreferensi: totalSkor, pelanggaran, gagal };
}
