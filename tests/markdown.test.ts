import {describe, expect, it} from 'vitest';

import {estimateReadingMinutes, renderMarkdown} from '@/lib/content/markdown';

describe('renderMarkdown', () => {
  it('renders headings with anchors and collects a table of contents', async () => {
    const result = await renderMarkdown(
      ['## First section', '', 'Some prose.', '', '### Nested', ''].join('\n'),
    );

    expect(result.html).toContain('<h2 id="first-section">');
    expect(result.html).toContain('class="heading-anchor"');
    expect(result.toc).toEqual([
      {id: 'first-section', text: 'First section', depth: 2},
      {id: 'nested', text: 'Nested', depth: 3},
    ]);
  });

  it('strips raw HTML rather than passing it through', async () => {
    const result = await renderMarkdown(
      'Before <script>alert(1)</script> after.',
    );

    // The tags are dropped. Their text content survives as ordinary prose,
    // which is inert and is the correct outcome for Markdown.
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('</script>');
    expect(result.html).toContain('<p>');
  });

  it('neutralises a javascript: link', async () => {
    const result = await renderMarkdown('[click](javascript:alert(1))');

    expect(result.html).not.toContain('javascript:');
  });

  it('highlights fenced code with Shiki', async () => {
    const result = await renderMarkdown(
      ['```ts', 'const answer = 42;', '```'].join('\n'),
    );

    expect(result.html).toContain('class="shiki');
    expect(result.html).toContain('answer');
  });

  it('falls back to plain text for an unknown language', async () => {
    // A typo in a fence info string must not be able to break a save.
    const result = await renderMarkdown(
      ['```notalanguage', 'x', '```'].join('\n'),
    );

    expect(result.html).toContain('<pre');
  });

  it('supports GitHub-flavoured tables', async () => {
    const result = await renderMarkdown(
      ['| a | b |', '| - | - |', '| 1 | 2 |'].join('\n'),
    );

    expect(result.html).toContain('<table>');
  });

  it('builds a plain-text excerpt from the prose only', async () => {
    const result = await renderMarkdown(
      ['## Heading', '', 'The first paragraph.', '', 'The second.'].join('\n'),
    );

    expect(result.excerpt).toBe('The first paragraph. The second.');
    expect(result.excerpt).not.toContain('Heading');
  });

  it('truncates a long excerpt with an ellipsis', async () => {
    const result = await renderMarkdown('word '.repeat(200), {
      excerptLength: 40,
    });

    expect(result.excerpt.length).toBeLessThanOrEqual(41);
    expect(result.excerpt.endsWith('…')).toBe(true);
  });
});

describe('estimateReadingMinutes', () => {
  it('never reports less than a minute', () => {
    expect(estimateReadingMinutes('short')).toBe(1);
    expect(estimateReadingMinutes('')).toBe(1);
  });

  it('scales with English word count', () => {
    // 220 words per minute; 660 words should read as about three minutes.
    expect(estimateReadingMinutes('word '.repeat(660))).toBe(3);
  });

  it('counts Chinese by character rather than by whitespace-delimited word', () => {
    // 900 characters at 450 per minute is two minutes. Counting "words" would
    // report this whole passage as one.
    expect(estimateReadingMinutes('中'.repeat(900))).toBe(2);
  });

  it('adds the two estimates for mixed text', () => {
    const mixed = `${'word '.repeat(220)}${'中'.repeat(450)}`;
    expect(estimateReadingMinutes(mixed)).toBe(2);
  });
});
