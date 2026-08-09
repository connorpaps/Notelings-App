import { findPath, type BlockedSet, type GridCell } from './pathfinding'

export function pickWanderCell(
  current: GridCell,
  blocked: BlockedSet,
  options: {
    cols: number
    rows: number
    random?: () => number
    attempts?: number
  },
): GridCell | null {
  const random = options.random ?? Math.random
  const attempts = Math.max(1, options.attempts ?? 24)
  const isValid = (cell: GridCell) =>
    cell[0] >= 0 &&
    cell[0] < options.cols &&
    cell[1] >= 0 &&
    cell[1] < options.rows &&
    (cell[0] !== current[0] || cell[1] !== current[1]) &&
    !blocked.has(`${cell[0]},${cell[1]}`) &&
    findPath(current, cell, { blocked, cols: options.cols, rows: options.rows }) !== null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate: GridCell = [
      Math.floor(Math.min(0.999999, Math.max(0, random())) * options.cols),
      Math.floor(Math.min(0.999999, Math.max(0, random())) * options.rows),
    ]
    if (isValid(candidate)) return candidate
  }

  for (let col = 0; col < options.cols; col += 1) {
    for (let row = 0; row < options.rows; row += 1) {
      const candidate: GridCell = [col, row]
      if (isValid(candidate)) return candidate
    }
  }
  return null
}
