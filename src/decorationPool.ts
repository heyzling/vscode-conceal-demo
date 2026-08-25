import * as vscode from "vscode";
import { DecorationSpec, decorationKey } from "./decorationKey";
import { RuleStyle } from "./rules";

export interface PoolStats {
  /** Decoration types alive right now. */
  live: number;
  /** How many have ever been created — the number that grows with the text when a replacement is
   * per occurrence rather than per rule. */
  createdTotal: number;
  peak: number;
}

/** `"theme:editorCodeLens.foreground"` picks a colour from the theme; anything else is a CSS
 * colour, which is what a settings file can express on its own. */
function color(value: string | undefined): string | vscode.ThemeColor | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value.startsWith("theme:") ? new vscode.ThemeColor(value.slice("theme:".length)) : value;
}

function attachment(replacement: string, style: RuleStyle): vscode.ThemableDecorationAttachmentRenderOptions {
  return {
    contentText: replacement,
    color: color(style.color),
    backgroundColor: color(style.backgroundColor),
    border: style.border,
    fontStyle: style.fontStyle,
    fontWeight: style.fontWeight,
    // `ThemableDecorationAttachmentRenderOptions` has no border-radius, so a rounded chip can
    // only be had by closing `textDecoration`'s own value with `;` and appending CSS. Recorded
    // rather than hidden: it is one of the things this demo set out to find out.
    textDecoration: style.borderRadius
      ? `${style.textDecoration ?? "none"}; border-radius: ${style.borderRadius};`
      : style.textDecoration,
    margin: style.margin,
    width: style.width,
    height: style.height,
  };
}

function renderOptions(spec: DecorationSpec): vscode.DecorationRenderOptions {
  return {
    // A concealed range stands for text the user did not type at its edges: growing it when they
    // type next to it would swallow the new characters.
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    conceal: {
      cursorStop: spec.cursorStop,
      replacement: spec.replacement === "" ? undefined : attachment(spec.replacement, spec.style),
    },
  };
}

/**
 * One `TextEditorDecorationType` per distinct (replacement, cursorStop, style).
 *
 * Pooling is not an optimisation here, it is the shape of the API: `conceal` lives on
 * `DecorationRenderOptions`, so what is drawn is a property of the *type*. Types are created
 * lazily and never released while the extension lives, which is deliberate — the count is the
 * measurement this demo exists to take.
 */
export class DecorationPool implements vscode.Disposable {
  private readonly types = new Map<string, vscode.TextEditorDecorationType>();
  private createdTotal = 0;
  private peak = 0;

  typeFor(spec: DecorationSpec): { key: string; type: vscode.TextEditorDecorationType } {
    const key = decorationKey(spec);
    let type = this.types.get(key);
    if (!type) {
      type = vscode.window.createTextEditorDecorationType(renderOptions(spec));
      this.types.set(key, type);
      this.createdTotal += 1;
      this.peak = Math.max(this.peak, this.types.size);
    }
    return { key, type };
  }

  typeByKey(key: string): vscode.TextEditorDecorationType | undefined {
    return this.types.get(key);
  }

  stats(): PoolStats {
    return { live: this.types.size, createdTotal: this.createdTotal, peak: this.peak };
  }

  dispose(): void {
    for (const type of this.types.values()) {
      type.dispose();
    }
    this.types.clear();
  }
}
