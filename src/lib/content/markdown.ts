import rehypeShiki from '@shikijs/rehype';
import type {Root as HastRoot} from 'hast';
import {toString as hastToString} from 'hast-util-to-string';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import {unified} from 'unified';
import {visit} from 'unist-util-visit';

/**
 * The Markdown rendering pipeline.
 *
 * Rendering happens once, when content is saved, and the resulting HTML is
 * stored alongside the Markdown source. Read paths then serve a string, which
 * is why a post page costs one query and no CPU.
 *
 * The plugin order is deliberate. Sanitising runs immediately after the
 * Markdown-to-HTML conversion, while the tree still contains only what the
 * author wrote. Everything that comes afterwards - heading anchors, syntax
 * highlighting, formula rendering - is markup this module generates itself,
 * so it does not need to survive a filter that would otherwise strip it.
 */

/** One entry in a rendered document's table of contents. */
export interface TocEntry {
  /** Anchor id assigned by rehype-slug. */
  id: string;
  /** Plain-text heading, with any inline markup flattened. */
  text: string;
  /** Heading level: 2 or 3. Level 1 belongs to the page title, not the body. */
  depth: 2 | 3;
}

/** Everything derived from a Markdown source document. */
export interface RenderedMarkdown {
  /** Sanitised HTML ready to be injected into the page. */
  html: string;
  /** Headings found in the document, in document order. */
  toc: TocEntry[];
  /** Estimated reading time in minutes, never less than one. */
  readingMinutes: number;
  /** Plain-text excerpt suitable for meta descriptions and cards. */
  excerpt: string;
}

/**
 * Sanitisation schema.
 *
 * Extends the conservative default with the few attributes this site's own
 * markup needs: heading ids for deep links, and the class names that mark
 * maths spans for KaTeX and language hints for the highlighter.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'id', 'className'],
    // Allow footnote and external-link conventions produced by GFM.
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      'target',
      'rel',
      ['ariaHidden', 'true'],
    ],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading', 'decoding'],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'section',
    'figure',
    'figcaption',
  ],
} satisfies typeof defaultSchema;

/** Average reading speed for Latin script, in words per minute. */
const WORDS_PER_MINUTE = 220;

/** Average reading speed for CJK script, in characters per minute. */
const CJK_CHARS_PER_MINUTE = 450;

/** Matches CJK ideographs, kana and Hangul. */
const CJK_PATTERN = /[぀-ヿ㐀-䶿一-鿿가-힯]/g;

/**
 * Estimates reading time for mixed Chinese and English prose.
 *
 * Counting "words" alone badly underestimates Chinese, where a sentence has
 * few spaces; counting characters alone badly overestimates English. This
 * splits the text by script and adds the two estimates.
 *
 * @param text Plain text, with Markdown syntax already removed.
 */
export function estimateReadingMinutes(text: string): number {
  const cjkCharacters = text.match(CJK_PATTERN)?.length ?? 0;
  const latinWords = text
    .replace(CJK_PATTERN, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  const minutes =
    cjkCharacters / CJK_CHARS_PER_MINUTE + latinWords / WORDS_PER_MINUTE;

  return Math.max(1, Math.round(minutes));
}

/**
 * Collects headings and captures plain text while the tree is still in memory.
 *
 * Implemented as a unified plugin rather than a second pass over the output
 * HTML: re-parsing the string would cost as much as rendering it again.
 */
function collectMetadata(collected: {toc: TocEntry[]; text: string[]}) {
  return () => (tree: HastRoot) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'h2' || node.tagName === 'h3') {
        const id =
          typeof node.properties?.id === 'string' ? node.properties.id : '';
        if (id) {
          collected.toc.push({
            id,
            text: hastToString(node),
            depth: node.tagName === 'h2' ? 2 : 3,
          });
        }
      }

      if (node.tagName === 'p') {
        collected.text.push(hastToString(node));
      }
    });
  };
}

/**
 * Renders Markdown to sanitised HTML plus the metadata the site needs.
 *
 * @param markdown The author-written source document.
 * @param options.excerptLength Maximum excerpt length in characters.
 * @returns HTML, table of contents, reading time and a plain-text excerpt.
 */
export async function renderMarkdown(
  markdown: string,
  options: {excerptLength?: number} = {},
): Promise<RenderedMarkdown> {
  const collected: {toc: TocEntry[]; text: string[]} = {toc: [], text: []};

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    // Raw HTML in the source is dropped rather than passed through: the
    // editor is Markdown, and embedding arbitrary HTML is what the project
    // embed feature is for.
    .use(remarkRehype, {allowDangerousHtml: false})
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: {className: ['heading-anchor']},
    })
    .use(collectMetadata(collected))
    .use(rehypeShiki, {
      themes: {light: 'github-light', dark: 'github-dark'},
      // Unknown languages fall back to plain text instead of throwing, so a
      // typo in a fence info string cannot break a save.
      fallbackLanguage: 'text',
    })
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(markdown);

  const plainText = collected.text.join(' ').replace(/\s+/g, ' ').trim();
  const excerptLength = options.excerptLength ?? 200;

  return {
    html: String(file),
    toc: collected.toc,
    readingMinutes: estimateReadingMinutes(plainText),
    excerpt:
      plainText.length > excerptLength
        ? `${plainText.slice(0, excerptLength).trimEnd()}…`
        : plainText,
  };
}
