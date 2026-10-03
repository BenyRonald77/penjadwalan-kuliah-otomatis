"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Slot { id: number; hari: string; jamMulai: string; jamSelesai: string; label: string }
interface Kelas { id: number; name: string; jumlahMahasiswa: number; dosenId: number; slotPerMinggu: number; dosen?: { name: string } }
interface Dosen { id: number; name: string }
interface Ruangan { id: number; name: string; kapasitas: number }
interface Jadwal {
  id: number; kelasId: number; dosenId: number; ruanganId: number; slotId: number;
  kelas: Kelas; dosen: Dosen; ruangan: Ruangan; slot: Slot;
}
interface Pelanggaran { type: string; detail: string }
interface SolverResult { jadwalDibuat: number; totalSkorPreferensi: number; pelanggaran: Pelanggaran[]; gagal: Array<{ kelasId: number; kelas: string; alasan: string }> }

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
const HARI_ORDER: Record<string, number> = { Senin: 0, Selasa: 1, Rabu: 2, Kamis: 3, Jumat: 4 };

export default function Dashboard() {
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [dosen, setDosen] = useState<Dosen[]>([]);
  const [ruangan, setRuangan] = useState<Ruangan[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tab, setTab] = useState<"kelas" | "dosen" | "ruangan">("kelas");
  const [loading, setLoading] = useState(false);
  const [solver, setSolver] = useState<SolverResult | null>(null);
  const [valid, setValid] = useState<{ valid: boolean; pelanggaran: Pelanggaran[] } | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [formTambah, setFormTambah] = useState({ kelasId: "", ruanganId: "", slotId: "" });
  const [formPindah, setFormPindah] = useState({ jadwalId: "", ruanganId: "", slotId: "" });

  const muat = useCallback(async () => {
    const [j, k, d, r, s] = await Promise.all([
      fetch("/api/jadwal").then((x) => x.json()),
      fetch("/api/kelas").then((x) => x.json()),
      fetch("/api/dosen").then((x) => x.json()),
      fetch("/api/ruangan").then((x) => x.json()),
      fetch("/api/slot").then((x) => x.json()),
    ]);
    setJadwal(j);
    setKelas(k);
    setDosen(d);
    setRuangan(r);
    setSlots(s);
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const slotUrut = useMemo(
    () => [...slots].sort((a, b) => HARI_ORDER[a.hari] - HARI_ORDER[b.hari] || a.jamMulai.localeCompare(b.jamMulai)),
    [slots]
  );
  const slotIdsPerHari = useMemo(() => {
    const m: Record<string, number[]> = {};
    for (const h of HARI) m[h] = slotUrut.filter((s) => s.hari === h).map((s) => s.id);
    return m;
  }, [slotUrut]);
  const slotLabel = useMemo(() => {
    const m: Record<number, string> = {};
    for (const s of slots) m[s.id] = `${s.jamMulai}–${s.jamSelesai}`;
    return m;
  }, [slots]);

  const rows = useMemo(() => {
    if (tab === "kelas") return kelas.map((k) => ({ id: k.id, nama: `${k.name} (${k.jumlahMahasiswa} mhs)` }));
    if (tab === "dosen") return dosen.map((d) => ({ id: d.id, nama: d.name }));
    return ruangan.map((r) => ({ id: r.id, nama: `${r.name} (kap. ${r.kapasitas})` }));
  }, [tab, kelas, dosen, ruangan]);

  const cellOf = useCallback(
    (rowId: number, slotId: number) => {
      const js = jadwal.filter((j) =>
        tab === "kelas" ? j.kelasId === rowId && j.slotId === slotId
        : tab === "dosen" ? j.dosenId === rowId && j.slotId === slotId
        : j.ruanganId === rowId && j.slotId === slotId
      );
      return js;
    },
    [jadwal, tab]
  );

  const generate = async () => {
    setLoading(true);
    setPesan(null);
    const r = await fetch("/api/solver/run", { method: "POST" });
    const data: SolverResult = await r.json();
    setSolver(data);
    await muat();
    const v = await fetch("/api/jadwal/validate", { method: "POST" }).then((x) => x.json());
    setValid(v);
    setLoading(false);
  };

  const tambah = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesan(null);
    const k = kelas.find((x) => x.id === Number(formTambah.kelasId));
    if (!k) { setPesan("Pilih kelas dulu"); return; }
    const r = await fetch("/api/jadwal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kelasId: k.id,
        ruanganId: Number(formTambah.ruanganId),
        slotId: Number(formTambah.slotId),
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      const p = (data.pelanggaran ?? []).map((x: Pelanggaran) => `${x.type}: ${x.detail}`).join(" | ");
      setPesan(`Gagal (${r.status}): ${data.error}${p ? " — " + p : ""}`);
    } else {
      setPesan(`Jadwal ditambahkan: ${k.name} @ ${slotLabel[Number(formTambah.slotId)]}`);
      setFormTambah({ kelasId: "", ruanganId: "", slotId: "" });
      await muat();
    }
  };

  const pindah = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesan(null);
    const r = await fetch(`/api/jadwal/${formPindah.jadwalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruanganId: Number(formPindah.ruanganId),
        slotId: Number(formPindah.slotId),
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      const p = (data.pelanggaran ?? []).map((x: Pelanggaran) => `${x.type}: ${x.detail}`).join(" | ");
      setPesan(`Gagal (${r.status}): ${data.error}${p ? " — " + p : ""}`);
    } else {
      setPesan(`Jadwal #${formPindah.jadwalId} dipindah`);
      setFormPindah({ jadwalId: "", ruanganId: "", slotId: "" });
      await muat();
    }
  };

  const hapus = async (id: number) => {
    if (!confirm(`Hapus jadwal #${id}?`)) return;
    await fetch(`/api/jadwal/${id}`, { method: "DELETE" });
    await muat();
  };

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Penjadwalan Kuliah Otomatis</h1>
          <p className="text-sm text-slate-500">Solver heuristik greedy + backtracking · hard constraint tervalidasi</p>
        </div>
        <Link href="/master" className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">
          Master Data
        </Link>
      </div>

      <div className="mb-6 rounded border bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={generate}
            disabled={loading}
            className="rounded bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Menjalankan solver…" : "⚙ Generate Otomatis"}
          </button>
          {solver && (
            <div className="flex gap-6 text-sm">
              <span>Jadwal dibuat: <b>{solver.jadwalDibuat}</b></span>
              <span>Total skor preferensi: <b>{solver.totalSkorPreferensi}</b></span>
              <span>Pelanggaran: <b className={solver.pelanggaran.length ? "text-red-600" : "text-green-600"}>{solver.pelanggaran.length}</b></span>
              <span>Kelas gagal: <b className={solver.gagal.length ? "text-red-600" : "text-green-600"}>{solver.gagal.length}</b></span>
            </div>
          )}
        </div>
        {solver && solver.gagal.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-red-700">
            {solver.gagal.map((g) => <li key={g.kelasId}><b>{g.kelas}</b>: {g.alasan}</li>)}
          </ul>
        )}
        {valid && !valid.valid && (
          <div className="mt-3 text-sm text-red-700">
            <b>Validasi menemukan pelanggaran:</b>
            <ul className="list-disc pl-5">{valid.pelanggaran.map((p, i) => <li key={i}>{p.type}: {p.detail}</li>)}</ul>
          </div>
        )}
        {valid && valid.valid && <p className="mt-3 text-sm text-green-700">✓ Jadwal tersimpan valid (tanpa pelanggaran).</p>}
      </div>

      {pesan && <div className="mb-4 rounded border bg-amber-50 p-3 text-sm">{pesan}</div>}

      <div className="mb-4 flex gap-2">
        {(["kelas", "dosen", "ruangan"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-4 py-2 text-sm font-medium ${tab === t ? "bg-blue-600 text-white" : "bg-white text-slate-700 border"}`}
          >
            Per {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border p-2 text-left">{tab === "kelas" ? "Kelas" : tab === "dosen" ? "Dosen" : "Ruangan"}</th>
              {HARI.map((h) => (
                <th key={h} colSpan={Math.max(slotIdsPerHari[h].length, 1)} className="border p-2">{h}</th>
              ))}
            </tr>
            <tr>
              <th className="border p-2"></th>
              {HARI.flatMap((h) =>
                slotIdsPerHari[h].length
                  ? slotIdsPerHari[h].map((id) => <th key={id} className="border p-1 text-xs font-normal">{slotLabel[id]}</th>)
                  : [<th key={h} className="border p-1"></th>]
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="border p-2 font-medium">{row.nama}</td>
                {HARI.flatMap((h) =>
                  slotIdsPerHari[h].length
                    ? slotIdsPerHari[h].map((sid) => {
                        const js = cellOf(row.id, sid);
                        return (
                          <td key={sid} className="border p-1 align-top">
                            {js.map((j) => (
                              <div key={j.id} className="mb-1 rounded bg-blue-50 p-1 text-xs">
                                <div className="font-semibold">{j.kelas.name}</div>
                                <div>{j.dosen.name}</div>
                                <div className="text-slate-500">{j.ruangan.name}</div>
                                <button onClick={() => hapus(j.id)} className="mt-1 text-red-600 hover:underline">hapus</button>
                              </div>
                            ))}
                          </td>
                        );
                      })
                    : [<td key={h} className="border p-1"></td>]
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <form onSubmit={tambah} className="rounded border bg-white p-4">
          <h2 className="mb-3 font-semibold">Tambah Jadwal Manual</h2>
          <div className="space-y-2 text-sm">
            <select value={formTambah.kelasId} onChange={(e) => setFormTambah({ ...formTambah, kelasId: e.target.value })} className="w-full rounded border p-2" required>
              <option value="">— Pilih kelas —</option>
              {kelas.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.jumlahMahasiswa} mhs, dosen: {k.dosen?.name})</option>)}
            </select>
            <select value={formTambah.ruanganId} onChange={(e) => setFormTambah({ ...formTambah, ruanganId: e.target.value })} className="w-full rounded border p-2" required>
              <option value="">— Pilih ruangan —</option>
              {ruangan.map((r) => <option key={r.id} value={r.id}>{r.name} (kap. {r.kapasitas})</option>)}
            </select>
            <select value={formTambah.slotId} onChange={(e) => setFormTambah({ ...formTambah, slotId: e.target.value })} className="w-full rounded border p-2" required>
              <option value="">— Pilih slot —</option>
              {slotUrut.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">Tambah</button>
          </div>
        </form>

        <form onSubmit={pindah} className="rounded border bg-white p-4">
          <h2 className="mb-3 font-semibold">Pindah Jadwal (Manual)</h2>
          <div className="space-y-2 text-sm">
            <select value={formPindah.jadwalId} onChange={(e) => setFormPindah({ ...formPindah, jadwalId: e.target.value })} className="w-full rounded border p-2" required>
              <option value="">— Pilih jadwal —</option>
              {jadwal.map((j) => <option key={j.id} value={j.id}>#{j.id} {j.kelas.name} — {j.slot.label} @ {j.ruangan.name}</option>)}
            </select>
            <select value={formPindah.ruanganId} onChange={(e) => setFormPindah({ ...formPindah, ruanganId: e.target.value })} className="w-full rounded border p-2" required>
              <option value="">— Ruangan baru —</option>
              {ruangan.map((r) => <option key={r.id} value={r.id}>{r.name} (kap. {r.kapasitas})</option>)}
            </select>
            <select value={formPindah.slotId} onChange={(e) => setFormPindah({ ...formPindah, slotId: e.target.value })} className="w-full rounded border p-2" required>
              <option value="">— Slot baru —</option>
              {slotUrut.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700">Pindah</button>
          </div>
        </form>
      </div>
    </main>
  );
}
