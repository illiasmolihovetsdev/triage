export interface QueueCursor {
  createdAt: Date
  id: string
}

const CURSOR_FIELD_SEPARATOR = '\t'

export const encodeQueueCursor = (cursor: QueueCursor): string => {
  const createdAtIso = cursor.createdAt.toISOString()
  return Buffer.from(
    `${createdAtIso}${CURSOR_FIELD_SEPARATOR}${cursor.id}`,
    'utf8'
  ).toString('base64url')
}

export const decodeQueueCursor = (cursorToken: string): QueueCursor | null => {
  try {
    const decoded = Buffer.from(cursorToken, 'base64url').toString('utf8')
    const separatorIndex = decoded.indexOf(CURSOR_FIELD_SEPARATOR)

    if (separatorIndex <= 0) {
      return null
    }

    const createdAtIso = decoded.slice(0, separatorIndex)
    const id = decoded.slice(separatorIndex + 1)
    const createdAt = new Date(createdAtIso)

    if (id.length === 0 || Number.isNaN(createdAt.getTime())) {
      return null
    }

    if (createdAt.toISOString() !== createdAtIso) {
      return null
    }

    return { createdAt, id }
  } catch {
    return null
  }
}

export const getQueuePageWindow = <RecordType>(
  recordList: RecordType[],
  pageSize: number
): { pageRecordList: RecordType[]; hasNextPage: boolean } => {
  const hasNextPage = recordList.length > pageSize

  return {
    pageRecordList: hasNextPage ? recordList.slice(0, pageSize) : recordList,
    hasNextPage,
  }
}
