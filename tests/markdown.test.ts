import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../src/main/util/markdown'

describe('renderMarkdown', () => {
  it('экранирует HTML — сырой markup/скрипт не проходит', () => {
    const html = renderMarkdown('<script>alert(1)</script> <b>x</b>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;b&gt;')
  })

  it('заголовки, списки, код и жирный/курсив', () => {
    const html = renderMarkdown('# Title\n\n- one\n- two\n\n`code` **b** *i*')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<strong>b</strong>')
    expect(html).toContain('<em>i</em>')
  })

  it('fenced code block не интерпретирует markdown внутри', () => {
    const html = renderMarkdown('```\n# not a heading\n**not bold**\n```')
    expect(html).toContain('<pre><code>')
    expect(html).toContain('# not a heading')
    expect(html).not.toContain('<h1>')
    expect(html).not.toContain('<strong>')
  })

  it('ссылки: http(s) сохраняются, javascript: отбрасывается', () => {
    expect(renderMarkdown('[ok](https://skills.sh)')).toContain(
      '<a href="https://skills.sh" target="_blank" rel="noopener noreferrer">ok</a>'
    )
    // Небезопасная ссылка остаётся инертным текстом — кликабельный <a> не создаётся.
    const bad = renderMarkdown('[x](javascript:alert(1))')
    expect(bad).not.toContain('<a ')
    expect(bad).not.toContain('href=')
  })

  it('GFM-таблица рендерится в <table>', () => {
    const html = renderMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<thead><tr><th>A</th><th>B</th></tr></thead>')
    expect(html).toContain(
      '<tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody>'
    )
  })

  it('изображение → только alt (внешние ресурсы блокирует CSP)', () => {
    const html = renderMarkdown('![логотип](https://x/y.png)')
    expect(html).toContain('логотип')
    expect(html).not.toContain('<img')
  })

  it('YAML-фронтматтер рендерится как таблица key/value, а не как hr + текст', () => {
    const html = renderMarkdown('---\nname: my-skill\ndescription: "Does things"\n---\n\n# Title')
    expect(html).toContain('<table class="frontmatter">')
    expect(html).toContain('<th>name</th><td>my-skill</td>')
    // Кавычки со значения снимаются.
    expect(html).toContain('<th>description</th><td>Does things</td>')
    // Разделитель фронтматтера не превращается в <hr/>, а тело идёт следом.
    expect(html).not.toContain('<hr')
    expect(html).toContain('<h1>Title</h1>')
  })

  it('без фронтматтера ведущий --- остаётся горизонтальной линией', () => {
    const html = renderMarkdown('text\n\n---\n\nmore')
    expect(html).toContain('<hr />')
  })
})
