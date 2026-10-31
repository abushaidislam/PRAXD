import path from "path";

export interface SyntaxValidationResult {
  valid: boolean;
  language: string;
  errors: string[];
  lineCount: number;
}

/**
 * Detects the programming language based on file extension.
 */
export function detectLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".ts":
    case ".mts":
    case ".cts":
      return "typescript";
    case ".tsx":
      return "typescript-react";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".jsx":
      return "javascript-react";
    case ".json":
      return "json";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".rs":
      return "rust";
    case ".sql":
      return "sql";
    case ".html":
      return "html";
    case ".css":
    case ".scss":
      return "css";
    case ".md":
      return "markdown";
    default:
      return "text";
  }
}

/**
 * Validates balanced brackets, quotes, and structural delimiters.
 * Safely ignores brackets inside string literals and comments.
 */
function validateDelimiterBalance(code: string, lang: string): string[] {
  const errors: string[] = [];
  const stack: { char: string; line: number; col: number }[] = [];

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;
  let isEscaped = false;

  let currentLine = 1;
  let currentCol = 0;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = i + 1 < code.length ? code[i + 1] : "";
    currentCol++;

    if (char === "\n") {
      currentLine++;
      currentCol = 0;
      inLineComment = false;
      continue;
    }

    if (inLineComment) {
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && nextChar === "/") {
        inBlockComment = false;
        i++; // Skip slash
      }
      continue;
    }

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      continue;
    }

    // String literals
    if (inSingleQuote) {
      if (char === "'") inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      if (char === '"') inDoubleQuote = false;
      continue;
    }
    if (inBacktick) {
      if (char === "`") inBacktick = false;
      continue;
    }

    // Comment starts
    if (char === "/" && nextChar === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (char === "/" && nextChar === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (char === "#" && (lang === "python" || lang === "yaml")) {
      inLineComment = true;
      continue;
    }
    if (char === "-" && nextChar === "-" && lang === "sql") {
      inLineComment = true;
      i++;
      continue;
    }

    // Quotes open
    if (char === "'") {
      inSingleQuote = true;
      continue;
    }
    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }
    if (char === "`" && (lang.includes("javascript") || lang.includes("typescript") || lang === "go")) {
      inBacktick = true;
      continue;
    }

    // Opening brackets
    if (char === "(" || char === "{" || char === "[") {
      stack.push({ char, line: currentLine, col: currentCol });
      continue;
    }

    // Closing brackets
    if (char === ")" || char === "}" || char === "]") {
      if (stack.length === 0) {
        errors.push(`Unmatched closing delimiter '${char}' at line ${currentLine}:${currentCol}`);
        continue;
      }
      const top = stack.pop()!;
      const expectedPair: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
      if (expectedPair[top.char] !== char) {
        errors.push(
          `Mismatched delimiter: opened with '${top.char}' at line ${top.line}:${top.col} but closed with '${char}' at line ${currentLine}:${currentCol}`
        );
      }
    }
  }

  if (inSingleQuote) errors.push("Unclosed single-quote (') string literal.");
  if (inDoubleQuote) errors.push('Unclosed double-quote (") string literal.');
  if (inBacktick) errors.push("Unclosed template backtick (`) string literal.");
  if (inBlockComment) errors.push("Unclosed block comment (/* ... */).");

  while (stack.length > 0) {
    const unclosed = stack.pop()!;
    errors.push(`Unclosed opening delimiter '${unclosed.char}' opened at line ${unclosed.line}:${unclosed.col}`);
  }

  return errors;
}

/**
 * Validates syntax of a complete code block or replacement file.
 */
export function validateCodeSyntax(code: string, filePath: string): SyntaxValidationResult {
  const language = detectLanguageFromPath(filePath);
  const lines = code.split("\n");
  const errors: string[] = [];

  if (!code.trim()) {
    return {
      valid: false,
      language,
      errors: ["Code payload is empty."],
      lineCount: 0,
    };
  }

  // 1. JSON specific syntax check
  if (language === "json") {
    try {
      JSON.parse(code);
    } catch (e: any) {
      errors.push(`Invalid JSON syntax: ${e.message}`);
    }
    return {
      valid: errors.length === 0,
      language,
      errors,
      lineCount: lines.length,
    };
  }

  // 2. Delimiter and token sanity for structural languages
  const delimiterErrors = validateDelimiterBalance(code, language);
  errors.push(...delimiterErrors);

  return {
    valid: errors.length === 0,
    language,
    errors,
    lineCount: lines.length,
  };
}

/**
 * Validates syntax of an applied patch or recommendation code fragment.
 * If the patch contains unified diff markers (`+`, `-`, `@@`), extracts the added lines
 * or tests the resulting code construct.
 */
export function validatePatchSyntax(
  patchOrCode: string,
  filePath: string
): SyntaxValidationResult {
  const language = detectLanguageFromPath(filePath);

  // Check if content is a unified diff
  if (patchOrCode.includes("@@") || patchOrCode.includes("\n+")) {
    const lines = patchOrCode.split("\n");
    const addedCodeLines = lines
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .map((l) => l.slice(1))
      .join("\n");

    if (addedCodeLines.trim()) {
      return validateCodeSyntax(addedCodeLines, filePath);
    }
  }

  return validateCodeSyntax(patchOrCode, filePath);
}
