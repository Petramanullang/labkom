// Uji unit pengaman idempotensi server.
// Jalankan: node --experimental-strip-types tests/idempotency.test.mjs
import { strict as assert } from "node:assert";
import { withIdempotency } from "../lib/server/idempotency.ts";

let calls = 0;
const slowAction = async () => {
  calls += 1;
  await new Promise((r) => setTimeout(r, 40));
  return { transaction_id: "LK-TEST-1" };
};

// 1. Dua request bersamaan dengan kunci sama -> hanya satu pemanggilan.
const [a, b] = await Promise.all([
  withIdempotency("create_transaction:sesi-1", slowAction),
  withIdempotency("create_transaction:sesi-1", slowAction),
]);
assert.equal(calls, 1, "request bersamaan harus di-dedupe");
assert.equal(a.value.transaction_id, "LK-TEST-1");
assert.equal(b.value.transaction_id, "LK-TEST-1");
assert.equal(a.duplicated, false);
assert.equal(b.duplicated, true);

// 2. Request ketiga setelah selesai -> ambil hasil cache, tidak memanggil lagi.
const c = await withIdempotency("create_transaction:sesi-1", slowAction);
assert.equal(calls, 1, "request setelah selesai harus ambil cache");
assert.equal(c.duplicated, true);

// 3. Kunci berbeda -> transaksi baru tetap boleh.
const d = await withIdempotency("create_transaction:sesi-2", slowAction);
assert.equal(calls, 2, "sesi checkout berbeda harus tetap bisa transaksi");
assert.equal(d.duplicated, false);

// 4. Aksi gagal -> kunci dibuang supaya user bisa mencoba lagi.
let failCalls = 0;
const failing = async () => {
  failCalls += 1;
  throw new Error("apps script down");
};
await assert.rejects(() =>
  withIdempotency("create_transaction:sesi-3", failing),
);
await assert.rejects(() =>
  withIdempotency("create_transaction:sesi-3", failing),
);
assert.equal(failCalls, 2, "setelah gagal, kunci harus dilepas");

console.log("OK — semua uji idempotensi lulus");

