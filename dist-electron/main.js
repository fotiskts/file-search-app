import { ipcMain as x, dialog as P, shell as S, app as m, BrowserWindow as y } from "electron";
import { createRequire as D } from "node:module";
import { fileURLToPath as L } from "node:url";
import a from "node:path";
import l from "node:fs";
const _ = D(import.meta.url), E = a.dirname(L(import.meta.url));
process.env.APP_ROOT = a.join(E, "..");
const w = process.env.VITE_DEV_SERVER_URL, U = a.join(process.env.APP_ROOT, "dist-electron"), v = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = w ? a.join(process.env.APP_ROOT, "public") : v;
let h;
function T() {
  h = new y({
    width: 1200,
    height: 800,
    icon: a.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: a.join(E, "preload.mjs")
    }
  }), w ? h.loadURL(w) : h.loadFile(a.join(v, "index.html"));
}
async function O(s, n) {
  if (n === ".txt")
    return l.readFileSync(s, "utf-8");
  if (n === ".docx")
    return (await _("mammoth").extractRawText({ path: s })).value;
  if (n === ".pdf") {
    const t = _("pdfjs-dist/legacy/build/pdf.js"), i = new Uint8Array(l.readFileSync(s)), o = await t.getDocument({ data: i }).promise;
    let r = "";
    for (let e = 1; e <= o.numPages; e++) {
      const p = await (await o.getPage(e)).getTextContent();
      r += p.items.map((d) => d.str).join(" ") + `
`;
    }
    return r;
  }
  return n === ".rtf" ? l.readFileSync(s, "utf-8").replace(/\{\*?\\[^{}]+}|[{}]|\\[A-Za-z]+\d* ?/g, "").replace(/\\\n/g, `
`).trim() : "";
}
function j(s, n) {
  const t = [], i = l.readdirSync(s);
  for (const o of i) {
    const r = a.join(s, o);
    if (l.statSync(r).isDirectory())
      t.push(...j(r, n));
    else {
      const c = a.extname(o).toLowerCase();
      n.includes(c) && t.push({ name: o, path: r, ext: c });
    }
  }
  return t;
}
x.handle("select-folder", async () => {
  const s = await P.showOpenDialog({ properties: ["openDirectory"] });
  if (s.canceled) return [];
  const n = s.filePaths[0], i = j(n, [".txt", ".docx", ".pdf", ".rtf"]), o = [];
  for (const r of i) {
    const e = await O(r.path, r.ext);
    o.push({ ...r, text: e });
  }
  return o;
});
x.handle("search-files", async (s, n, t, i) => {
  if (!t.trim()) return [];
  const o = i ? t : t.toLowerCase(), r = [];
  for (const e of n) {
    const c = i ? e.text : e.text.toLowerCase();
    if (!c.includes(o)) continue;
    const p = [];
    let d = 0;
    for (; ; ) {
      const u = c.indexOf(o, d);
      if (u === -1) break;
      const g = Math.max(0, u - 100), R = Math.min(e.text.length, u + o.length + 100);
      let f = e.text.slice(g, R).replace(/\n/g, " ").trim();
      g > 0 && (f = "..." + f), R < e.text.length && (f = f + "..."), p.push(f), d = u + o.length;
    }
    r.push({ name: e.name, path: e.path, ext: e.ext, matches: p, preview: e.text.slice(0, 300) });
  }
  return r;
});
x.handle("open-file", async (s, n) => {
  await S.openPath(n);
});
x.handle("export-results", async (s, n) => {
  const t = await P.showSaveDialog({
    title: "Export Search Results",
    defaultPath: "search-results.txt",
    filters: [{ name: "Text Files", extensions: ["txt"] }]
  });
  return !t.canceled && t.filePath ? (l.writeFileSync(t.filePath, n, "utf-8"), !0) : !1;
});
m.on("window-all-closed", () => {
  process.platform !== "darwin" && (m.quit(), h = null);
});
m.on("activate", () => {
  y.getAllWindows().length === 0 && T();
});
m.whenReady().then(T);
export {
  U as MAIN_DIST,
  v as RENDERER_DIST,
  w as VITE_DEV_SERVER_URL
};
