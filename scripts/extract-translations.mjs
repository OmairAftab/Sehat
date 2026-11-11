import ts from "typescript";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const dictionary = {};
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = dir + "/" + entry.name;
    if (entry.isDirectory()) scan(path);
    else if (/\.tsx$/.test(path)) {
      const source = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function visit(node) {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "t" &&
          node.arguments.length === 2 &&
          node.arguments.every(ts.isStringLiteral)
        ) {
          const [en, ur] = node.arguments;
          dictionary[en.text] = { en: en.text, ur: ur.text };
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}
scan("src");
writeFileSync(
  "src/lib/i18n.ts",
  "// Shared UI dictionary. Dynamic messages pass a translated fallback.\nexport const dictionary: Record<string, {en: string; ur: string}> = " +
    JSON.stringify(dictionary, null, 2) +
    ';\nexport function translate(en:string, ur:string, language: "en"|"ur"){ return dictionary[en]?.[language] ?? (language === "ur" ? ur : en); }\n',
);
