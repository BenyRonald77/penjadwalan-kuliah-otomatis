import { PrismaClient, Dosen, Ruangan, SlotWaktu } from "@prisma/client";
const prisma = new PrismaClient();

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
const JAMS: Array<[string, string]> = [
  ["07:00", "09:30"],
  ["10:00", "12:30"],
  ["13:00", "15:30"],
  ["16:00", "18:30"],
];

async function main() {
  const n = await prisma.dosen.count();
  if (n > 0) {
    console.log("seed dilewati (sudah ada data)");
    return;
  }

  const dosenData = [
    { name: "Dr. Ahmad Santoso", nidn: "0411018001" },
    { name: "Dr. Budi Hartono", nidn: "0411027502" },
    { name: "Dra. Citra Lestari", nidn: "0412038203" },
    { name: "Dr. Dedi Kurniawan", nidn: "0410047004" },
    { name: "Dra. Eka Putri", nidn: "0412059005" },
  ];
  const dosen: Dosen[] = [];
  for (const d of dosenData) dosen.push(await prisma.dosen.create({ data: d }));

  const ruanganData = [
    { name: "R.101", kapasitas: 30, fasilitas: "Proyektor, AC" },
    { name: "R.201", kapasitas: 40, fasilitas: "Proyektor, AC, Whiteboard" },
    { name: "Aula A", kapasitas: 60, fasilitas: "Proyektor, Sound System" },
    { name: "Aula Besar", kapasitas: 100, fasilitas: "Proyektor, Sound System, Panggung" },
  ];
  const ruangan: Ruangan[] = [];
  for (const r of ruanganData) ruangan.push(await prisma.ruangan.create({ data: r }));

  const slot: SlotWaktu[] = [];
  for (const hari of HARI) {
    for (const [mulai, selesai] of JAMS) {
      slot.push(
        await prisma.slotWaktu.create({
          data: { hari, jamMulai: mulai, jamSelesai: selesai, label: `${hari} ${mulai}–${selesai}` },
        })
      );
    }
  }
  const slotId = (hari: string, jam: string) =>
    slot.find((s) => s.hari === hari && s.jamMulai === jam)!.id;

  // Preferensi bervariasi: skor 5 = slot favorit, 1 = sangat tidak disukai.
  // Dosen 1 (Ahmad): suka pagi Senin & Selasa, benci sore.
  const pref: Array<[number, string, string, number]> = [
    [0, "Senin", "07:00", 5],
    [0, "Senin", "10:00", 4],
    [0, "Selasa", "07:00", 5],
    [0, "Selasa", "10:00", 4],
    [0, "Rabu", "16:00", 1],
    [0, "Kamis", "16:00", 1],
    [0, "Jumat", "16:00", 1],
    // Dosen 2 (Budi): suka siang-sore.
    [1, "Senin", "13:00", 5],
    [1, "Selasa", "13:00", 5],
    [1, "Rabu", "16:00", 4],
    [1, "Senin", "07:00", 1],
    [1, "Selasa", "07:00", 2],
    // Dosen 3 (Citra): suka Jumat & Rabu pagi.
    [2, "Jumat", "07:00", 5],
    [2, "Jumat", "10:00", 5],
    [2, "Rabu", "07:00", 4],
    [2, "Senin", "16:00", 1],
    [2, "Selasa", "16:00", 2],
    // Dosen 4 (Dedi): suka Kamis & pagi hari.
    [3, "Kamis", "07:00", 5],
    [3, "Kamis", "10:00", 5],
    [3, "Senin", "07:00", 4],
    [3, "Jumat", "13:00", 1],
    [3, "Jumat", "16:00", 1],
    // Dosen 5 (Eka): suka sore, netral pagi.
    [4, "Senin", "16:00", 5],
    [4, "Selasa", "16:00", 5],
    [4, "Rabu", "13:00", 4],
    [4, "Kamis", "13:00", 4],
    [4, "Jumat", "07:00", 2],
  ];
  for (const [di, hari, jam, skor] of pref) {
    await prisma.preferensi.create({
      data: { dosenId: dosen[di].id, slotId: slotId(hari, jam), skor },
    });
  }

  const kelasData = [
    { name: "Kalkulus", jumlahMahasiswa: 90, dosenId: dosen[0].id, slotPerMinggu: 3 },
    { name: "Basis Data", jumlahMahasiswa: 70, dosenId: dosen[1].id, slotPerMinggu: 2 },
    { name: "Kecerdasan Buatan", jumlahMahasiswa: 65, dosenId: dosen[2].id, slotPerMinggu: 2 },
    { name: "Algoritma", jumlahMahasiswa: 55, dosenId: dosen[0].id, slotPerMinggu: 2 },
    { name: "Statistika", jumlahMahasiswa: 45, dosenId: dosen[3].id, slotPerMinggu: 2 },
    { name: "Jaringan Komputer", jumlahMahasiswa: 38, dosenId: dosen[3].id, slotPerMinggu: 2 },
    { name: "Fisika", jumlahMahasiswa: 35, dosenId: dosen[4].id, slotPerMinggu: 2 },
    { name: "Bahasa Inggris", jumlahMahasiswa: 28, dosenId: dosen[4].id, slotPerMinggu: 1 },
  ];
  for (const k of kelasData) await prisma.kelas.create({ data: k });

  console.log("seed selesai: 5 dosen, 4 ruangan, 20 slot, 8 kelas");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
