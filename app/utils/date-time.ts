import { format } from 'date-fns'

export function formatDate(date: string | undefined, formatString: string) : string {
  if (date === undefined) {
    return 'N/A'
  }

  return format(date, formatString)
}
