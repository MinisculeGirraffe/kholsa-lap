import { expect, test } from '@jest/globals'
import { Solution, Solver } from './index'

test('Solve Basic Sparse', () => {
  const weights = [
    [10, 6, 14, 1],
    [17, 18, 16]
  ]

  const numRows = weights.length
  const numCols = weights[0].length

  const solver = new Solver()
  solver.init(numRows, numCols)

  const solution = new Solution(numRows, numCols)

  for (let i = 0; i < weights.length; i++) {
    const rowRef = weights[i]
    console.log(rowRef)
    const jIndicies = [...Array(rowRef.length).keys()]
    solver.extend_from_value(i, jIndicies, rowRef)
  }

  solver.solve(solution, false)

  expect(solution.person_to_object).toEqual([3, 2])
  expect(solution.object_to_person).toEqual([Number.MAX_VALUE, Number.MAX_VALUE, 1, 0])

  const totalCost = solver.get_costs(solution)
  expect(totalCost).toEqual(1 + 16)
})
