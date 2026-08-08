import { toText } from 'hast-util-to-text'
import { createLowlight } from 'lowlight'
import { visit } from 'unist-util-visit'
import type { Element, ElementContent, Root } from 'hast'
import type { LanguageFn } from 'highlight.js'
import type { VFile } from 'vfile'

function languageOf(node: Element): string | undefined {
  const list = node.properties?.className
  if (!Array.isArray(list)) return undefined
  for (const entry of list) {
    const value = String(entry)
    if (value.startsWith('language-')) return value.slice('language-'.length)
    if (value.startsWith('lang-')) return value.slice('lang-'.length)
  }
  return undefined
}

/**
 * Same behavior as `rehype-highlight`, but built on an empty `lowlight`
 * instance registered with only the given languages — no unconditional
 * bundling of lowlight's full "common" language set.
 */
export function createCuratedHighlighter(languages: Record<string, LanguageFn>) {
  const lowlight = createLowlight(languages)

  return function rehypeHighlightCurated() {
    return function transform(tree: Root, file: VFile) {
      visit(tree, 'element', (node, _index, parent) => {
        if (
          node.tagName !== 'code' ||
          !parent ||
          parent.type !== 'element' ||
          parent.tagName !== 'pre'
        ) {
          return
        }

        const lang = languageOf(node)
        if (!Array.isArray(node.properties.className)) {
          node.properties.className = []
        }
        if (!node.properties.className.includes('hljs')) {
          node.properties.className.unshift('hljs')
        }

        const text = toText(node, { whitespace: 'pre' })
        let result
        try {
          result = lang ? lowlight.highlight(lang, text) : lowlight.highlightAuto(text)
        } catch (error) {
          const cause = error as Error
          if (lang && /Unknown language/.test(cause.message)) {
            file.message(`Cannot highlight as \`${lang}\`, it's not registered`, {
              ancestors: [parent, node],
              cause,
              place: node.position,
              ruleId: 'missing-language',
              source: 'rehype-highlight-curated',
            })
            return
          }
          throw cause
        }

        if (!lang && result.data && result.data.language) {
          ;(node.properties.className as string[]).push(`language-${result.data.language}`)
        }
        if (result.children.length > 0) {
          node.children = result.children as ElementContent[]
        }
      })
    }
  }
}
