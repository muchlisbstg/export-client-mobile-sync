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
- [Batasan MVP dan langkah lanjutan](#batasan-mvp-dan-langkah-lanjutan)

## Ringkasan

- **Mobile UI:** Expo + React Native.
- **Runtime API:** Node.js 22 atau lebih baru, Express 5.
- **Penyimpanan lokal backend:** SQLite melalui `better-sqlite3`.
- **Model inquiry:** catatan inquiry bersifat append-only; tidak tersedia alur edit atau hapus inquiry pada kontrak MVP yang dijelaskan di sini.
- **Sinkronisasi:** opsional, berbasis peer, dengan outbox persisten, retry/backoff, timeout, dan pencatatan konflik.
- **Data katalog:** katalog demo; jangan menganggapnya sebagai katalog produksi.
- **Tidak ada deployment otomatis** dari perintah export Android yang dijelaskan pada README ini.

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

## Batasan MVP dan langkah lanjutan

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
