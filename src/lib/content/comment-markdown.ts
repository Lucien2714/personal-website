import type {Root as HastRoot} from 'hast';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import {unified} from 'unified';
import {visit} from 'unist-util-visit';

/**
 * The Markdown pipeline for comments.
 *
 * Deliberately much narrower than the one for posts. A comment is a paragraph
 * or two written by someone the site owner has never met, so it gets inline
 * emphasis, links, code, quotes and lists - and nothing that can restructure
 * or dominate the page around it.
 *
 * What is excluded, and why:
 *
 *   - Headings, because a comment that renders an `<h2>` competes with the
 *     article it sits under.
 *   - Images, because they are the standard vector for tracking pixels and for
 *     posting something the owner would rather not host next to their writing.
 *   - Tables and raw HTML, because neither has a use in a comment that
 *     justifies the surface they add.
 *   - Syntax highlighting, because running the highlighter on arbitrary input
 *     at write time is work an attacker controls the size of. Code still
 *     renders as monospaced text.
 *
 * Links get `rel="nofollow ugc noopener noreferrer"` and `target="_blank"`,
 * which is the standard treatment for user-submitted links: it removes the
 * incentive to comment purely for search ranking.
 */

/** How much Markdown a single comment may contain. */
export const COMMENT_MAX_LENGTH = 4000;

/**
 * Sanitisation schema.
 *
 * Built by subtraction from the library default rather than by listing every
 * allowed tag, so that a future addition to the default is inherited unless
 * it is explicitly one of the things removed here.
 */
const commentSchema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (tag) =>
      ![
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'img',
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'th',
        'td',
        'input',
      ].includes(tag),
  ),
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ['target', '_blank'],
      // Each permitted token listed separately: the sanitiser filters a
      // token list member by member, not as one string.
      ['rel', 'nofollow', 'ugc', 'noopener', 'noreferrer'],
    ],
  },
  // `className` is not granted anywhere: comment HTML is styled entirely by
  // its container, so there is nothing for a class to legitimately do.
  clobberPrefix: 'comment-',
} satisfies typeof defaultSchema;

/**
 * Adds the link treatment that the sanitiser then validates.
 *
 * Applied before sanitising rather than after, so the schema's allow-list is
 * what ultimately decides these attributes are acceptable - rather than this
 * plugin being trusted to have got them right.
 */
function hardenLinks() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'a') {
        node.properties = {
          ...node.properties,
          target: '_blank',
          rel: ['nofollow', 'ugc', 'noopener', 'noreferrer'],
        };
      }
    });
  };
}

/** A rendered comment. */
export interface RenderedComment {
  /** Sanitised HTML, safe to inject. */
  html: string;
  /** Plain text, used for the moderation list and for length checks. */
  text: string;
}

/**
 * Renders a comment to sanitised HTML.
 *
 * @param markdown What the commenter typed.
 * @returns The HTML to store, plus a plain-text rendition.
 */
export async function renderComment(
  markdown: string,
): Promise<RenderedComment> {
  const file = await unified()
    .use(remarkParse)
    // GFM without the pieces the schema strips anyway: autolinks and
    // strikethrough are the parts a commenter actually uses.
    .use(remarkGfm, {singleTilde: false})
    .use(remarkRehype, {allowDangerousHtml: false})
    .use(hardenLinks)
    .use(rehypeSanitize, commentSchema)
    .use(rehypeStringify)
    .process(markdown);

  const html = String(file);

  return {
    html,
    // Cheap tag strip: the input has already been sanitised, so this only has
    // to be good enough for a moderation preview.
    text: html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  };
}
