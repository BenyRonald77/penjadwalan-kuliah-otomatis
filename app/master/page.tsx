"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Slot { id: number; hari: string; jamMulai: string; jamSelesai: string; label: string }
interface Preferensi { id: number; slotId: number; skor: number; slot: Slot }
interface Dosen { id: number; name: string; nidn: string; preferensi: Preferensi[] }
interface Ruangan { id: number; name: string; kapasitas: number; fasilitas: string | null }
interface Kelas { id: number; name: string; jumlahMahasiswa: number; dosenId: number; slotPerMinggu: number; dosen?: { name: string } }

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

export default function Master() {
  const [tab, setTab] = useState<"dosen" | "ruangan" | "slot" | "kelas">("dosen");
  const [dosen, setDosen] = useState<Dosen[]>([]);
  const [ruangan, setRuangan] = useState<Ruangan[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [pesan, setPesan] = useState<string | null>(null);

  const [dosenForm, setDosenForm] = useState({ name: "", nidn: "" });
  const [ruangForm, setRuangForm] = useState({ name: "", kapasitas: "", fasilitas: "" });
  const [slotForm, setSlotForm] = useState({ hari: "Senin", jamMulai: "07:00", jamSelesai: "09:30" });
  const [kelasForm, setKelasForm] = useState({ name: "", jumlahMahasiswa: "", dosenId: "", slotPerMinggu: "2" });
  const [prefForm, setPrefForm] = useState({ dosenId: "", slotId: "", skor: "5" });

  const muat = useCallback(async () => {
    const [d, r, s, k] = await Promise.all([
      fetch("/api/dosen").then((x) => x.json()),
      fetch("/api/ruangan").then((x) => x.json()),
      fetch("/api/slot").then((x) => x.json()),
      fetch("/api/kelas").then((x) => x.json()),
    ]);
    setDosen(d); setRuangan(r); setSlots(s); setKelas(k);
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const slotUrut = useMemo(
    () => [...slots].sort((a, b) => HARI.indexOf(a.hari) - HARI.indexOf(b.hari) || a.jamMulai.localeCompare(b.jamMulai)),
    [slots]
  );

  const post = async (url: string, body: object) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) setPesan(`Gagal (${r.status}): ${data.error ?? "?"}`);
    else { setPesan("Berhasil disimpan"); await muat(); }
  };
  const del = async (url: string) => {
    const r = await fetch(url, { method: "DELETE" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) setPesan(`Gagal (${r.status}): ${data.error ?? "?"}`);
    else { setPesan("Berhasil dihapus"); await muat(); }
  };


  const inp = "rounded border p-2 text-sm";
  const btn = "rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700";

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Master Data</h1>
        <Link href="/" className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">← Dashboard</Link>
      </div>
      {pesan && <div className="mb-4 rounded border bg-amber-50 p-3 text-sm">{pesan}</div>}

      <div className="mb-4 flex gap-2">
        {(["dosen", "ruangan", "slot", "kelas"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded px-4 py-2 text-sm font-medium ${tab === t ? "bg-blue-600 text-white" : "bg-white text-slate-700 border"}`}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "dosen" && (
        <div>
          <form onSubmit={(e) => { e.preventDefault(); post("/api/dosen", dosenForm).then(() => setDosenForm({ name: "", nidn: "" })); }} className="mb-4 flex gap-2 rounded border bg-white p-4">
            <input value={dosenForm.name} onChange={(e) => setDosenForm({ ...dosenForm, name: e.target.value })} placeholder="Nama dosen" className={inp} required />
            <input value={dosenForm.nidn} onChange={(e) => setDosenForm({ ...dosenForm, nidn: e.target.value })} placeholder="NIDN" className={inp} required />
            <button className={btn}>Tambah Dosen</button>
          </form>

          <form onSubmit={(e) => { e.preventDefault(); post(`/api/dosen/${prefForm.dosenId}/preferensi`, { slotId: Number(prefForm.slotId), skor: Number(prefForm.skor) }); }} className="mb-4 flex flex-wrap items-end gap-2 rounded border bg-white p-4">
            <label className="text-sm">Set preferensi:
              <select value={prefForm.dosenId} onChange={(e) => setPrefForm({ ...prefForm, dosenId: e.target.value })} className={inp + " ml-2"} required>
                <option value="">— dosen —</option>
                {dosen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <select value={prefForm.slotId} onChange={(e) => setPrefForm({ ...prefForm, slotId: e.target.value })} className={inp} required>
              <option value="">— slot —</option>
              {slotUrut.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={prefForm.skor} onChange={(e) => setPrefForm({ ...prefForm, skor: e.target.value })} className={inp}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className={btn}>Simpan Skor</button>
          </form>

          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full border-collapse text-sm">
              <thead><tr><th className="border p-2 text-left">Dosen</th><th className="border p-2 text-left">NIDN</th><th className="border p-2 text-left">Preferensi (per slot, kosong = netral 3)</th><th className="border p-2"></th></tr></thead>
              <tbody>
                {dosen.map((d) => (
                  <tr key={d.id}>
                    <td className="border p-2 font-medium">{d.name}</td>
                    <td className="border p-2">{d.nidn}</td>
                    <td className="border p-2">
                      {d.preferensi.length === 0 ? <span className="text-slate-400">—</span> : (
                        <div className="flex flex-wrap gap-1">
                          {d.preferensi.map((p) => (
                            <span key={p.id} title={p.slot.label} className={`rounded px-2 py-0.5 text-xs font-semibold ${p.skor >= 4 ? "bg-green-100 text-green-800" : p.skor <= 2 ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>
                              {p.slot.hari.slice(0, 3)} {p.slot.jamMulai}: {p.skor}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="border p-2"><button onClick={() => { if (confirm(`Hapus dosen ${d.name}?`)) del(`/api/dosen/${d.id}`); }} className="text-red-600 hover:underline">hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "ruangan" && (
        <div>
          <form onSubmit={(e) => { e.preventDefault(); post("/api/ruangan", { ...ruangForm, kapasitas: Number(ruangForm.kapasitas) }).then(() => setRuangForm({ name: "", kapasitas: "", fasilitas: "" })); }} className="mb-4 flex gap-2 rounded border bg-white p-4">
            <input value={ruangForm.name} onChange={(e) => setRuangForm({ ...ruangForm, name: e.target.value })} placeholder="Nama ruangan" className={inp} required />
            <input value={ruangForm.kapasitas} onChange={(e) => setRuangForm({ ...ruangForm, kapasitas: e.target.value })} placeholder="Kapasitas" type="number" min="1" className={inp} required />
            <input value={ruangForm.fasilitas} onChange={(e) => setRuangForm({ ...ruangForm, fasilitas: e.target.value })} placeholder="Fasilitas" className={inp} />
            <button className={btn}>Tambah Ruangan</button>
          </form>
          <div className="rounded border bg-white">
            <table className="w-full border-collapse text-sm">
              <thead><tr><th className="border p-2 text-left">Nama</th><th className="border p-2">Kapasitas</th><th className="border p-2 text-left">Fasilitas</th><th className="border p-2"></th></tr></thead>
              <tbody>
                {ruangan.map((r) => (
                  <tr key={r.id}>
                    <td className="border p-2 font-medium">{r.name}</td>
                    <td className="border p-2 text-center">{r.kapasitas}</td>
                    <td className="border p-2">{r.fasilitas ?? "—"}</td>
                    <td className="border p-2"><button onClick={() => { if (confirm(`Hapus ruangan ${r.name}?`)) del(`/api/ruangan/${r.id}`); }} className="text-red-600 hover:underline">hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "slot" && (
        <div>
          <form onSubmit={(e) => { e.preventDefault(); post("/api/slot", slotForm); }} className="mb-4 flex gap-2 rounded border bg-white p-4">
            <select value={slotForm.hari} onChange={(e) => setSlotForm({ ...slotForm, hari: e.target.value })} className={inp}>
              {HARI.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <input value={slotForm.jamMulai} onChange={(e) => setSlotForm({ ...slotForm, jamMulai: e.target.value })} type="time" className={inp} required />
            <input value={slotForm.jamSelesai} onChange={(e) => setSlotForm({ ...slotForm, jamSelesai: e.target.value })} type="time" className={inp} required />
            <button className={btn}>Tambah Slot</button>
          </form>
          <div className="grid gap-4 md:grid-cols-5">
            {HARI.map((h) => (
              <div key={h} className="rounded border bg-white p-3">
                <h3 className="mb-2 font-semibold">{h}</h3>
                {slotUrut.filter((s) => s.hari === h).map((s) => (
                  <div key={s.id} className="mb-1 flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-sm">
                    <span>{s.jamMulai}–{s.jamSelesai}</span>
                    <button onClick={() => { if (confirm(`Hapus slot ${s.label}?`)) del(`/api/slot/${s.id}`); }} className="text-red-600 hover:underline">✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "kelas" && (
        <div>
          <form onSubmit={(e) => { e.preventDefault(); post("/api/kelas", { ...kelasForm, jumlahMahasiswa: Number(kelasForm.jumlahMahasiswa), dosenId: Number(kelasForm.dosenId), slotPerMinggu: Number(kelasForm.slotPerMinggu) }).then(() => setKelasForm({ name: "", jumlahMahasiswa: "", dosenId: "", slotPerMinggu: "2" })); }} className="mb-4 flex flex-wrap gap-2 rounded border bg-white p-4">
            <input value={kelasForm.name} onChange={(e) => setKelasForm({ ...kelasForm, name: e.target.value })} placeholder="Nama kelas" className={inp} required />
            <input value={kelasForm.jumlahMahasiswa} onChange={(e) => setKelasForm({ ...kelasForm, jumlahMahasiswa: e.target.value })} placeholder="Jml mahasiswa" type="number" min="1" className={inp} required />
            <select value={kelasForm.dosenId} onChange={(e) => setKelasForm({ ...kelasForm, dosenId: e.target.value })} className={inp} required>
              <option value="">— dosen pengampu —</option>
              {dosen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input value={kelasForm.slotPerMinggu} onChange={(e) => setKelasForm({ ...kelasForm, slotPerMinggu: e.target.value })} placeholder="Slot/minggu" type="number" min="1" className={inp} required />
            <button className={btn}>Tambah Kelas</button>
          </form>
          <div className="rounded border bg-white">
            <table className="w-full border-collapse text-sm">
              <thead><tr><th className="border p-2 text-left">Kelas</th><th className="border p-2">Mahasiswa</th><th className="border p-2 text-left">Dosen</th><th className="border p-2">Slot/Minggu</th><th className="border p-2"></th></tr></thead>
              <tbody>
                {kelas.map((k) => (
                  <tr key={k.id}>
                    <td className="border p-2 font-medium">{k.name}</td>
                    <td className="border p-2 text-center">{k.jumlahMahasiswa}</td>
                    <td className="border p-2">{k.dosen?.name ?? k.dosenId}</td>
                    <td className="border p-2 text-center">{k.slotPerMinggu}</td>
                    <td className="border p-2"><button onClick={() => { if (confirm(`Hapus kelas ${k.name}?`)) del(`/api/kelas/${k.id}`); }} className="text-red-600 hover:underline">hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
