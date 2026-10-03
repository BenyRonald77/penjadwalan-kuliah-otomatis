# Penjadwalan Kuliah Otomatis

Aplikasi penjadwalan kuliah mingguan otomatis. Solver heuristik (greedy + backtracking terbatas, di `lib/jadwal.ts` — OR-Tools tidak dipakai karena library Python) mengalokasikan tiap kelas ke pasangan (slot waktu, ruangan) tanpa melanggar hard constraint dan memaksimalkan total skor preferensi dosen.

## Cara Menjalankan

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

## Halaman

- `/` — Dashboard: tombol "Generate Otomatis", statistik (total jadwal, total skor preferensi, kelas terjadwal/gagal), daftar pelanggaran, grid jadwal per minggu dengan tab **Kelas / Dosen / Ruangan**, form tambah & pindah manual dengan pesan pelanggaran langsung.
- `/master` — Master data: dosen (+ preferensi waktu per slot, skor 1–5), ruangan, slot waktu, kelas.

## API

- `GET/POST /api/dosen`, `DELETE /api/dosen/[id]`
- `POST /api/dosen/[id]/preferensi` (upsert skor), `DELETE /api/dosen/[id]/preferensi` (body `{slotId}`)
- `GET/POST /api/ruangan`, `PUT/DELETE /api/ruangan/[id]`
- `GET/POST /api/slot`, `DELETE /api/slot/[id]`
- `GET/POST /api/kelas`, `PUT/DELETE /api/kelas/[id]`
- `GET/POST /api/jadwal`, `PUT/DELETE /api/jadwal/[id]` (tulis divalidasi hard constraint → 409 bila melanggar)
- `POST /api/jadwal/validate` — body opsional `{jadwal: [...]}`; tanpa body validasi jadwal tersimpan
- `POST /api/solver/run` — jalankan solver (idempoten): `{jadwalDibuat, totalSkorPreferensi, pelanggaran, gagal}`

## Hard constraint

1. Satu dosen max 1 kelas per slot (`bentrok_dosen`)
2. Satu ruangan max 1 kelas per slot (`bentrok_ruangan`)
3. Kapasitas ruangan ≥ jumlah mahasiswa (`kapasitas_kurang`)
4. Satu kelas max 1 jadwal per slot (`bentrok_kelas`)
