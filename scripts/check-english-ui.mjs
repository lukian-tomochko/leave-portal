#!/usr/bin/env node
// Інтерфейс застосунку повністю англійською (docs/decisions/0009-english-ui.md): у src/ не має бути кириличного тексту поза
// коментарями. Пропускає коментарі (// і /* */) та тести (*.test.ts(x): їхні назви — документація українською).
// Коментарі прибираємо регулярками (наближено): блокові /* */ цілком, рядкові // від початку коментаря; «://» у рядках не чіпаємо.
// Використання: node scripts/check-english-ui.mjs [--root <dir>]
// Код виходу: 0 — кирилиці в коді немає, 1 — знайдено.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const root = rootIdx >= 0 ? args[rootIdx + 1] : process.cwd();
const CYRILLIC = /[А-Яа-яІіЇїЄєҐґ]/;
const SOURCE = /\.(tsx|ts|jsx|js)$/;
const TEST = /\.test\.(tsx|ts)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "node_modules" || name === ".next") continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE.test(name) && !TEST.test(name)) out.push(full);
  }
  return out;
}

const withoutComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ""))
    .replace(/(^|[^:\w"'`])\/\/.*$/gm, "$1");

const findings = [];
for (const file of walk(join(root, "src"))) {
  withoutComments(readFileSync(file, "utf8"))
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (CYRILLIC.test(line)) findings.push(`${relative(root, file).split(sep).join("/")}:${index + 1}  ${line.trim().slice(0, 110)}`);
    });
}

if (findings.length === 0) {
  console.log("check-english-ui: OK — кириличного тексту в коді src/ немає.");
} else {
  for (const finding of findings) console.log(finding);
  console.log(`\ncheck-english-ui: ${findings.length} рядків із кирилицею поза коментарями. Інтерфейс має бути англійським (ADR 0009).`);
}
process.exit(findings.length === 0 ? 0 : 1);
