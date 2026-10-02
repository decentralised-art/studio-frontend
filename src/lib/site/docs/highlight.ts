// A deliberately small syntax highlighter for documentation code samples. It escapes the source
// and wraps comments, strings, numbers and keywords in spans; it does not parse the language.

export type CodeLanguage = "ts" | "python" | "bash" | "json" | "html" | "toml";

type Rules = {
  comment: RegExp;
  keywords: ReadonlySet<string>;
  literals: ReadonlySet<string>;
};

const tsKeywords = [
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "of",
  "return",
  "switch",
  "throw",
  "try",
  "type",
  "typeof",
  "while",
];
const pythonKeywords = [
  "and",
  "as",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "if",
  "import",
  "in",
  "is",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
];

const RULES: Record<CodeLanguage, Rules> = {
  ts: {
    comment: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y,
    keywords: new Set(tsKeywords),
    literals: new Set(["true", "false", "null", "undefined", "this"]),
  },
  python: {
    comment: /#[^\n]*/y,
    keywords: new Set(pythonKeywords),
    literals: new Set(["True", "False", "None", "self"]),
  },
  bash: {
    comment: /(?<=^|\s)#[^\n]*/my,
    keywords: new Set(["npm", "pip", "npx", "export", "curl", "cd", "zip"]),
    literals: new Set(),
  },
  json: {
    comment: /(?!)/y,
    keywords: new Set(),
    literals: new Set(["true", "false", "null"]),
  },
  html: {
    comment: /<!--[\s\S]*?-->/y,
    keywords: new Set(),
    literals: new Set(),
  },
  toml: {
    comment: /#[^\n]*/y,
    keywords: new Set(),
    literals: new Set(["true", "false"]),
  },
};

const STRING = /`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/y;
const NUMBER = /\b(?:0x[0-9a-fA-F]+|\d[\d_]*(?:\.\d+)?n?)\b/y;
const WORD = /[A-Za-z_$][\w$]*/y;
const TAG = /<\/?[A-Za-z][\w-]*|\/?>/y;
const TOML_TABLE = /(?<=^|\n)\[[^\]\n]+\]/y;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const span = (kind: string, value: string) =>
  `<span class="tok-${kind}">${escapeHtml(value)}</span>`;

const matchAt = (pattern: RegExp, source: string, index: number) => {
  pattern.lastIndex = index;
  return pattern.exec(source)?.[0];
};

export const highlight = (source: string, language: CodeLanguage): string => {
  const rules = RULES[language];
  let html = "";
  let plain = "";
  let index = 0;
  const flush = () => {
    html += escapeHtml(plain);
    plain = "";
  };

  while (index < source.length) {
    const comment = matchAt(rules.comment, source, index);
    if (comment) {
      flush();
      html += span("comment", comment);
      index += comment.length;
      continue;
    }
    if (language === "toml") {
      const table = matchAt(TOML_TABLE, source, index);
      if (table) {
        flush();
        html += span("keyword", table);
        index += table.length;
        continue;
      }
    }
    if (language === "html") {
      const tag = matchAt(TAG, source, index);
      if (tag) {
        flush();
        html += span("keyword", tag);
        index += tag.length;
        continue;
      }
    }
    const string = matchAt(STRING, source, index);
    if (string) {
      flush();
      // A JSON string followed by a colon is an object key.
      const isKey = language === "json" && /^\s*:/.test(source.slice(index + string.length));
      html += span(isKey ? "property" : "string", string);
      index += string.length;
      continue;
    }
    const previous = source[index - 1] ?? "";
    if (!/[\w$]/.test(previous)) {
      const number = matchAt(NUMBER, source, index);
      if (number) {
        flush();
        html += span("number", number);
        index += number.length;
        continue;
      }
      const word = matchAt(WORD, source, index);
      if (word) {
        flush();
        if (rules.keywords.has(word)) html += span("keyword", word);
        else if (rules.literals.has(word)) html += span("literal", word);
        else if (/^[A-Z]/.test(word) && language !== "bash") html += span("type", word);
        else if (source[index + word.length] === "(") html += span("function", word);
        else html += escapeHtml(word);
        index += word.length;
        continue;
      }
    }
    plain += source[index];
    index += 1;
  }
  flush();
  return html;
};
