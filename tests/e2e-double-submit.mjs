// CATATAN: uji ini menyasar arsitektur LAMA (Next.js + Apps Script).
// Sejak migrasi ke Supabase + Google Drive, idempotensi dijamin oleh indeks
// unik `orders.client_ref` di database, sehingga mock Apps Script di bawah ini
// tidak lagi menggambarkan sistem yang berjalan. Simpan sebagai referensi saja.
//
// Uji end-to-end: dua request transaksi bersamaan dengan client_ref sama harus
// menghasilkan HANYA SATU panggilan ke Apps Script dan satu baris transaksi.
//
// Jalankan setelah `pnpm build`:
//   node tests/e2e-double-submit.mjs
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const APP_PORT = 3321;
const MOCK_PORT = 3322;

let upstreamHits = 0;
let rowCount = 0;

const mock = createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: [] }));
    return;
  }
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    upstreamHits += 1;
    rowCount += 1;
    const payload = JSON.parse(body || "{}");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        data: {
          transaction_id: `LK-E2E-${rowCount}`,
          status: "Menunggu verifikasi",
          client_ref: payload.client_ref,
        },
      }),
    );
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => mock.listen(MOCK_PORT, "127.0.0.1", r));

const next = spawn("npx", ["next", "start", "-p", String(APP_PORT)], {
  cwd: projectRoot,
  env: {
    ...process.env,
    APPS_SCRIPT_URL: `http://127.0.0.1:${MOCK_PORT}/apps-script`,
  },
  stdio: "ignore",
  // Process group sendiri supaya `next-server` anaknya ikut mati saat di-kill
  // dan tidak tertinggal memegang port (yang membuat uji ini jadi palsu).
  detached: true,
});

function stopServer() {
  try {
    process.kill(-next.pid, "SIGKILL");
  } catch {
    next.kill("SIGKILL");
  }
}

let ready = false;
for (let i = 0; i < 40 && !ready; i++) {
  await sleep(500);
  try {
    const r = await fetch(`http://127.0.0.1:${APP_PORT}/api/transactions`);
    ready = r.status === 200;
  } catch {
    /* server belum siap */
  }
}

if (!ready) {
  console.error("Server gagal start — jalankan `pnpm build` lebih dulu.");
  stopServer();
  mock.close();
  process.exit(1);
}

const payload = {
  action: "create_transaction",
  client_ref: "ref-e2e-abc-123",
  nama: "Aimee",
  menu: "Pempek x1",
  qty: 1,
  total: 23000,
  proof: "ZmFrZQ==",
  fileName: "bukti.png",
};

const post = () =>
  fetch(`http://127.0.0.1:${APP_PORT}/api/transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => r.json());

// Simulasi user menekan tombol dua kali: dua request bersamaan.
const results = await Promise.all([post(), post()]);
await sleep(300);
// Lalu satu request susulan setelah yang pertama selesai.
const third = await post();

console.log("--- hasil uji -------------------------------");
console.log("request dari client      : 3");
console.log("panggilan ke Apps Script :", upstreamHits);
console.log("baris transaksi dibuat   :", rowCount);
console.log(
  "id transaksi diterima    :",
  results.map((r) => r.data?.transaction_id),
);
console.log("duplicated (request ke-3):", third.duplicated === true);

const ok = upstreamHits === 1 && rowCount === 1;
console.log(ok ? "LULUS — transaksi tidak dobel" : "GAGAL — transaksi dobel");

stopServer();
mock.close();
process.exit(ok ? 0 : 1);



