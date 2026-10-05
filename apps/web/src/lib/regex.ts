export interface RegexMatch {
  index: number
  text: string
  /** Numbered capture groups ($1, $2, …); undefined when the group did not participate */
  groups: (string | undefined)[]
}

export interface RegexResult {
  /** Name of each numbered group, undefined for unnamed ones */
  groupNames: (string | undefined)[]
  matches: RegexMatch[]
  /** More matches exist than were collected */
  truncated: boolean
  replaced?: string
  error?: string
}

export const MAX_MATCHES = 10_000

/** Runs a JavaScript RegExp over `text`. Without the `g` flag only the first match is returned, like `exec`. */
export function runRegex(pattern: string, flags: string, text: string, replacement?: string): RegexResult {
  let re: RegExp
  try {
    re = new RegExp(pattern, flags)
  } catch (e) {
    return { groupNames: [], matches: [], truncated: false, error: e instanceof Error ? e.message : String(e) }
  }
  const matches: RegexMatch[] = []
  let truncated = false
  const all = re.global ? text.matchAll(re) : [re.exec(text)].filter((m) => m !== null)
  for (const m of all) {
    if (matches.length === MAX_MATCHES) {
      truncated = true
      break
    }
    matches.push({ index: m.index, text: m[0], groups: m.slice(1) })
  }
  re.lastIndex = 0
  return {
    groupNames: groupNames(pattern),
    matches,
    truncated,
    replaced: replacement === undefined ? undefined : text.replace(re, replacement),
  }
}

/** Names of the capture groups of a (valid) pattern, in group-number order. */
export function groupNames(pattern: string): (string | undefined)[] {
  const names: (string | undefined)[] = []
  let inClass = false
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\') i++
    else if (c === '[') inClass = true
    else if (c === ']') inClass = false
    else if (c === '(' && !inClass) {
      if (pattern[i + 1] !== '?') names.push(undefined)
      else if (pattern[i + 2] === '<' && /[^=!]/.test(pattern[i + 3] ?? ''))
        names.push(/^\(\?<([^>]+)>/.exec(pattern.slice(i))?.[1])
    }
  }
  return names
}
