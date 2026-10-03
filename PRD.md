# PRD — Penjadwalan Kuliah Otomatis

**Stack:** Next.js 14 + TypeScript + Prisma 5.22 + SQLite + Tailwind (App Router; API di `app/api/**/route.ts`; alias `@/*`; `lib/prisma.ts` singleton; seed via `tsx`).

**Deskripsi:** Aplikasi untuk menghasilkan jadwal kuliah mingguan secara otomatis dari data master (dosen, preferensi waktu, ruangan, slot waktu, kelas). Solver heuristik greedy + backtracking terbatas mengalokasikan tiap kelas ke pasangan (slot waktu, ruangan) tanpa pelanggaran hard constraint, sambil memaksimalkan total skor preferensi dosen. UI berbahasa Indonesia: grid jadwal per minggu dengan tab per Kelas / Dosen / Ruangan, generate otomatis, edit manual dengan validasi langsung, halaman master data.

## Model Data

- **Dosen** {name, nidn unique}
- **Preferensi** {dosenId, slotId, skor 1–5, @@unique([dosenId, slotId])} — skor seberapa disukai dosen mengajar di slot tersebut.
- **Ruangan** {name unique, kapasitas, fasilitas}
- **SlotWaktu** {hari: Senin|Selasa|Rabu|Kamis|Jumat, jamMulai, jamSelesai, label, @@unique([hari, jamMulai])}
- **Kelas** {name, jumlahMahasiswa, dosenId, slotPerMinggu}
- **Jadwal** {kelasId, dosenId, ruanganId, slotId, @@unique([dosenId, slotId]), @@unique([ruanganId, slotId]), @@unique([kelasId, slotId])}

Relasi: Kelas → Dosen (dosen pengampu). Jadwal merujuk Kelas, Dosen (redundan untuk validasi cepat), Ruangan, SlotWaktu.

## Penyesuaian Stack (documented decision)

OR-Tools TIDAK dipakai (library Python, tidak tersedia untuk TypeScript di VM ini). Sebagai gantinya, solver heuristik diimplementasikan sendiri di TypeScript di `lib/solver.ts`:

### Algoritma solver
1. **Sort kelas tersulit dulu**: urutkan kelas menurun berdasarkan `jumlahMahasiswa` (ruangan besar paling langka), lalu `slotPerMinggu` (paling banyak), lalu id.
2. **Greedy per kelas**: untuk tiap unit kebutuhan (slotPerMinggu) kelas, enumerasi semua pasangan (slot, ruangan) yang *feasible* terhadap state saat ini:
   - hard constraints (lihat bawah),
   - skor preferensi dosen pengampu untuk slot tersebut (default 3 jika tidak ada preferensi eksplisit).
   Pilih pasangan dengan skor tertinggi (tie-break: slot paling awal, ruangan terkecil yang cukup).
3. **Backtracking terbatas**: jika suatu kelas buntu (tidak ada pasangan feasible untuk salah satu unitnya), lepas hingga N=3 assignment terakhir dan coba alternatif kedua-terbaik secara rekursif (max depth 4). Jika tetap buntu, kelas dicatat sebagai *gagal terjadwal* dengan alasan, assignment parsialnya dilepas.
4. **Idempoten**: solver menghapus seluruh jadwal lama sebelum mulai.

### Daftar constraint
**Hard** (pelanggaran → assignment tidak pernah dibuat):
- (a) Satu dosen maksimal 1 kelas per slot (`bentrok_dosen`).
- (b) Satu ruangan maksimal 1 kelas per slot (`bentrok_ruangan`).
- (c) Kapasitas ruangan ≥ jumlah mahasiswa kelas (`kapasitas_kurang`).
- (d) Satu kelas maksimal 1 jadwal per slot (`bentrok_kelas`).

**Soft**: maksimalkan total skor preferensi dosen (Σ skor per jadwal).

## Fungsionalitas

