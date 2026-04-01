import * as v from 'valibot'

const nonEmptyStringSchema = v.pipe(
  v.string(),
  v.nonEmpty()
)

export { nonEmptyStringSchema }
