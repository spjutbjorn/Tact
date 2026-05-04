import { DEFAULT_TEXT_EXTENSIONS, DEFAULT_HIDDEN_NAMES } from "./fileHandlers";

const DATA_EXTENSIONS = ["json", "yaml", "yml", "toml", "xml", "csv", "sql", "proto", "graphql", "gql", "env", "conf", "ini"];
const CODE_EXTENSIONS = ["js", "ts", "tsx", "jsx", "py", "go", "rs", "cpp", "c", "h", "java", "cs", "rb", "php", "pl", "swift", "kt", "scala", "dart", "lua", "clj", "erl", "ex", "sh", "bash"];
const WEB_EXTENSIONS = ["html", "css", "scss", "sass", "less", "styl", "xhtml", "vue", "svelte"];
const DOC_EXTENSIONS = ["md", "txt", "log", "rst", "adoc", "org", "tex", "rmd", "qmd", "mdx", "mdc"];

export function filterExtensions(extensions: string[], query: string): string[] {
  const clean = query.trim().toLowerCase().replace(/^\./, "");
  if (!clean) return extensions;
  return extensions.filter((extension) => extension.includes(clean));
}

export function getExtensionClass(ext: string): string {
  const isDefault = DEFAULT_TEXT_EXTENSIONS.includes(ext);
  let cls = "settings__ext-tag";
  if (isDefault) cls += " settings__ext-tag--default";

  if (DATA_EXTENSIONS.includes(ext)) cls += " settings__ext-tag--data";
  else if (CODE_EXTENSIONS.includes(ext)) cls += " settings__ext-tag--code";
  else if (WEB_EXTENSIONS.includes(ext)) cls += " settings__ext-tag--web";
  else if (DOC_EXTENSIONS.includes(ext)) cls += " settings__ext-tag--doc";

  return cls;
}

export function addExtension(extensions: string[], rawValue: string): string[] {
  const clean = rawValue.trim().toLowerCase().replace(/^\./, "");
  if (!clean || extensions.includes(clean)) return extensions;
  return [...extensions, clean].sort();
}

export function removeExtension(extensions: string[], value: string): string[] {
  return extensions.filter((extension) => extension !== value);
}

export function resetTextExtensions(): string[] {
  return [...DEFAULT_TEXT_EXTENSIONS];
}

export function resetHiddenNames(): string[] {
  return [...DEFAULT_HIDDEN_NAMES];
}