- **F0**: Scaffold + PRD.md + schema Prisma + seed.
- **F1**: CRUD master:
  - `GET/POST /api/dosen`, `DELETE /api/dosen/[id]` (blokir jika masih dipakai kelas/jadwal → 409); `POST /api/dosen/[id]/preferensi` set skor 1–5 per slot (upsert), `DELETE /api/dosen/[id]/preferensi` (body slotId) hapus satu preferensi.
  - `GET/POST /api/ruangan`, `PUT/DELETE /api/ruangan/[id]` (blokir hapus bila dipakai jadwal → 409).
  - `GET/POST /api/slot`, `DELETE /api/slot/[id]` (blokir hapus bila dipakai → 409).
  - `GET/POST /api/kelas`, `PUT/DELETE /api/kelas/[id]` (blokir hapus bila ada jadwal → 409); validasi slotPerMinggu ≥ 1 dan ≤ jumlah slot tersedia.
- **F2**: `POST /api/solver/run` — jalankan solver; respons: `{ jadwalDibuat, totalSkorPreferensi, pelanggaran: [], gagal: [{kelasId, kelas, alasan}] }`. Idempoten (hapus jadwal lama dulu).
- **F3**: `POST /api/jadwal/validate` — body opsional `{jadwal: [{kelasId, dosenId, ruanganId, slotId}]}`; tanpa body → validasi jadwal tersimpan. Respons `{pelanggaran: [{type, detail}], valid: boolean}`. Type: `bentrok_dosen | bentrok_ruangan | kapasitas_kurang | bentrok_kelas`.
- **F4**: Edit manual — `POST /api/jadwal` (tambah), `PUT /api/jadwal/[id]` (pindah slot/ruangan), `DELETE /api/jadwal/[id]`. Setiap tulis divalidasi terhadap hard constraints → **409** + daftar pelanggaran bila melanggar. `GET /api/jadwal` list dengan relasi.
- **F5**: UI (Bahasa Indonesia):
  - `/` dashboard: tombol "Generate Otomatis", statistik (total jadwal, total skor preferensi, kelas terjadwal/gagal), daftar pelanggaran, grid jadwal per minggu.
  - Tab tampilan grid: per Kelas / per Dosen / per Ruangan.
  - Form tambah/pindah manual dengan pesan pelanggaran langsung.
  - Halaman `/master` (dosen + preferensi, ruangan, slot, kelas), halaman `/jadwal` (grid + manual edit).

## Seed

- 5 dosen (Dr. Ahmad Santoso, Dr. Budi Hartono, Dra. Citra Lestari, Dr. Dedi Kurniawan, Dra. Eka Putri) dengan preferensi bervariasi (skor 1–5, sebagian slot tanpa preferensi).
- 4 ruangan: R.101 (30), R.201 (40), Aula A (60), Aula Besar (100).
- 20 slot: Senin–Jumat × 4 slot/hari (07:00, 10:00, 13:00, 16:00), label mis. "Senin 07:00–09:30".
- 8 kelas: jumlah mahasiswa & slot/minggu bervariasi (mis. Algoritma 55 mhs/2 slot, Basis Data 70/2, Kalkulus 90/3, Fisika 35/2, Bahasa Inggris 28/1, Statistika 45/2, Jaringan Komputer 38/2, Kecerdasan Buatan 65/2) dengan dosen pengampu.

## Pengujian

- `npm run build` wajib lolos.
- curl: solver → 200, 0 pelanggaran, semua kelas terjadwal penuh (Σ slotPerMinggu jadwal = total kebutuhan); validate jadwal solver → pelanggaran kosong; buat jadwal manual bentrok dosen → 409; ruangan kapasitas 30 untuk kelas 60 → 409 `kapasitas_kurang`; pindah manual valid → 200; preferensi: totalSkorPreferensi > 0 dan masuk akal (dosen dengan preferensi 5 di slot X idealnya dapat slot itu bila feasible).
