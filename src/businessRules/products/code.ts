import { randomUUID } from 'node:crypto'

export function productCode() {
  return `OBJ-${randomUUID().slice(0, 8).toUpperCase()}`
}
