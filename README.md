# Platform Klien Ekspor — Mobile

Aplikasi klien mobile untuk katalog produk dan pengiriman **inquiry** kepada backend. Frontend menggunakan Expo/React Native, sedangkan API mandiri dan penyimpanan lokal berjalan pada Node.js. Repository ini juga menyediakan mekanisme peer-to-peer untuk mereplikasi inquiry antar-backend Web, Mobile, dan Desktop.

> **Status produk:** MVP/pengembangan. Gunakan data sintetis atau demo saja. Dokumentasi ini bukan pernyataan bahwa sistem telah lulus audit keamanan, siap produksi, atau sesuai regulasi tertentu.

## Daftar isi

- [Ringkasan](#ringkasan)
- [Arsitektur sistem](#arsitektur-sistem)
- [Komponen dan tanggung jawab](#komponen-dan-tanggung-jawab)
- [Alur data](#alur-data)
- [API](#api)
- [Peer sync dan konsistensi data](#peer-sync-dan-konsistensi-data)
- [Konfigurasi dan keamanan](#konfigurasi-dan-keamanan)
- [Menjalankan aplikasi](#menjalankan-aplikasi)
- [Pengujian dan quality gates](#pengujian-dan-quality-gates)
- [Kepatuhan ekspor global dan Syariah](#kepatuhan-ekspor-global-dan-syariah)
- [Pembayaran ekspor, sampel, dan ketentuan komersial](#pembayaran-ekspor-sampel-dan-ketentuan-komersial)
- [Audit kekurangan README](#audit-kekurangan-readme)
- [Batasan MVP dan langkah lanjutan](#batasan-mvp-dan-langkah-lanjutan)
- [Kebutuhan Pengguna Aplikasi Mobile Supply Chain](#kebutuhan-pengguna-aplikasi-mobile-supply-chain)
- [Model Single-Enterprise](#model-single-enterprise)
- [Fitur Buyer dan Seller](#fitur-buyer-dan-seller)

## Ringkasan

- **Mobile UI:** Expo + React Native.
- **Runtime API:** Node.js 22 atau lebih baru, Express 5.
- **Penyimpanan lokal backend:** SQLite melalui `better-sqlite3`.
- **Model inquiry:** catatan inquiry bersifat append-only; tidak tersedia alur edit atau hapus inquiry pada kontrak MVP yang dijelaskan di sini.
- **Sinkronisasi:** opsional, berbasis peer, dengan outbox persisten, retry/backoff, timeout, dan pencatatan konflik.
- **Data katalog:** katalog demo; jangan menganggapnya sebagai katalog produksi.
- **Tidak ada deployment otomatis** dari perintah export Android yang dijelaskan pada README ini.

## Roadmap arsitektur transaksi ekspor

Implementasi dibagi menjadi lima tahap berurutan. Tahapan ini adalah **rencana arsitektur dan gerbang penerimaan**, bukan klaim bahwa seluruh fitur sudah tersedia. Gunakan data sintetis sampai keamanan, legal/kepabeanan, dan review Syariah yang relevan disetujui.

### Tahap 1 — Fondasi transaksi

- Katalog ekspor dengan klasifikasi produk, termasuk SKU, spesifikasi, negara asal, dan klasifikasi HS yang diverifikasi sesuai komoditas.
- Alur bisnis **inquiry → quotation → order → kontrak**, dengan status, versi, tenggat, pembatalan/perubahan, dan jejak persetujuan.
- Tenant isolation, autentikasi, otorisasi server-side, dan audit trail untuk setiap akses serta perubahan penting.

**Gerbang penerimaan:** uji positif dan negatif isolasi lintas tenant, otorisasi per objek, transisi status yang sah, serta jejak audit yang dapat ditelusuri.

### Tahap 2 — Sampel dan dokumen

- Mendukung sampel berbayar maupun gratis.
- Mendukung prototype dan pengiriman sementara untuk evaluasi atau penggunaan terbatas.
- Kelola dokumen dan status verifikasi, tenggat, retur/pengembalian, serta bukti pengiriman dan penerimaan.

**Gerbang penerimaan:** setiap sampel memiliki tujuan, pihak penanggung biaya, nilai pabean yang akurat, dokumen yang diperlukan, tenggat, status, dan bukti pengiriman/retur. Sampel gratis tidak otomatis bernilai pabean nol atau bebas bea/izin.

### Tahap 3 — Pembayaran

- Advance payment/pembayaran di muka.
- Deposit dan pembayaran berdasarkan milestone.
- Rekonsiliasi pembayaran, refund/reversal, serta pencatatan multi-mata uang dengan jumlah, kode mata uang, kurs/sumber kurs, biaya, dan waktu yang jelas.
- Integrasi provider dimulai di **sandbox**; transaksi nyata tidak diaktifkan sebelum integrasi, rekonsiliasi, keamanan, dan persetujuan terkait diverifikasi.

**Gerbang penerimaan:** idempotency, verifikasi signature webhook, penanganan pembayaran parsial/duplikat, refund, rekonsiliasi terhadap sumber tepercaya, dan pengujian kegagalan. Status *settled* tidak boleh ditentukan hanya dari input klien atau screenshot.

### Tahap 4 — Metode pembayaran perdagangan internasional

- Documentary Collection **D/P (Documents against Payment)** dan **D/A (Documents against Acceptance)**.
- **Letter of Credit (LC)**.
- Jaminan bank, standby LC, dan produk pembiayaan perdagangan yang relevan untuk transaksi.

Metode ini dimasukkan setelah kebutuhan bank/provider, negara, mata uang, kontrak, komoditas, dan persetujuan hukum serta Syariah ditentukan. Cantuman dalam roadmap bukan bukti integrasi tersedia atau bahwa suatu metode otomatis sesuai Syariah.

**Gerbang penerimaan:** persyaratan dokumen dan tenggat, pihak/bank terkait, biaya, kondisi klaim atau penolakan dokumen, penanganan discrepancy, serta review hukum dan Syariah untuk struktur transaksi yang sebenarnya telah didokumentasikan.

### Tahap 5 — Gerbang kepatuhan

- Validasi aturan Indonesia sebagai negara asal serta negara tujuan dan transit, sesuai komoditas, klasifikasi, pihak, rute, dan tanggal transaksi.
- Review legal dan kepabeanan dengan bukti dan versi aturan yang berlaku.
- Review Syariah berdasarkan akad dan alur transaksi yang sebenarnya.
- Pengujian keamanan, tenant isolation, integrasi, CI, serta persetujuan manusia sebelum go-live.

**Gerbang penerimaan:** keputusan memiliki pemilik/reviewer, sumber dan versi aturan, bukti pemeriksaan, waktu berlaku, status/masa berlaku, serta audit trail. Sistem harus menahan atau mengeskalasi kasus yang belum jelas; AI dan klien mobile tidak boleh memberi persetujuan akhir. Go-live memerlukan bukti CI untuk commit kandidat dan persetujuan manusia yang berwenang.

## Arsitektur sistem

### Diagram konteks

```text
┌─────────────────────────────────────┐
│ Mobile App                          │
│ Expo / React Native                 │
│ UI katalog + form inquiry + tracking│
└──────────────────┬──────────────────┘
                   │ HTTP API
                   │ EXPO_PUBLIC_API_URL
                   ▼
┌─────────────────────────────────────┐
│ Mobile Backend Node.js + Express    │
│                                     │
│ REST routes / validation            │
│ Inquiry handling                    │
│ Health + product catalog            │
│ Internal peer-sync endpoint         │
└──────────────┬───────────────┬──────┘
               │               │
               ▼               ▼
┌──────────────────────┐  ┌────────────────────────┐
│ SQLite               │  │ Persistent sync outbox │
│ api.sqlite           │  │ + conflict log         │
│ inquiry/catalog data │  │ retry/backoff          │
└──────────────────────┘  └────────────┬───────────┘
                                       │ authenticated HTTPS
                                       ▼
                         ┌──────────────────────────┐
                         │ Configured peer backends │
                         │ Web / Desktop / other    │
                         └──────────────────────────┘
```

Diagram ini menggambarkan batas komponen dan alur tingkat tinggi, bukan diagram deployment produksi. Setiap peer menyimpan data lokal; arsitektur ini **bukan** database terpusat dengan satu master.

### Rantai pasok ekspor: perkebunan → packing house → gudang → pelabuhan

Arsitektur bisnis juga perlu memodelkan rantai pasok fisik dari sumber komoditas hingga keberangkatan ekspor. Lokasi-lokasi ini adalah entitas operasional yang dapat dikelola atau dihubungkan melalui platform; pencantumannya **tidak berarti fasilitas fisik atau integrasi logistik telah tersedia**.

```text
┌────────────────────────┐
│ Perkebunan / pemasok   │
│ kebun, petani, panen   │
└────────────┬───────────┘
             │ lot panen + asal + waktu
             ▼
┌────────────────────────┐
│ Collection / Packing   │
│ House                  │
│ timbang, sortasi, mutu │
│ grading, kemasan       │
└────────────┬───────────┘
             │ lot produksi + QC + label
             ▼
┌────────────────────────┐
│ Gudang                 │
│ stok, lokasi, kondisi, │
│ batch, FEFO/FIFO       │
└────────────┬───────────┘
             │ picking + packing list
             ▼
┌────────────────────────┐
│ Pelabuhan / terminal   │
│ booking, gate-in,      │
│ kontainer, cut-off     │
└────────────┬───────────┘
             │ dokumen + status keberangkatan
             ▼
┌────────────────────────┐
│ Kapal / carrier →      │
│ importir / tujuan      │
└────────────────────────┘
```

#### Entitas dan kontrol yang dibutuhkan

- **Perkebunan dan pemasok:** identitas pemasok/kebun, lokasi dan asal komoditas, tanggal panen, lot panen, kuantitas, praktik/sertifikat jika relevan, serta bukti asal. Klaim keberlanjutan atau sertifikasi hanya boleh ditampilkan jika diverifikasi.
- **Packing house:** penerimaan dan penimbangan, sortasi/grading, pemeriksaan mutu, proses pengolahan, penggunaan bahan kemasan, label, hasil/kehilangan produksi, serta hubungan antara lot input dan batch output.
- **Gudang:** penerimaan/pengeluaran, stok per lot/batch, lokasi rak, status karantina/hold, kondisi penyimpanan, kedaluwarsa bila relevan, FEFO/FIFO sesuai jenis komoditas, cycle count, dan bukti serah terima.
- **Pelabuhan/terminal:** jadwal cut-off, booking carrier/forwarder, nomor kontainer dan seal, gate-in, VGM bila diwajibkan, status pemeriksaan, keberangkatan, serta referensi bill of lading dan dokumen terkait.
- **Ketertelusuran end-to-end:** setiap perpindahan mencatat identitas lot, kuantitas dan satuan, lokasi asal/tujuan, waktu, aktor, status, bukti, dan referensi dokumen. Pecah/gabung lot harus mempertahankan relasi parent-child dan rekonsiliasi kuantitas.
- **Kualitas dan kepatuhan:** inspeksi, sampel uji, sertifikat atau izin komoditas bila diwajibkan, kondisi transportasi/suhu untuk barang yang sensitif, dan hold/release yang hanya dapat dilakukan oleh peran berwenang.
- **Integrasi mitra:** koneksi ke ERP/WMS, timbangan, laboratorium, forwarder, terminal, carrier, dan sistem kepabeanan harus melalui adapter terkontrol, autentikasi, idempotency, pencatatan sumber, dan rekonsiliasi; jangan menganggap API mitra tersedia tanpa verifikasi.

**Gerbang penerimaan rantai pasok:** simulasi satu pengiriman dari lot panen sampai kontainer berangkat; rekonsiliasi kuantitas di setiap titik; uji lot hilang/duplikat, stok negatif, lot ditahan, perubahan lokasi, dokumen kedaluwarsa, serta akses lintas tenant. Data lokasi kebun, pemasok, pelanggan, dan dokumen komersial wajib mengikuti kontrol akses dan kebijakan retensi.

### Komponen dan tanggung jawab

| Komponen | Tanggung jawab | Batasan |
|---|---|---|
| Expo / React Native | Antarmuka mobile dan permintaan ke API | Nilai `EXPO_PUBLIC_*` dapat diekstrak dari bundle; jangan simpan secret di aplikasi |
| Express API | Menyediakan endpoint health, katalog, inquiry, tracking, dan sinkronisasi internal | Harus dibatasi jaringan dan dilindungi sesuai lingkungan |
| SQLite | Persistensi data backend lokal | File database harus dikelola sebagai data sensitif jika kelak berisi data nyata |
| Sync outbox | Menyimpan pekerjaan replikasi agar dapat dicoba kembali | Keberhasilan enqueue tidak selalu berarti seluruh peer sudah menerima data |
| Conflict log | Mencatat benturan identitas dengan isi yang berbeda | Konflik perlu dipantau dan ditangani secara operasional |
| Peer backend | Mengirim/menerima inquiry dari node lain yang dikonfigurasi | Semua node yang berkomunikasi harus menggunakan konfigurasi dan secret yang cocok |

## Alur data

### Membuat dan melacak inquiry

1. Aplikasi mobile mengirim permintaan ke API berdasarkan `EXPO_PUBLIC_API_URL`.
2. API memvalidasi dan memproses permintaan inquiry.
3. Inquiry disimpan pada backend lokal; model yang didokumentasikan bersifat append-only.
4. Klien dapat menggunakan tracking code untuk meminta status/rekaman inquiry melalui endpoint tracking.
5. Jika peer sync diaktifkan, backend memasukkan pekerjaan replikasi ke outbox dan mencoba meneruskannya ke peer yang dikonfigurasi.
6. Backend penerima melakukan deduplikasi: payload identik dapat diterima ulang secara idempotent; identitas yang sama dengan payload berbeda dicatat sebagai konflik dan tidak menimpa data yang ada.

### Katalog

Endpoint katalog menyediakan data produk demo untuk pengembangan. Integrasi katalog bisnis nyata, tata kelola sumber data, pembaruan katalog, dan proses persetujuan konten perlu ditetapkan terpisah sebelum penggunaan bisnis nyata.

## API

Endpoint yang tersedia pada dokumentasi MVP:

| Method | Endpoint | Tujuan |
|---|---|---|
| `GET` | `/health` | Pemeriksaan kesehatan API |
| `GET` | `/api/v1/products` | Membaca katalog demo |
| `POST` | `/api/v1/inquiries` | Membuat inquiry |
| `GET` | `/api/v1/inquiries/:trackingCode` | Melacak inquiry berdasarkan tracking code |
| `POST` | `/api/v1/sync/inquiries` | Endpoint internal untuk menerima replikasi; memerlukan autentikasi bearer saat fitur sync dikonfigurasi |

Endpoint internal sync bukan endpoint publik untuk dipanggil langsung dari aplikasi mobile. Kontrak request/response, kode error, skema validasi, dan kebijakan versi API sebaiknya didokumentasikan dan diuji sebagai kontrak terpisah.

## Peer sync dan konsistensi data

Sync nonaktif apabila `SYNC_SHARED_SECRET` kosong. Untuk mengaktifkannya pada lingkungan lokal yang terkontrol, konfigurasi setiap backend dengan ID node unik, secret bersama, dan daftar peer.

Contoh konfigurasi backend:

```dotenv
SYNC_NODE_ID=mobile-local
SYNC_SHARED_SECRET=<secret-random-minimal-32-karakter-yang-sama-pada-peer>
SYNC_PEERS=web-local=https://web.example:4000,desktop-local=https://desktop.example:4002
```

Ketentuan konfigurasi:

- `SYNC_NODE_ID` harus unik untuk setiap node.
- `SYNC_SHARED_SECRET` harus kuat, rahasia, dan sama hanya pada peer yang memang diizinkan berkomunikasi.
- `SYNC_PEERS` menggunakan format `nodeId=http(s)://host:port`.
- URL peer dengan username/password, query, atau fragment ditolak.
- Buat secret menggunakan `openssl rand -hex 32`; simpan hanya di konfigurasi server/secret manager, bukan di aplikasi mobile.
- Gunakan HTTPS untuk koneksi antarnode di luar lingkungan lokal. Jangan mengirim bearer secret melalui HTTP yang tidak terenkripsi.
- Node tidak mengirim ulang inquiry ke dirinya sendiri atau ke origin.
- Penerimaan ulang payload identik bersifat idempotent. ID/tracking code sama dengan payload berbeda menghasilkan konflik HTTP 409 tanpa overwrite.
- Outbox persisten dengan retry/backoff membantu pemulihan setelah kegagalan sementara, tetapi perlu monitoring, retensi, dan prosedur rekonsiliasi untuk operasi produksi.

Contoh ini hanya untuk konfigurasi; domain `example` harus diganti dengan alamat peer yang benar-benar dikelola dan diamankan.

## Konfigurasi dan keamanan

### Menjalankan API lokal

API secara default mengikat ke `127.0.0.1:4001` dan menyimpan database di `server/data/api.sqlite`. File `.env.api` hanya untuk backend dan tidak boleh dimasukkan ke bundle Expo.

### Konfigurasi aplikasi mobile

`EXPO_PUBLIC_API_URL` menentukan alamat API yang digunakan aplikasi. Nilai dengan prefix `EXPO_PUBLIC_` akan tertanam dalam bundle aplikasi dan **bukan tempat untuk token, password, atau secret**.

Alamat umum untuk pengembangan:

| Lingkungan | URL API contoh |
|---|---|
| Android Emulator | `http://10.0.2.2:4001` |
| iOS Simulator | `http://127.0.0.1:4001` |
| Perangkat fisik di LAN | `http://<IP-LAN-komputer>:4001` |

Untuk menguji dari perangkat fisik, backend dapat diatur mendengarkan pada `0.0.0.0` melalui `API_HOST`, kemudian `EXPO_PUBLIC_API_URL` diarahkan ke IP LAN komputer. Lakukan ini hanya pada jaringan tepercaya, batasi akses firewall, dan jangan mengekspos API langsung ke internet. Untuk lingkungan non-local, gunakan reverse proxy dengan TLS.

### Runtime single-enterprise dan role-based access control

Backend API yang melayani operasi supply chain kini memerlukan konfigurasi `SINGLE_ENTERPRISE_ID`. ID tersebut harus menunjuk ke satu record enterprise aktif di tabel `tenants`; semua permintaan protected supply-chain memakai konteks tersebut dari konfigurasi server. Header `x-active-tenant-id` yang menunjuk enterprise lain ditolak. Jika konfigurasi belum ada, endpoint protected gagal tertutup dengan `503 single_enterprise_not_configured`.

Migrasi skema dan tabel role:

```bash
node scripts/migrate-tenant-isolation.mjs server/data/api.sqlite
```

Setelah enterprise dan membership pengguna dibuat melalui proses provisioning operator yang disetujui, berikan peran eksplisit melalui CLI berikut:

```bash
SINGLE_ENTERPRISE_ID=enterprise-main node scripts/assign-enterprise-role.mjs server/data/api.sqlite enterprise-main <supabase-user-id> enterprise_admin
SINGLE_ENTERPRISE_ID=enterprise-main node scripts/assign-enterprise-role.mjs server/data/api.sqlite enterprise-main <supabase-user-id> buyer
SINGLE_ENTERPRISE_ID=enterprise-main node scripts/assign-enterprise-role.mjs server/data/api.sqlite enterprise-main <supabase-user-id> seller
SINGLE_ENTERPRISE_ID=enterprise-main node scripts/assign-enterprise-role.mjs server/data/api.sqlite enterprise-main <supabase-user-id> supplier
SINGLE_ENTERPRISE_ID=enterprise-main node scripts/assign-enterprise-role.mjs server/data/api.sqlite enterprise-main <supabase-user-id> warehouse
SINGLE_ENTERPRISE_ID=enterprise-main node scripts/assign-enterprise-role.mjs server/data/api.sqlite enterprise-main <supabase-user-id> qc
SINGLE_ENTERPRISE_ID=enterprise-main node scripts/assign-enterprise-role.mjs server/data/api.sqlite enterprise-main <supabase-user-id> logistics
SINGLE_ENTERPRISE_ID=enterprise-main node scripts/assign-enterprise-role.mjs server/data/api.sqlite enterprise-main <supabase-user-id> auditor
```

Ganti `enterprise-main` dan `<supabase-user-id>` dengan nilai yang benar. Perintah ini hanya memberikan peran kepada pengguna yang sudah mempunyai membership aktif di enterprise tersebut; perintah tidak membuat enterprise atau membership. Jalankan sebagai operator yang berwenang, pada database yang benar, setelah backup yang sesuai. Jangan mengirim service-role key atau kredensial ke aplikasi mobile. Kolom `granted_by` mencatat `operator-cli`, bukan identitas operator OS yang terverifikasi.

| Peran | Cakupan utama API |
|---|---|
| `enterprise_admin` | Mengelola lokasi dan operasi yang diizinkan admin |
| `buyer` | Membaca stok dan traceability sesuai kebijakan |
| `seller` | Membaca traceability dan mendukung alur pemasokan yang diizinkan |
| `supplier` | Mendaftarkan lot hanya pada lokasi bertipe `supplier`; tidak mendapat akses daftar stok enterprise atau lokasi gudang internal |
| `warehouse` | Penerimaan lot, pemrosesan, mutasi dan stok |
| `qc` | Inspeksi dan pembacaan stok |
| `logistics` | Mutasi, serah terima, dispatch dan pembacaan operasional |
| `auditor` | Pembacaan stok/traceability dan pencatatan bukti sesuai izin |

Aplikasi mobile meminta `GET /api/v1/enterprise/session` setelah login dan menampilkan nama enterprise, daftar peran, serta ringkasan kapabilitas yang dikembalikan/dipetakan dari kebijakan backend. Daftar UI bukan mekanisme otorisasi; setiap endpoint tetap memvalidasi peran di server. Supplier hanya dapat mendaftarkan lot ke lokasi bertipe `supplier`; pencatatan penerimaan di gudang internal dilakukan oleh peran gudang/admin.

Endpoint tulis transaksi komersial lama yang mengharuskan buyer dan seller menjadi dua tenant berbeda dinonaktifkan dengan HTTP 410. Sinkronisasi bundle tenant multi-enterprise juga dinonaktifkan. **Workflow order Buyer/Seller dalam satu enterprise belum diimplementasikan**; jangan mengaktifkan pembayaran atau menganggap UI peran sebagai bukti alur order sudah tersedia.

### Prinsip keamanan yang perlu dipertahankan

- Jangan memasukkan data klien nyata, kredensial, token, atau secret ke repository, log, screenshot, atau bundle mobile.
- Gunakan secret yang berbeda antarlingkungan dan rotasi secret jika terekspos.
- Batasi akses jaringan ke API dan endpoint internal sync.
- Verifikasi autentikasi, otorisasi, validasi input, rate limiting, dan penanganan error sebelum menghubungkan data atau pengguna nyata.
- Uji isolasi tenant dan otorisasi pada sisi server; jangan mengandalkan identitas tenant yang dikirim klien saja.
- Tetapkan backup, pemulihan, retensi, audit log, observability, dan prosedur incident response sebelum produksi.
- Jangan menganggap adanya test file sebagai bukti bahwa semua kontrol telah lulus; gunakan hasil CI terbaru yang terkait dengan commit yang akan dirilis.

## Menjalankan aplikasi

Gunakan Node.js 22 atau lebih baru.

### 1. Instal dependensi

```bash
npm ci
```

### 2. Jalankan API lokal

```bash
cp .env.api.example .env.api
npm run dev:api
```

### 3. Jalankan Expo

Salin konfigurasi publik jika ingin mengganti default:

```bash
cp .env.example .env
npm start
```

Gunakan perintah Expo yang sesuai untuk membuka aplikasi pada emulator atau perangkat pengembangan. Pastikan perangkat dapat menjangkau alamat API yang dikonfigurasi.

## Pengujian dan quality gates

Jalankan pemeriksaan lokal:

```bash
npm test
npm run typecheck
npx expo export --platform android
```

- `npm test` menjalankan suite test yang didefinisikan dalam `package.json`, termasuk test API/server dan test terkait validasi, auth, serta migrasi tenant.
- `npm run typecheck` menjalankan TypeScript tanpa menghasilkan output build.
- `npx expo export --platform android` memeriksa proses export bundle Android; perintah ini bukan build rilis yang ditandatangani dan bukan deployment.
- CI Mobile juga menjalankan tes interoperabilitas terhadap backend Web dan Desktop. Lihat [runbook pengujian interoperabilitas](https://github.com/muchlisbstg/export-client-web-sync/blob/main/docs/interop-testing.md) untuk harness tiga repository dan skenario data sintetis.

Sebelum menyatakan suatu perubahan lulus, simpan bukti commit SHA, workflow run, status setiap job, dan log untuk job yang gagal. Jalankan tes terhadap versi dependency/lockfile yang sama dengan commit kandidat.

## Kepatuhan ekspor global dan Syariah

Repository ini merupakan klien mobile untuk platform ekspor global. Platform target harus membantu perusahaan mengelola kewajiban Indonesia sebagai negara asal serta kewajiban negara tujuan dan transit untuk setiap transaksi. **Kepatuhan harus dinilai per transaksi dan yurisdiksi**, berdasarkan produk/HS code, eksportir, importir, end-user, rute, tanggal, kontrak, serta dokumen yang berlaku.

Prinsip arsitektur:

- **Backend adalah otoritas keputusan.** Mobile dan peer sync tidak boleh menetapkan status legal, menghapus hold, atau menyetujui transaksi sendiri.
- **Rules per yurisdiksi berversi.** Setiap persyaratan memiliki sumber resmi, tanggal berlaku, ruang lingkup, bukti yang diperlukan, status review legal, dan riwayat perubahan.
- **Indonesia sebagai baseline asal.** Rule pack perlu mencakup perizinan usaha yang relevan, prosedur kepabeanan/PEB, larangan dan pembatasan ekspor, dokumen asal barang, persyaratan komoditas, perpajakan, dan privasi/data sesuai transaksi.
- **Negara tujuan dan transit sebagai paket terpisah.** Periksa perizinan impor, standar produk/label, pajak/bea, sanksi dan kontrol perdagangan bila berlaku, dokumen asal, serta kewajiban data dan pencatatan yang relevan.
- **Syariah sebagai tata kelola inti.** Akad, kepemilikan/otoritas menjual, spesifikasi barang, harga, pembayaran, pengiriman, risiko, biaya, keterlambatan, dan pembiayaan harus ditinjau sesuai transaksi oleh penasihat Syariah yang kompeten. Sistem tidak mengeluarkan fatwa otomatis.
- **Human approval wajib untuk keputusan yang memerlukan keahlian.** Potensi kecocokan sanksi, aturan yang tidak jelas, pengecualian, dokumen meragukan, dan review akad harus masuk antrean review yang dapat diaudit.
- **Status lulus bukan jaminan hukum universal.** Clearance harus dibatasi pada transaksi, fakta, versi rules, dan periode tertentu; perubahan material memicu evaluasi ulang.

Dokumen desain dan backlog rinci: [Global Export Compliance & Shariah Architecture](docs/global-export-compliance-shariah-architecture.md). Dokumen tersebut menetapkan target arsitektur, model data, state transaksi, kontrol keamanan, acceptance criteria, dan tahapan rollout. Ini adalah persyaratan desain—bukan bukti bahwa kontrol telah diimplementasikan, perusahaan telah patuh, atau sertifikasi Syariah telah diperoleh.

## Pembayaran ekspor, sampel, dan ketentuan komersial

Platform target harus mendukung opsi pembayaran internasional dan alur sampel, tetapi **opsi yang tampil harus bergantung pada negara, produk, profil pihak, kontrak, bank/provider, dan hasil review legal serta Syariah**. Tidak ada metode pembayaran yang otomatis patuh Syariah hanya karena nama atau penyedianya.

Rancangan rinci dan acceptance criteria ada di [Export Payment, Samples & Commercial Terms](docs/export-payment-samples-shariah.md).

### Opsi pembayaran yang perlu didukung sebagai pilihan konfigurasi

| Opsi | Penggunaan umum | Gap/kontrol yang wajib dilengkapi |
|---|---|---|
| Pembayaran di muka / transfer bank | Sampel atau order baru | Verifikasi penerimaan dana dari sumber tepercaya, FX, biaya bank, refund, dan screening pihak |
| Deposit + pelunasan bertahap | Produksi sesuai pesanan | Milestone, jatuh tempo, pembatalan, refund, alokasi risiko dan review akad |
| Open account / pembayaran tempo | Buyer terverifikasi | Batas kredit, persetujuan kredit, aging piutang, penagihan dan risiko gagal bayar |
| Documentary Collection D/P | Dokumen diserahkan setelah pembayaran | Instruksi collection, bank terkait, biaya, tenggat dan risiko buyer tidak membayar |
| Documentary Collection D/A | Dokumen setelah acceptance janji bayar | Jatuh tempo, kelayakan kredit, risiko exporter, serta review bank/legal |
| Letter of Credit (LC) | Order dengan proses dokumen bank | Bank penerbit/advising/confirming, expiry, dokumen, tanggal shipment, biaya dan discrepancy handling |
| Bank guarantee / standby LC | Jaminan pembayaran atau kinerja | Trigger klaim, expiry, issuer, biaya dan review hukum/Syariah |
| Escrow / payment provider | Jika legal dan provider berizin | Lisensi, negara/currency yang didukung, custody, settlement, refund dan dispute |
| Islamic trade finance | Produk bank yang sesuai transaksi | Akad aktual, bukti aset/kepemilikan bila relevan, fee/profit, dokumen bank dan persetujuan Syariah |

LC, documentary collection, guarantee, escrow, dan trade finance bukan fitur yang dapat dianggap sudah tersedia hanya karena tercantum dalam README. ICC UCP 600 atau URC 522 berlaku jika dokumen transaksi terkait secara eksplisit memasukkannya sesuai ketentuan yang berlaku; lihat [referensi resmi ICC UCP 600](https://library.iccwbo.org/content/tfb/RULES/tfb-ucp600-rules.htm) dan [panduan pembiayaan perdagangan ICC](https://academy.iccwbo.org/trade-finance/article/what-is-export-financing/).

### Sampel, prototype, dan pengiriman non-bulk

Bedakan secara eksplisit:

- **Sampel berbayar:** harga produk, ongkir, asuransi, bea/pajak, waktu kirim, refund, serta apakah biaya sampel dapat dikreditkan ke pesanan berikutnya.
- **Sampel gratis:** pihak yang membayar ongkir dan biaya impor, tujuan sampel, nilai pabean yang akurat, serta syarat penggantian/pengembalian.
- **Prototype / unit evaluasi:** apakah penjualan, pinjaman, konsinyasi, atau ekspor/impor sementara; tetapkan kepemilikan, penggunaan yang diizinkan, IP, tenggat pengembalian/pemusnahan, dan prosedur kepabeanan.
- **Replacement, warranty, return:** bedakan penggantian tanpa pembayaran, refund, credit note, perbaikan, re-export, dan return-to-origin.

**Gratis tidak otomatis berarti nilai pabean nol atau bebas bea/izin.** Jangan membuat deklarasi “no commercial value” jika tidak akurat atau tidak diizinkan. Kewajiban dokumen ditentukan oleh komoditas, negara, rute, tujuan penggunaan, serta prosedur kepabeanan yang relevan.

### Gerbang Syariah dan pembayaran

Sebelum metode pembayaran diaktifkan untuk transaksi, sistem perlu merekam akad dan versi yang disetujui, pihak dan perannya, dasar harga/currency, jadwal pembayaran, biaya/komisi, tanggung jawab risiko, refund, wanprestasi, serta review Syariah yang relevan. Jangan otomatis menyatakan LC, D/A, biaya jaminan, FX, denda keterlambatan, escrow, atau pembiayaan tertentu patuh Syariah. Penasihat Syariah yang kompeten perlu meninjau struktur dan dokumen sebenarnya.

Pembayaran hanya boleh berstatus **settled** setelah diverifikasi dari bank/provider atau melalui proses manual terotorisasi yang terdokumentasi. Input mobile, screenshot, atau webhook tanpa verifikasi bukan bukti pembayaran. Gunakan idempotency, verifikasi signature webhook, rekonsiliasi, audit trail, dan pencatatan refund/reversal/partial payment. Jangan menyimpan password bank, data kartu mentah, atau secret di aplikasi mobile.

## Audit kekurangan README

Audit ini memeriksa cakupan dokumentasi README yang ada pada branch ini. Label **belum dibuktikan** berarti README belum menjelaskan implementasi atau belum ada bukti CI/hasil uji yang mendukungnya—bukan klaim bahwa kode pasti tidak memilikinya.

| Poin README saat ini | Kekurangan yang ditemukan | Yang perlu ditambahkan / dibuktikan | Prioritas |
|---|---|---|---|
| Ringkasan dan katalog demo | Katalog belum mendefinisikan SKU ekspor, HS code, asal, spesifikasi, MOQ, kapasitas, lead time, incoterms, dan status pembatasan | Model produk ekspor dan persetujuan data katalog | P1 |
| Alur inquiry dan tracking | Belum ada quotation, order, kontrak, approval, amendment, cancellation, dispute, atau acceptance buyer | State machine transaksi dari inquiry sampai penutupan | P1 |
| API | Endpoint baru health, products, inquiries, tracking, dan peer sync; belum ada kontrak payment, sample, quotation, orders, documents, compliance, atau reviews | OpenAPI/schema, autentikasi/otorisasi, idempotency, versi API dan error contract | P1 |
| Peer sync | Inquiry replication belum memodelkan authority/source of truth, event schema, outbox reconciliation dan pemisahan data sensitif per tenant | Sinkronisasi event transaksi dengan tenant boundary, provenance dan audit | P1 |
| Pembayaran ekspor | Belum ada metode pembayaran, jadwal, currency, fee, bank/provider, status settlement, refund/reversal, dispute, atau rekonsiliasi | Payment requirements, provider sandbox, webhook security, idempotency, reconciliation | P1 |
| Syariah untuk pembayaran | Penyebutan Syariah belum mengatur approval akad per transaksi, financing, guarantee, FX, late payment, agency fee, refund dan bukti reviewer | Akad registry, review workflow, kondisi/expiry dan audit keputusan | P1 |
| Sampel dan prototype | Belum dibedakan sampel gratis/berbayar, temporary shipment, return, replacement, nilai pabean, biaya, dokumen, tenggat kembali | Sample lifecycle, accurate customs value, document checklist dan return/disposition tracking | P1 |
| Dokumen ekspor | Belum ada document vault, issuer, expiry, authenticity/verification, versioning, retention, access log atau checklist per corridor | Dokumen persyaratan per negara/komoditas/metode pembayaran | P1 |
| Regulasi negara | README hanya menetapkan prinsip umum; belum ada corridor/commodity matrix yang berisi sumber resmi dan tanggal efektif | Pilot Indonesia → satu tujuan, HS classification, rule pack yang ditinjau legal | P1 |
| Keamanan dan tenant | README meminta kontrol, tetapi belum menampilkan hasil test negatif atau bukti isolasi lintas tenant | Bukti autentikasi, object authorization, tenant isolation, rate limit, secret management | P0/P1 |
| Audit dan persetujuan | Belum ada role matrix atau rekaman persetujuan legal/customs/Syariah di README | Separation of duties, immutable/tamper-evident audit events dan approval evidence | P1 |
| Operasional/reliability | Belum ada SLO, RPO/RTO, dead-letter, alert, backup restore proof atau incident runbook | Runbook, metrics, recovery tests dan evidence per SHA | P1 |
| CI/release | README menyebut perintah tes, tetapi bukan bukti run terkini; belum ada bukti build rilis signed atau approval gate | Workflow URL, job outcomes, commit SHA, build artifact/release checklist | P1 |
| Privasi lintas negara | Belum ada data-flow map, minimisasi dokumen pribadi, retensi per yurisdiksi dan dasar transfer lintas batas | Data classification, retention, legal hold, access/export/correction workflow | P1 |
| Monitoring perubahan hukum | Belum ada pemilik rule, jadwal review, sumber perubahan, dual approval atau invalidasi clearance | Rule governance, effective dates, versioning, stale-rule fail-safe | P1 |

Daftar di atas adalah audit kekurangan **cakupan README dan bukti yang ditampilkan**, bukan audit lengkap source code. Pembuktian implementasi membutuhkan pemeriksaan file backend, skema database, route, test, workflow CI dan hasil run pada commit yang tepat.


Dokumentasi dan implementasi saat ini tidak boleh diperlakukan sebagai bukti kesiapan produksi. Sebelum peluncuran, tutup setidaknya gap berikut:

1. **Kontrak API:** dokumentasikan skema payload, validasi, error, versi, pagination, dan batas ukuran request.
2. **Identitas dan akses:** pastikan autentikasi, sesi, peran, otorisasi objek, dan isolasi tenant konsisten di seluruh endpoint.
3. **Sync operasional:** definisikan retry maksimum, dead-letter/recovery, monitoring outbox, rekonsiliasi, rotasi secret, dan pengujian kegagalan jaringan.
4. **Data governance:** tetapkan klasifikasi data, retensi, penghapusan yang sah, backup/restore, dan audit trail; selaraskan dengan model append-only.
5. **Keamanan API:** verifikasi TLS, rate limiting, validasi input, proteksi penyalahgunaan, sanitasi log, dan manajemen secret.
6. **Reliability:** uji restart proses, pemulihan database, konkurensi, duplikasi, konflik, dan interoperabilitas lintas node.
7. **Mobile release:** verifikasi kompatibilitas Expo/React Native, izin perangkat, konfigurasi per lingkungan, serta build rilis pada CI.
8. **Go-live gate:** review keamanan dan privasi, pengujian pada data sintetis, dokumentasi operasi, dan persetujuan manusia sebelum data nyata atau deployment diaktifkan.

Perubahan README ini mendokumentasikan arsitektur dan batasan yang diketahui; perubahan dokumentasi saja tidak mengimplementasikan kontrol keamanan atau menyatakan sistem siap produksi.


## Kebutuhan Pengguna Aplikasi Mobile Supply Chain

Bagian ini merangkum kebutuhan pengguna operasional dari penerimaan hasil perkebunan sampai serah terima pengiriman di pelabuhan. Ini adalah **daftar kebutuhan produk dan acceptance criteria**, bukan klaim bahwa semua fitur UI, integrasi eksternal, atau kontrol produksi sudah tersedia.

### 1. Peran pengguna dan kebutuhan pekerjaan

| Peran | Kebutuhan utama |
|---|---|
| Petugas perkebunan / pemasok | Mendaftarkan lot panen; mencatat komoditas, pemasok, kuantitas, satuan, asal, waktu, dan kondisi; membuat/memindai identitas lot atau QR; memeriksa status penerimaan serta alasan penolakan. |
| Operator packing house | Melihat lot masuk; mencatat penimbangan, sortasi, pengemasan, dan hasil proses; mencatat input, output, lot turunan, serta susut dan alasannya; mempertahankan hubungan lot asal dan lot hasil. |
| Petugas gudang | Melihat stok per lot, lokasi, dan status; mencatat penerimaan serta perpindahan antarlokasi; memindai QR/barcode; membedakan stok tersedia, ditahan, dan dialokasikan. |
| Petugas Quality Control (QC) | Mengisi parameter dan hasil inspeksi; mencatat foto/bukti; menetapkan status lulus, ditahan, atau ditolak sesuai kewenangan; mencatat alasan, tindakan koreksi, dan pelepasan yang terotorisasi. |
| Petugas logistik / pelabuhan | Menyiapkan serah terima; memeriksa jumlah, kondisi, segel, dan dokumen; mencatat jumlah yang benar-benar diterima; melaporkan selisih beserta alasan dan bukti. |
| Manajer operasional / admin | Memantau lot, stok, inspeksi, dan pengiriman; mengelola lokasi, pengguna, serta hak akses sesuai kewenangan; meninjau selisih dan pengecualian; melihat laporan serta jejak audit. |

Peran di atas adalah model kebutuhan bisnis. Implementasi role yang lebih rinci (misalnya supplier, operator, QC, warehouse, logistics, auditor) harus didukung role matrix dan pemeriksaan otorisasi di server, bukan hanya menyembunyikan tombol pada UI.

### 2. Fitur produk yang dibutuhkan

| Fitur | Kebutuhan pengguna / perilaku yang diharapkan |
|---|---|
| Login dan keamanan akun | Login dan logout aman, pengelolaan sesi, pembatasan akses berdasarkan peran, dan penanganan sesi kedaluwarsa. |
| Dashboard | Ringkasan lot, stok, inspeksi, pengiriman, pengecualian, dan pekerjaan yang masih menunggu tindakan. |
| Registrasi lot | Input identitas lot, komoditas, pemasok, asal, jumlah, satuan, lokasi, waktu, dan bukti yang relevan. |
| QR/barcode | Memindai atau mencari lot dan membuka identitas, status, lokasi, serta riwayatnya. |
| Penerimaan barang | Mencatat kuantitas yang diharapkan dan yang diterima, kondisi aktual, waktu, petugas, bukti, dan selisih. |
| Pemrosesan packing house | Mencatat lot input, output/lot turunan, kuantitas, satuan, susut, alasan susut, operator, waktu, dan hubungan genealogy. |
| Manajemen gudang | Melihat saldo per lokasi dan lot; melakukan mutasi masuk/keluar; melihat riwayat pergerakan; mencegah stok negatif. |
| Quality control | Mencatat inspeksi, parameter mutu, hasil, bukti, alasan hold/reject, tindakan koreksi, serta pelepasan yang sah. |
| Pengiriman dan serah terima | Menyiapkan pengiriman, mencatat dispatch, penerimaan aktual, bukti, kondisi, dan selisih. |
| Traceability | Menelusuri lot ke pemasok/asal, proses, lot turunan, lokasi, inspeksi, dan pengiriman terkait. |
| Notifikasi | Memberi tahu pengguna tentang lot ditahan, stok rendah, selisih, sinkronisasi gagal, atau pekerjaan yang menunggu. |
| Laporan | Rekap stok, penerimaan, pemrosesan dan susut, hasil QC, mutasi, selisih, dan pengiriman. |
| Audit log | Merekam siapa melakukan tindakan apa, kapan, pada tenant dan objek mana, serta referensi transaksi dan bukti yang terkait. |
| Bukti transaksi | Menautkan foto/dokumen, metadata, referensi penyimpanan, dan hak akses dengan transaksi terkait. Penyimpanan referensi saja tidak berarti upload, scanning malware, atau signed URL telah tersedia. |
| Konteks enterprise | Menampilkan enterprise pemilik sistem dan peran aktif; enterprise ditetapkan server-side dan tidak dapat diganti bebas oleh pengguna. |

### 3. Halaman utama yang disarankan

1. **Beranda / Dashboard:** ringkasan operasional, tugas tertunda, notifikasi, dan pengecualian.
2. **Scan Lot:** pemindaian QR/barcode dan akses cepat ke detail lot.
3. **Operasional:** pintasan untuk penerimaan, pemrosesan, inspeksi QC, mutasi gudang, dan serah terima.
4. **Lot & Persediaan:** pencarian/filter lot, saldo stok, lokasi, status hold, dan riwayat pergerakan.
5. **Detail Lot / Traceability:** informasi asal, penerimaan, proses, lot turunan, inspeksi, perpindahan, dan pengiriman.
6. **Pengiriman / Serah Terima:** daftar pengiriman, status persiapan/dispatch/penerimaan, bukti, dan selisih.
7. **Riwayat & Laporan:** timeline transaksi, bukti, audit, dan ringkasan operasional sesuai izin.
8. **Profil & Pengaturan:** sesi, identitas, tenant aktif, peran, dan preferensi aplikasi.

Navigasi akhir perlu disesuaikan dengan hasil riset pengguna dan hak akses tiap peran; halaman yang ditampilkan bukan pengganti otorisasi server.

### 4. Persyaratan penggunaan lapangan dan integritas transaksi

- **Jaringan tidak stabil / offline:** jika operasi offline didukung, transaksi harus disimpan dalam antrean lokal yang persisten, memiliki ID/idempotency key, memperlihatkan status pending/synced/failed, dan dapat dicoba ulang tanpa membuat transaksi ganda. Konflik harus ditampilkan dan diselesaikan melalui alur yang diaudit. Jangan menampilkan transaksi sebagai berhasil tersinkron sebelum server mengonfirmasi.
- **Permintaan berulang:** retry setelah timeout atau tap berulang tidak boleh menggandakan penerimaan, mutasi, pemrosesan, inspeksi, atau serah terima. Idempotency key harus dibatasi pada tenant dan jenis operasi; penggunaan ulang key dengan payload berbeda harus ditolak sebagai konflik.
- **Transaksi bersamaan:** dua petugas yang memproses stok bersamaan tidak boleh menyebabkan saldo negatif, kehilangan update, atau posting ganda. Validasi dan perubahan saldo harus atomik pada server/database.
- **Lot ditahan:** lot berstatus hold/rejected tidak boleh dipakai untuk pemrosesan, dialokasikan, atau dikirim melalui jalur normal sampai dilepas oleh pihak berwenang dengan alasan dan rekaman audit.
- **Selisih penerimaan:** kuantitas yang dikirim dan diterima dicatat terpisah. Selisih memerlukan alasan, bukti, status tindak lanjut, dan jejak siapa yang memutuskan; sistem tidak boleh diam-diam menyesuaikan kuantitas asal.
- **Kuantitas dan susut:** gunakan satuan yang eksplisit dan konversi yang tervalidasi. Untuk proses yang mengharuskan rekonsiliasi, input harus sama dengan output ditambah susut/kehilangan yang dinyatakan dan dicatat.
- **Batas enterprise dan otorisasi objek:** enterprise ditetapkan server-side; penggantian ID lot, lokasi, inspeksi, handover, RFQ, order, atau dokumen dalam request tidak boleh melewati pemeriksaan peran, lokasi, dan hubungan transaksi. Jika kode masih menggunakan tenant scope internal, pengujian isolasi tersebut tetap wajib.
- **Bukti dan audit:** metadata bukti harus terkait ke tenant dan transaksi; akses, perubahan status, koreksi, dan pelepasan hold harus tercatat. Jangan menyimpan secret di bundle mobile atau log.
- **Aksesibilitas operasional:** form perlu validasi yang jelas, satuan yang terlihat, konfirmasi sebelum tindakan berdampak besar, pesan error yang dapat ditindaklanjuti, serta dukungan penggunaan di layar kecil dan kondisi jaringan lapangan.
- **Keamanan data:** gunakan data sintetis selama pengembangan; terapkan minimisasi data, retensi, backup/restore, dan pembatasan akses sebelum data bisnis nyata digunakan.

### 5. Prioritas pengembangan

| Prioritas | Cakupan | Kriteria keluar |
|---|---|---|
| **P0 — Keamanan dan integritas** | Autentikasi, otorisasi tenant di server, migrasi aman/idempoten, transaksi atomik, idempotensi, pencegahan stok negatif, dan audit log. | Tes akses tanpa autentikasi dan lintas-tenant ditolak; retry tidak menggandakan transaksi; transaksi gagal tidak meninggalkan perubahan parsial; migrasi aman diuji pada salinan terisolasi. |
| **P1 — Operasional inti** | Penerimaan lot, saldo stok, mutasi, pemrosesan packing house, genealogy, inspeksi/hold/release, serta serah terima dan pencatatan selisih. | Alur berhasil dan alur gagal diuji; kuantitas dan status konsisten; lot ditahan diblokir; jejak lot dapat ditelusuri. |
| **P2 — Pengalaman lapangan** | QR/barcode, kamera/bukti, antrean offline, retry, indikator sinkronisasi, notifikasi, dan penyelesaian konflik. | Pengujian jaringan putus/sambung tidak menggandakan transaksi dan status pengguna akurat. |
| **P3 — Pelaporan dan integrasi** | Laporan operasional, ekspor data yang terotorisasi, serta integrasi ERP/WMS, carrier, atau sistem pelabuhan jika API dan akses resmi tersedia. | Kontrak integrasi, autentikasi, pemetaan data, observability, dan pengujian sandbox tersedia; tidak mengklaim integrasi yang belum diverifikasi. |

### 6. Checklist acceptance tests sebelum rilis

- [ ] Penerimaan lot berhasil dan permintaan ulang tidak membuat lot/penerimaan ganda.
- [ ] Migrasi dapat dijalankan berulang kali tanpa menggandakan skema atau merusak data lama.
- [ ] Dua atau lebih transaksi stok yang bersamaan tidak menyebabkan saldo negatif atau posting hilang.
- [ ] Mutasi stok yang gagal melakukan rollback seluruh perubahan terkait.
- [ ] Pemrosesan mencatat hubungan lot asal dan lot hasil secara atomik.
- [ ] Kuantitas input direkonsiliasi dengan output ditambah susut yang dicatat.
- [ ] Lot yang ditahan/ditolak tidak dapat digunakan atau dikirim melalui jalur normal sebelum dilepas secara sah.
- [ ] Selisih penerimaan/serah terima tercatat dengan alasan, bukti, dan tindak lanjut.
- [ ] Pengguna tanpa autentikasi, pengguna tanpa hak peran, dan supplier yang mencoba mengakses objek/transaksi pihak lain ditolak.
- [ ] Pengubahan ID objek di request tidak dapat melewati pemeriksaan tenant/otorisasi.
- [ ] Jika offline mode diaktifkan, retry dan sinkronisasi ulang tidak menggandakan transaksi; konflik terlihat oleh pengguna.
- [ ] Bukti hanya dapat diakses pihak yang berwenang dan metadata audit tersimpan.
- [ ] Tes migrasi dilakukan pada salinan database representatif yang terisolasi, bukan langsung pada database produksi.
- [ ] Typecheck, test suite, pemeriksaan kompatibilitas Expo, Android export/build yang sesuai, dan seluruh job GitHub Actions wajib lulus pada commit kandidat.
- [ ] Hasil CI diperiksa berdasarkan commit SHA dan run yang tepat; dokumentasi atau keberadaan file test saja bukan bukti kelulusan.
- [ ] Tidak ada penggunaan data produksi, merge ke `main`, atau deployment sebelum gerbang keamanan, migrasi, dan persetujuan manusia yang diwajibkan terpenuhi.

### 7. Batasan dan pekerjaan lanjutan yang perlu dinyatakan transparan

- Registrasi evidence yang menyimpan metadata/referensi tidak otomatis menyediakan upload file, pemindaian malware, signed URL, atau document vault.
- Peran operasional terperinci perlu dipastikan pada role matrix dan diuji di backend.
- Integrasi ERP/WMS, carrier, pelabuhan, kepabeanan, dan sistem eksternal lainnya belum boleh dianggap tersedia tanpa implementasi dan hasil uji nyata.
- Offline-first perlu diverifikasi pada UI mobile dan mekanisme sync; outbox backend saja tidak membuktikan aplikasi dapat beroperasi penuh tanpa jaringan.
- Notifikasi push, scanner QR/barcode, kamera, dan laporan UI perlu diuji pada perangkat nyata atau emulator yang didukung.
- README ini adalah spesifikasi kebutuhan produk dan checklist pengujian. Status implementasi harus dinilai dari kode, hasil test, workflow CI terbaru, dan bukti pada commit yang sama; belum berarti aplikasi siap produksi.


## Model Single-Enterprise

Aplikasi ini diperuntukkan bagi **satu enterprise pemilik sistem**. Produk bukan marketplace multi-enterprise dan tidak menyediakan pendaftaran, pembuatan, atau perpindahan bebas antar-enterprise. Satu enterprise dapat memiliki banyak pengguna, departemen, gudang, lokasi operasional, serta mitra pemasok/pembeli eksternal yang diberi akses terbatas bila diperlukan.

Prinsip implementasi:

- Enterprise ditetapkan melalui konfigurasi dan identitas yang dikelola server; aplikasi klien tidak boleh memilih atau menetapkan enterprise otoritatif melalui request.
- Pengguna internal memperoleh satu atau beberapa peran sesuai tugas, misalnya Enterprise Admin, Procurement/Buyer, Warehouse, QC, Logistics, Management/Auditor.
- **Buyer** dan **Seller** adalah fungsi/peran transaksi di dalam operasi enterprise, bukan dua enterprise pemilik yang terpisah. Supplier eksternal dapat diberi akses terbatas pada RFQ, quotation, order, pengiriman, dan dokumen yang secara eksplisit terkait dengannya.
- Akses data dibatasi menurut peran, lokasi, objek, dan hubungan transaksi. Pihak eksternal tidak boleh melihat transaksi atau dokumen milik pihak lain.
- Jika implementasi saat ini masih memakai `tenant_id` atau membership tenant untuk isolasi data, jangan menghapusnya secara massal. Pertahankan pemeriksaan server-side dan lakukan penyederhanaan skema hanya melalui migrasi terencana yang diuji pada salinan database.
- Tidak ada pergantian enterprise aktif di UI untuk pengguna biasa. Konteks enterprise bersifat tetap; UI boleh menunjukkan nama enterprise dan peran aktif.

Model ini menyederhanakan ruang lingkup produk, tetapi tidak mengurangi kebutuhan autentikasi, otorisasi backend, audit log, perlindungan dokumen, atau pengujian akses.

## Fitur Buyer dan Seller

Fitur Buyer/Seller adalah alur pengadaan dan pemasokan dalam **satu enterprise**. Buyer umumnya mewakili tim pembelian enterprise; Seller dapat berupa tim penjualan internal atau supplier eksternal yang diberi akses terbatas. Bagian ini mendefinisikan target produk; pencantuman di README **tidak berarti fitur marketplace, quotation, order, pembayaran, atau chat sudah diimplementasikan**.

### 1. Model peran dan akses

- Enterprise memiliki satu konteks organisasi pemilik sistem.
- Pengguna internal dapat memperoleh beberapa peran sesuai tugas; peran Buyer dan Seller tidak membuat enterprise baru.
- Supplier eksternal hanya dapat masuk melalui mekanisme undangan/onboarding yang disetujui dan hanya melihat data RFQ, quotation, order, shipment, dan dokumen yang terkait dengannya.
- Peran dan akses selalu ditetapkan serta diverifikasi di server; jangan percaya role atau enterprise ID hanya karena dikirim aplikasi.
- Pengguna hanya boleh melihat penawaran, pesanan, dokumen, harga privat, pesan, dan bukti yang memang diizinkan untuk peran dan transaksi tersebut.
- Perubahan peran dan pemberian akses harus diaudit. UI menampilkan enterprise dan peran aktif secara jelas agar pengguna tidak salah bertindak.

### 2. Fitur Buyer — Pembeli

| Fitur | Kebutuhan Buyer |
|---|---|
| Profil perusahaan | Mengelola profil pembeli, alamat penagihan/pengiriman, kontak bisnis, negara, serta status verifikasi yang relevan. |
| Katalog produk | Menelusuri dan mencari produk; melihat spesifikasi, grade, asal, kemasan, minimum order, ketersediaan indikatif, dan informasi seller yang boleh dipublikasikan. |
| Permintaan penawaran (RFQ) | Mengirim permintaan dengan produk/grade, jumlah, tujuan, target tanggal, kebutuhan dokumen, dan persyaratan pengiriman. |
| Perbandingan penawaran | Membandingkan harga, mata uang, kuantitas, masa berlaku, lead time, incoterms, biaya yang tercakup, serta syarat pembayaran secara transparan. |
| Negosiasi | Mengajukan pertanyaan atau revisi syarat dan menyimpan riwayat perubahan penawaran. |
| Pesanan pembelian | Membuat atau mengonfirmasi purchase order setelah penawaran dan syarat disepakati; melihat nomor serta status order. |
| Pelacakan pemenuhan | Memantau persiapan lot, packing, inspeksi, dokumen, dispatch, dan penerimaan sesuai izin. |
| Dokumen transaksi | Mengakses kontrak, invoice, packing list, sertifikat, atau dokumen lain hanya jika tersedia, relevan, dan dibagikan secara sah. |
| Penerimaan dan selisih | Mengonfirmasi kuantitas/kondisi yang diterima serta melaporkan kekurangan, kerusakan, atau ketidaksesuaian dengan bukti. |
| Komplain dan penyelesaian | Membuka kasus, melampirkan bukti, melihat status penyelesaian, dan menyimpan keputusan/komunikasi yang dapat diaudit. |
| Pembayaran | Melihat syarat dan instruksi pembayaran yang disetujui, status pembayaran yang telah diverifikasi, serta refund/reversal jika relevan; jangan menganggap screenshot sebagai bukti settlement. |
| Riwayat dan favorit | Melihat transaksi sebelumnya, menyimpan produk/seller favorit, dan mengulang permintaan dengan konfirmasi ulang atas syarat terkini. |

### 3. Fitur Seller — Penjual

| Fitur | Kebutuhan Seller |
|---|---|
| Profil perusahaan | Mengelola profil eksportir/pemasok, kontak, lokasi, negara asal, dan status verifikasi. Status verifikasi bukan sertifikasi atau jaminan kepatuhan. |
| Katalog dan penawaran produk | Membuat serta memperbarui SKU, komoditas, spesifikasi, grade, asal, kemasan, minimum order, lead time, foto, dan dokumen yang diizinkan. |
| Ketersediaan stok | Melihat stok dan lot yang dapat dialokasikan; ketersediaan harus berasal dari sumber data yang otoritatif dan tidak boleh melebihi stok yang benar-benar tersedia. |
| Manajemen RFQ | Menerima RFQ yang ditujukan kepadanya, meminta klarifikasi, menolak dengan alasan yang sesuai, atau menyiapkan quotation. |
| Quotation | Menetapkan harga, mata uang, kuantitas, masa berlaku, lead time, incoterms, biaya yang tercakup/tidak tercakup, dan syarat pembayaran; perubahan harus menghasilkan versi baru atau riwayat yang jelas. |
| Manajemen pesanan | Meninjau pesanan masuk, menerima atau menolak sesuai kewenangan, mencatat alasan, dan mengelola perubahan atau pembatalan yang disepakati. |
| Pemenuhan pesanan | Mengalokasikan lot, menyiapkan packing, mengatur inspeksi, mengumpulkan dokumen, dan memperbarui milestone pengiriman. |
| Dokumen dan traceability | Menghubungkan lot asal, hasil pemrosesan, inspeksi, dan dokumen relevan ke order; membatasi akses dokumen sensitif. |
| Pengiriman | Menjadwalkan pengiriman, mencatat dispatch dan bukti serah terima, serta merespons perbedaan jumlah atau kondisi. |
| Faktur dan pembayaran | Melihat invoice, jatuh tempo, pembayaran yang terverifikasi, biaya, refund/credit note, dan rekonsiliasi yang diizinkan. |
| Penanganan komplain | Menerima dan menanggapi klaim buyer, mengirim bukti, mengusulkan tindakan koreksi, dan mencatat hasil penyelesaian. |
| Analitik | Melihat RFQ, tingkat konversi, pesanan aktif, ketepatan pemenuhan, dan ringkasan transaksi sesuai hak akses. |

### 4. Alur transaksi Buyer ↔ Seller

Alur yang disarankan untuk implementasi bertahap:

1. Seller membuat profil dan katalog; informasi yang memerlukan verifikasi ditandai dengan status yang jelas.
2. Buyer mencari produk atau mengirim RFQ.
3. Seller menerima RFQ, mengajukan pertanyaan bila perlu, lalu menerbitkan quotation berversi dengan masa berlaku dan syarat lengkap.
4. Buyer menerima, menolak, atau meminta revisi. Setiap perubahan syarat dicatat dan ditautkan ke versi yang benar.
5. Setelah kedua pihak menyetujui syarat, sistem membuat order dengan snapshot produk, jumlah, harga, mata uang, incoterms, jadwal, dan syarat pembayaran yang disepakati.
6. Backend memvalidasi stok/lot, kewenangan, batas tenant, dan gerbang yang relevan sebelum mengizinkan pemenuhan.
7. Seller menyiapkan lot dan dokumen; QC serta proses supply chain mengikuti status dan otorisasi masing-masing.
8. Pengiriman dan penerimaan dicatat. Buyer mengonfirmasi penerimaan atau membuka klaim selisih.
9. Pembayaran, refund, dan settlement ditampilkan hanya berdasarkan bukti yang terverifikasi dari sumber yang berwenang.
10. Order ditutup setelah syarat penutupan terpenuhi; seluruh perubahan, persetujuan, dokumen, dan sengketa tetap dapat ditelusuri sesuai kebijakan retensi.

Status order yang disarankan: `draft`, `rfq_submitted`, `quoted`, `negotiation`, `accepted`, `awaiting_payment` (jika berlaku), `confirmed`, `fulfillment`, `ready_to_ship`, `shipped`, `partially_received`, `received`, `disputed`, `completed`, `cancelled`. Status aktual harus ditentukan oleh state machine backend; klien tidak boleh mengubah status secara bebas. Daftar ini adalah rancangan awal yang perlu divalidasi bersama kontrak API.

### 5. Navigasi aplikasi dan perbedaan pengalaman

- **Mode Buyer:** Beranda Buyer, Katalog, RFQ Saya, Penawaran, Pesanan, Pengiriman, Dokumen, Komplain, dan Profil.
- **Mode Seller:** Beranda Seller, Katalog Saya, RFQ Masuk, Quotation, Pesanan Masuk, Pemenuhan, Lot/Stok, Pengiriman, Invoice/Pembayaran, Komplain, dan Profil.
- **Organisasi dengan kedua peran:** pengguna dapat mengganti konteks Buyer/Seller melalui pemilih peran atau organisasi yang jelas, tetapi hanya untuk peran yang telah diotorisasi.
- Menu yang tidak relevan boleh disembunyikan untuk menyederhanakan UI; setiap endpoint tetap wajib memeriksa akses di backend.

### 6. Kontrol transaksi, pembayaran, dan Syariah

- **Pemisahan pihak:** buyer tidak boleh mengubah quotation, stok, inspeksi, atau status pengiriman milik seller; seller tidak boleh mengubah konfirmasi penerimaan buyer.
- **Persetujuan dua pihak:** penerimaan quotation dan perubahan material order perlu merekam aktor, waktu, versi syarat, dan status persetujuan kedua pihak.
- **Harga dan mata uang:** simpan nominal dengan representasi presisi yang sesuai, currency eksplisit, serta rincian biaya; jangan menggunakan floating-point biner untuk perhitungan uang.
- **Stok dan reservasi:** order tidak boleh menyebabkan over-allocation. Reservasi, pelepasan reservasi, pembatalan, dan expiry harus atomik dan dapat direkonsiliasi.
- **Idempotensi dan konkurensi:** retry RFQ, quotation acceptance, order creation, payment event, atau receipt confirmation tidak boleh membuat rekaman ganda; konflik versi harus ditangani secara eksplisit.
- **Dokumen dan privasi:** hanya pihak yang berwenang dapat membaca kontrak, identitas bisnis, alamat, dokumen perdagangan, dan bukti pembayaran; unduhan serta perubahan akses harus diaudit.
- **Pembayaran:** jangan memproses atau menandai pembayaran settled berdasarkan pernyataan klien saja. Verifikasi bank/provider, webhook, atau rekonsiliasi manual yang terotorisasi.
- **Tata kelola Syariah:** akad, kepemilikan/otoritas menjual, spesifikasi barang, harga, biaya/komisi, risiko, delivery, refund, pembatalan, serta mekanisme pembiayaan harus ditinjau oleh penasihat Syariah kompeten sesuai transaksi. Label atau UI Buyer/Seller bukan bukti kepatuhan Syariah.
- **Keputusan manusia:** verifikasi perusahaan, pengecualian compliance, persetujuan akad, sengketa, dan keputusan berisiko tidak boleh disetujui otomatis oleh AI.

### 7. Acceptance tests Buyer/Seller sebelum rilis

- [ ] Buyer internal hanya dapat melihat katalog dan penawaran sesuai kewenangannya.
- [ ] Seller internal atau supplier eksternal hanya dapat mengelola RFQ, quotation, dan order yang diotorisasi untuknya.
- [ ] Akun dengan beberapa peran dapat berpindah mode Buyer/Seller hanya sesuai role assignment yang sah; konteks enterprise tetap satu.
- [ ] Manipulasi ID RFQ, quotation, order, dokumen, invoice, atau shipment tidak memberi akses ke objek pihak lain.
- [ ] Buyer tidak dapat mengubah quotation atau status pemenuhan Seller; Seller tidak dapat memalsukan penerimaan Buyer.
- [ ] Perubahan quotation/order menghasilkan versi dan audit trail; persetujuan terikat ke versi yang benar.
- [ ] Dua permintaan order bersamaan tidak dapat mengalokasikan stok melebihi jumlah yang tersedia.
- [ ] Retry order, konfirmasi penerimaan, dan event pembayaran tidak membuat transaksi ganda.
- [ ] Pembatalan, refund, selisih, dan sengketa memiliki alur status, alasan, dan otorisasi yang teruji.
- [ ] Dokumen dan bukti pembayaran tidak dapat diakses oleh pengguna yang tidak berwenang.
- [ ] Status settled hanya muncul setelah verifikasi sumber pembayaran yang sah.
- [ ] Persyaratan Syariah/legal yang memerlukan review manusia tidak dapat dilewati melalui API mobile.
- [ ] Test negatif tanpa autentikasi, lintas-tenant, dan eskalasi peran lulus pada backend.
- [ ] Seluruh test dan job CI diperiksa pada commit SHA kandidat yang sama sebelum rilis.

### 8. Prioritas implementasi Buyer/Seller

| Prioritas | Cakupan |
|---|---|
| **B0 — Fondasi** | Model organisasi/membership, role matrix Buyer/Seller, tenant isolation, autentikasi, audit trail, dan kebijakan akses dokumen. |
| **B1 — Perdagangan dasar** | Profil perusahaan, katalog, RFQ, quotation berversi, persetujuan kedua pihak, dan order state machine. |
| **B2 — Pemenuhan supply chain** | Reservasi stok/lot, QC, dokumen, shipment, konfirmasi penerimaan, selisih, dan klaim. |
| **B3 — Komersial lanjutan** | Invoice, payment-provider integration, rekonsiliasi, refund, analitik, notifikasi, dan integrasi eksternal setelah kontrak dan sandbox tersedia. |

Implementasi harus tetap mengikuti prinsip branch dan pull request terpisah, pengujian dengan data sintetis, serta tidak melakukan merge ke `main` atau deployment tanpa persetujuan yang diwajibkan.
