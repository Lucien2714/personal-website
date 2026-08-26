import {describe, expect, it} from 'vitest';

import {
  COMMENT_MAX_LENGTH,
  renderComment,
} from '@/lib/content/comment-markdown';

describe('renderComment', () => {
  it('keeps inline formatting a commenter actually uses', async () => {
    const {html} = await renderComment(
      'That is **important**, and *this* is `code`.',
    );

    expect(html).toContain('<strong>important</strong>');
    expect(html).toContain('<em>this</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('keeps lists, quotes and code blocks', async () => {
    const {html} = await renderComment(
      ['- one', '- two', '', '> quoted', '', '```', 'x = 1', '```'].join('\n'),
    );

    expect(html).toContain('<ul>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<pre>');
  });

  it('strips headings, so a comment cannot outrank the article', async () => {
    const {html} = await renderComment('# Shouting\n\nbody');

    expect(html).not.toContain('<h1');
    // The text survives as prose; only the structure is removed.
    expect(html).toContain('Shouting');
  });

  it('strips images', async () => {
    const {html} = await renderComment(
      '![](https://tracker.example/pixel.gif)',
    );

    expect(html).not.toContain('<img');
    expect(html).not.toContain('tracker.example');
  });

  it('strips tables', async () => {
    const {html} = await renderComment(
      ['| a | b |', '| - | - |', '| 1 | 2 |'].join('\n'),
    );

    expect(html).not.toContain('<table');
  });

  it('drops raw HTML rather than rendering it', async () => {
    const {html} = await renderComment(
      '<script>alert(1)</script><iframe src="https://evil.example"></iframe>',
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('evil.example');
  });

  it('neutralises a javascript: link', async () => {
    const {html} = await renderComment('[click](javascript:alert(1))');

    expect(html).not.toContain('javascript:');
  });

  it('marks outgoing links nofollow, so comments are not an SEO target', async () => {
    const {html} = await renderComment('[site](https://example.com)');

    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('nofollow');
    expect(html).toContain('ugc');
    expect(html).toContain('noopener');
    expect(html).toContain('target="_blank"');
  });

  it('hardens autolinked bare URLs too', async () => {
    const {html} = await renderComment('see https://example.com for details');

    expect(html).toContain('<a');
    expect(html).toContain('nofollow');
  });

  it('reports empty text for input that sanitises away to nothing', async () => {
    // The action uses this to reject a comment whose whole content was
    // stripped, rather than storing a blank one.
    const {text} = await renderComment('![](https://example.com/a.png)');

    expect(text).toBe('');
  });

  it('extracts plain text for the moderation list', async () => {
    const {text} = await renderComment(
      '**Hello** there, [friend](https://a.b)',
    );

    expect(text).toBe('Hello there, friend');
  });

  it('publishes a length cap for the form and the action to share', () => {
    expect(COMMENT_MAX_LENGTH).toBeGreaterThan(500);
  });
});
