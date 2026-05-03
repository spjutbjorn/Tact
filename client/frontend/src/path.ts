export function basename(path: string): string {
  const normalized = path.endsWith("::") ? path.slice(0, -2) : path;
  const virtualParts = normalized.split("::");
  const inner = virtualParts.length > 1 ? virtualParts[1] : virtualParts[0];
  const leaf = inner.split("/").pop() ?? inner;
  return leaf || virtualParts[0];
}

export function dirname(path: string): string {
  if (path.endsWith("::")) {
    const archive = path.slice(0, -2);
    const outer = archive.split("/").slice(0, -1).join("/");
    return outer ? `${outer}/` : "/";
  }

  const virtualParts = path.split("::");
  if (virtualParts.length > 1) {
    const archive = virtualParts[0];
    const inner = virtualParts[1];
    const innerParts = inner.split("/").filter(Boolean);
    innerParts.pop();
    const nextInner = innerParts.join("/");
    return nextInner ? `${archive}::${nextInner}` : `${archive}::`;
  }

  const parts = path.split("/");
  parts.pop();
  const parent = parts.join("/");
  return parent || "/";
}

export function joinPath(parent: string, child: string): string {
  if (parent.endsWith("::")) return `${parent}${child}`;
  if (parent.includes("::")) return `${parent}/${child}`;
  if (parent === "/") return `/${child}`;
  const normalizedParent = parent.replace(/\/$/, "");
  return normalizedParent ? `${normalizedParent}/${child}` : child;
}

export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

export function isJsonPath(path: string): boolean {
  return /\.(json|jsonc|jsonl|ndjson)$/i.test(path);
}

export function isPdfPath(path: string): boolean {
  return /\.pdf$/i.test(path);
}

export function isDocxPath(path: string): boolean {
  return /\.docx$/i.test(path);
}

export function isEpubPath(path: string): boolean {
  return /\.epub$/i.test(path);
}

export function isRtfPath(path: string): boolean {
  return /\.rtf$/i.test(path);
}

export function isLicensePath(path: string): boolean {
  return /(^|\/)(license|copying|notice)(\..*)?$/i.test(path);
}

export function isTextLikePath(path: string): boolean {
  return /(^|\/)\.gitignore$|\.(txt|text|md|markdown|mdx|rst|adoc|asciidoc|org|tex|latex|bib|bibtex|rmd|qmd|json|jsonc|jsonl|ndjson|yaml|yml|xml|csv|tsv|log|toml|ini|conf|cfg|rc|env|properties|prop|lock|diff|patch|sql|graphql|gql|proto|cue|rego|sh|bash|zsh|fish|ps1|psm1|py|pyi|rb|php|pl|pm|go|rs|ts|tsx|js|jsx|cjs|mjs|cts|mts|flow|c|h|cpp|hpp|cc|hh|cxx|hxx|java|kt|kts|swift|cs|fs|fsx|lua|scala|clj|cljs|edn|erl|ex|exs|hs|nim|dart|groovy|gradle|make|mk|cmake|cabal|nix|r|jl|m|mm|matlab|vue|svelte|html|htm|css|scss|sass|less|styl|svg|xhtml|xaml|xsl|xslt|plist|vcxproj|csproj|sln|iml|mdc|manifest|version|work|applescript|bnf|mod|sum|md5|map|vhd|vhdl|wat)$/i.test(path);
}

export function isZipArchivePath(path: string): boolean {
  return /\.zip$/i.test(path);
}

export function isVirtualZipPath(path: string): boolean {
  return path.includes("::");
}

export function extname(path: string): string {
  const base = basename(path);
  const index = base.lastIndexOf(".");
  if (index <= 0) return "";
  return base.substring(index);
}
