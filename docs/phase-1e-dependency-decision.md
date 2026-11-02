# Phase 1E — keputusan dependency dan reproducibility

## Keputusan eksplisit

**Tidak mengadopsi major-version overrides `glob@14` dan `minimatch@11` untuk baseline Expo SDK 58.**

Alasan:
- Dependency graph Expo yang terkunci mendeklarasikan `glob ^13` dan `minimatch ^10` pada beberapa jalur.
- Override lintas major berhasil melewati CI eksperimen, tetapi tidak membuktikan kontrak API internal seluruh dependency Expo.
- Audit bersih pada graph override tidak menghilangkan kebutuhan kompatibilitas dan reproducibility.
- Risiko advisories pada graph baseline tetap harus ditangani secara terpisah; tidak ada penerimaan risiko yang diasumsikan oleh dokumen ini.

Expo SDK 58 dipertahankan. Tidak dilakukan downgrade SDK.

## Baseline yang dipulihkan

- Hapus hanya overrides eksperimental `glob` dan `minimatch`.
- Pertahankan override `uuid` yang telah ada sebelumnya.
- Pertahankan `package-lock.json` baseline yang mengunci `glob@13.0.6` dan `minimatch@10.2.6`.
- Workflow tidak boleh menjalankan `npm install --package-lock-only` sebelum `npm ci`.
- `npm ci` harus menginstal langsung dari lockfile yang dikomit pada clean checkout.
- Tidak ada lockfile yang dibangkitkan ulang secara otomatis dalam CI.

## Reproducibility evidence

Workflow harus mencatat:
- commit SHA checkout;
- Node.js dan npm version;
- SHA-256 `package.json`;
- SHA-256 `package-lock.json`;
- hasil `npm ci`;
- versi terpasang `glob`, `minimatch`, dan `expo`.

Artefak lockfile tidak diubah selama instalasi. Hash harus dihitung dari file yang sama sebelum dan sesudah `npm ci`; perubahan hash berarti gate gagal.

## Security posture

Graph baseline diketahui memiliki advisory npm pada `glob@13.0.6` dan `minimatch@10.2.6`. Ini adalah risiko sementara yang belum diterima secara formal. Pemilik risiko dan tanggal review harus ditetapkan oleh maintainer/reviewer. Jangan menyimpulkan bahwa `npm audit` bersih dari hasil CI yang mengizinkan temuan.

## Gate penerimaan

Pada satu SHA dan lockfile yang sama:
1. clean checkout;
2. `npm ci` tanpa regenerasi lockfile;
3. `npm audit` dengan output, exit code, dan severity dicatat;
4. seluruh test;
5. typecheck;
6. `npx expo install --check`;
7. Android JS export;
8. Expo prebuild;
9. Android debug APK;
10. interoperability mobile–web–desktop.

PR hanya kandidat review. Tidak ada merge, deployment, penerimaan risiko, atau perubahan branch protection otomatis.
