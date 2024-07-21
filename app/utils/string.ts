export function localeIncludes(source: string, search: string) {
  const collator = new Intl.Collator(undefined, {
    sensitivity: 'base',
    usage: 'search'
  })

  const sourceLength = source.length
  const searchLength = search.length
  const lengthDiff = sourceLength - searchLength

  if (lengthDiff < 0) {
    return false;
  }

  if (lengthDiff === 0) {
    return collator.compare(source, search) === 0
  }

  for (let index = 0; index <= lengthDiff; index++) {
    const subString = source.substring(index, index + searchLength)
    const isEquals = collator.compare(subString, search) === 0

    if (isEquals) {
      return true
    }
  }

  return false;
};
