/*---------------------------------------------------------------------------------------------
 *  Vendored copy of the `concealedText` API proposal.
 *
 *  `npx @vscode/dts dev` pulls proposal declarations from microsoft/vscode, and this one is not
 *  there: it lives in a fork (branch `heyzling/concealed-text`, upstream issue #171074). The file
 *  below is a verbatim copy of `src/vscode-dts/vscode.proposed.concealedText.d.ts` from that fork
 *  — keep it in step by copying, not by editing.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	// https://github.com/microsoft/vscode/issues/171074

	export interface DecorationRenderOptions {
		/**
		 * Conceal the decorated ranges: their text is left out of what the editor renders, while
		 * the document keeps it. Concealed text holds no cursor positions, so a concealed range
		 * behaves as a single unit for cursor movement, selection and word wrap, and it is still
		 * saved, searched and copied.
		 *
		 * Only ranges within a single line are concealed.
		 */
		conceal?: ConcealRenderOptions;
	}

	/**
	 * Represents rendering styles for concealed text.
	 */
	export interface ConcealRenderOptions {
		/**
		 * Rendered in place of the concealed text. It is drawn, not inserted: it is part of no
		 * document position and is never selected or copied. Defaults to rendering nothing.
		 *
		 * A replacement is drawn, so it has a left and a right side, and each side is one end
		 * of the range it stands for: the caret shows which end it is on, and text typed there
		 * lands on that side of the concealed text.
		 *
		 * It stands in for text on one line, so line feeds are dropped from its `contentText`
		 * and the rest is cut to 16 characters.
		 */
		replacement?: ThemableDecorationAttachmentRenderOptions;

		/**
		 * Which end of the concealed range the one place it collapses to stands for. Only read
		 * when nothing is drawn in its place (no `replacement`), because then nothing on screen
		 * can tell the two ends apart, and the choice decides where text typed there lands and
		 * which side of the range a selection reaching it takes.
		 *
		 * - `after` (default): the place is the end of the concealed text.
		 * - `before`: the place is its start. This is what hidden text that belongs to what
		 *   follows it wants — an indent typed there goes in front of it, and selecting up to
		 *   it stops short of it.
		 */
		cursorStop?: 'before' | 'after';
	}
}
