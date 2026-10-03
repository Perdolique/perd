/** Suggests a canonical slug until the user starts editing it. */
function suggestReferenceDataSlug(name: string, maximumLength: number): string {
  const expansions = new Map([
    ['æ', 'ae'], ['œ', 'oe'], ['ß', 'ss'], ['ø', 'o'], ['ł', 'l'], ['đ', 'd'], ['ð', 'd'], ['þ', 'th']
  ])

  const expanded = name.replaceAll(/[æœßøłđðþ]/giu, (character) => {
    const lowercase = character.toLowerCase()

    return expansions.get(lowercase) ?? character
  })

  const normalized = expanded.normalize('NFKD')
  const withoutMarks = normalized.replaceAll(/\p{M}/gu, '')
  const lowercase = withoutMarks.toLowerCase()
  const separated = lowercase.replaceAll(/[^a-z0-9]+/gu, '-')
  const trimmed = separated.replaceAll(/^-|-$/gu, '')
  const truncated = trimmed.slice(0, maximumLength)

  return truncated.replaceAll(/-$/gu, '')
}

export { suggestReferenceDataSlug }
