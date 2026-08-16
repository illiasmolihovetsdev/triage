export const getQueryStringValue = (
  queryValue: string | string[] | undefined
): string | undefined =>
  typeof queryValue === 'string' && queryValue.length > 0
    ? queryValue
    : undefined

export const getPageNumber = (
  pageQueryValue: string | string[] | undefined
): number | undefined => {
  const pageToken = getQueryStringValue(pageQueryValue)

  if (!pageToken) {
    return undefined
  }

  const parsedPageNumber = Number.parseInt(pageToken, 10)

  if (!Number.isInteger(parsedPageNumber) || parsedPageNumber < 1) {
    return undefined
  }

  return parsedPageNumber
}

export const getCurrentQueuePage = (
  cursorToken: string | undefined,
  beforeToken: string | undefined,
  pageQueryValue: string | string[] | undefined
): number => {
  if (!cursorToken && !beforeToken) {
    return 1
  }

  const parsedPageNumber = getPageNumber(pageQueryValue)

  if (parsedPageNumber !== undefined && parsedPageNumber >= 2) {
    return parsedPageNumber
  }

  return 2
}
