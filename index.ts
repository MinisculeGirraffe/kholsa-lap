export class Solver {
  num_rows: number
  num_cols: number
  #i_starts_stops: number[]
  #j_counts: number[]
  #column_indices: number[]
  #prices: number[]
  #values: number[]
  #ustack: number[]

  constructor () {
    this.num_rows = 0
    this.num_cols = 0
    this.#i_starts_stops = new Array<number>()
    this.#j_counts = new Array<number>()
    this.#prices = new Array<number>()
    this.#column_indices = new Array<number>()
    this.#values = new Array<number>()
    this.#ustack = new Array<number>()
  }

  #positive_values (): boolean {
    const value = this.#values[0] === undefined ? 0 : this.#values[0]
    return value >= 0
  }

  // Adds a single value to the internal cost matrix
  add_value (row: number, column: number, value: number): void {
    const currentRow = this.#j_counts.length - 1
    if (row !== currentRow || row !== currentRow + 1) {
      throw new Error('rows must be added in order')
    }
    // todo check the addition overflow
    const cumalitiveOffset = this.#i_starts_stops[currentRow + 1] + 1

    if (row > currentRow) {
      if (this.#j_counts[currentRow] === 0) {
        throw new Error('row must have at least one column')
      }

      this.#i_starts_stops.push(cumalitiveOffset)
      this.#j_counts.push(1)
    } else {
      this.#i_starts_stops[currentRow + 1] = cumalitiveOffset
      this.#j_counts[currentRow] += 1
    }
    this.#column_indices.push(column)
    this.#values.push(value)
  }

  // extends the internal cost matrix by adding the given row, and adding the given columns, and the corresponding values
  extend_from_value (row: number, columns: number[], values: number[]): void {
    // Check that the given row is valid.  It should be either the next row,
    // or the row after the last row.
    if (columns.length !== values.length) {
      throw new Error('columns and values must have the same length')
    }

    const currentRow = this.#j_counts.length - 1
    if (row !== currentRow && row !== currentRow + 1) {
      throw new Error('rows must be added in order')
    }

    // Compute the length of the new row, and the offset of the new row.
    const lengthIncrement = columns.length
    const cumalitiveOffset = this.#i_starts_stops[currentRow] + lengthIncrement

    // Add a new row if the given row is the next row, otherwise
    // update the current row.
    if (row > currentRow) {
      // Check that the current row has at least one column.
      if (this.#j_counts[currentRow] === 0) {
        throw new Error('row must have at least one column')
      }

      // Add the new row.
      this.#i_starts_stops.push(cumalitiveOffset)
      this.#j_counts.push(lengthIncrement)
    } else {
      // Update the current row.
      this.#i_starts_stops[currentRow + 1] = cumalitiveOffset
      this.#j_counts[currentRow] += lengthIncrement
    }

    // Add the given columns and values to the list of columns and values.
    this.#column_indices.push(...columns)
    this.#values.push(...values)
  }

  // Get the total cost of a solution from the internal cost matrix
  // Does not mutate the solution.
  get_costs (solution: Solution): number {
    const positiveValues = this.#positive_values()

    let objective = 0
    for (let i = 0; i < this.num_rows; i++) {
      const j = solution.person_to_object[i]
      if (j === Number.MAX_VALUE) {
        continue
      }

      const numObjects = this.#j_counts[i]
      const start = this.#i_starts_stops[i]
      for (let k = 0; k < numObjects; k++) {
        const index = start + k
        const l = this.#column_indices[index]
        if (l === j) {
          if (positiveValues) {
            objective += this.#values[index]
          } else {
            objective -= this.#values[index]
          }
        }
      }
    }
    return objective
  }

  // Resets the solver to a default state.
  // Must be called before the solver can be used and in-between calls to solve.
  init (rows: number, cols: number): void {
    this.num_rows = rows
    this.num_cols = cols

    resize(this.#i_starts_stops, 2, 0)

    this.#j_counts.length = 0
    this.#j_counts.push(0)

    this.#column_indices.length = 0
  }

  // Resets a solution object to a default state.
  #init_solve (solution: Solution, maximize: boolean): void {
    const positiveValues = this.#positive_values()
    // Javascript doesn't have a logical xor operato. big sad moments
    if (maximize !== positiveValues) {
      // flip the sign of all values
      for (let i = 0; i < this.#values.length; i++) {
        this.#values[i] = -this.#values[i]
      }
    }

    // The prices are the amounts that are added to each element
    // of the matrix to create a modified matrix.
    // The prices are initially zero.
    this.#prices.length = 0
    resize(this.#prices, this.num_cols, 0)

    // The solution.person_to_object array contains the
    // column index for each row that is assigned to an object.
    // Initially, no rows are assigned to an object.
    solution.person_to_object.length = 0
    resize(solution.person_to_object, this.num_rows, Number.MAX_VALUE)

    // The solution.object_to_person array contains the
    // row index for each column that is assigned to a person.
    // Initially, no columns are assigned to a person.
    solution.object_to_person.length = 0
    resize(solution.object_to_person, this.num_cols, Number.MAX_VALUE)

    // The number of rows that are not assigned to an object.
    // Initially, all rows are not assigned to an object.
    solution.unassigned = this.num_rows

    // The unassigned rows are stored in a stack in reverse order
    this.#ustack.length = 0
    for (let i = this.num_rows; (i--) !== 0;) {
      this.#ustack.push(i)
    }
  }

  validate_inputs (): void {
    const arcs = this.#column_indices.length
    if (arcs === 0 || arcs === Number.MAX_VALUE || arcs !== this.#values.length) {
      throw new Error('invalid arc count')
    }

    if (this.num_rows === 0 || this.num_rows === Number.MAX_VALUE) {
      throw new Error('invalid row or col count')
    }
  }

  solve (solution: Solution, maximize: boolean, epsilon = 1 / this.num_cols): void {
    this.validate_inputs()
    this.#init_solve(solution, maximize)

    // Update the epsilon value in the solution object.
    solution.epsilon = epsilon

    const [wMin, wMax] = this.#values.reduce(([min, max]: [number, number], el) =>
      [
        // If min is less than element, return min, else return element
        min < el ? min : el,
        // If max is greater than element, return max, else return element
        max > el ? max : el
      ]
    // Set inital values to the largest and smallest possible numbers
    , [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])
    // console.log(w_min, w_max);
    const priceThreshold = (this.num_cols / 2) * (wMax - wMin + epsilon)

    // while the number of unassigned rows is greater than zero
    while (this.#ustack.length > 0) {
      // Get the next unassigned row.
      const u = this.#ustack.pop()
      if (u === undefined) { break }

      solution.iterations += 1

      const start = this.#i_starts_stops[u]
      const numObjects = this.#j_counts[u]

      // initalize variables to default values
      let maxProfit = Number.NEGATIVE_INFINITY
      let secondMaxProfit = Number.NEGATIVE_INFINITY
      let maxEdgeValue = Number.NEGATIVE_INFINITY
      let matchedVertex = 0

      // For each column in the block, calculate the profit of the edge in that column.
      // A column is a potential match if its profit is greater than the profit ofthe current best match and greater than the profit of the second best match.
      for (let i = 0; i < numObjects; i++) {
        // Global index of the column in the block
        const globalIndex = start + i
        const j = this.#column_indices[globalIndex]
        // The value of the edge in the column
        const edgeValue = this.#values[globalIndex]
        // The profit of matching the edge in the column
        const profit = edgeValue - this.#prices[j]
        if (profit > maxProfit) {
          // The new best matched vertex
          matchedVertex = j
          // The old best match is now the second best
          secondMaxProfit = maxProfit
          // The new best match has the new best profit
          maxProfit = profit
          // The value of the edge in the new best match
          maxEdgeValue = edgeValue
        } else if (profit > secondMaxProfit) {
          // The new second best match
          secondMaxProfit = profit
        }
      }

      // if the matched vertex is above the price threshold, then it is not a match
      if (this.#prices[matchedVertex] > priceThreshold) {
        continue
      }

      if (Number.isFinite(secondMaxProfit)) {
        // Update the price of v to be one below the second max profit.
        this.#prices[matchedVertex] = maxEdgeValue - secondMaxProfit
      } else {
        // Otherwise, increment the price of v by epsilon.
        this.#prices[matchedVertex] += epsilon
      }

      // if the vertex was assigned to a person, then move that person out of the solution.
      const movedOut = solution.object_to_person[matchedVertex]
      if (movedOut !== Number.MAX_VALUE) {
        solution.person_to_object[movedOut] = Number.MAX_VALUE
        solution.unassigned += 1
        // Add u back to the stack of unassigned people.
        this.#ustack.push(movedOut)
      }
      // assign the matched vertex from the top of the stack.
      solution.person_to_object[u] = matchedVertex
      solution.object_to_person[matchedVertex] = u
      solution.unassigned -= 1
    }
  }
}

// resizes an array in place to a new size, filling any new slots with the default value
function resize<T> (arr: T[], newSize: number, defaultValue: T): void {
  // calculate the difference between the array length and the new size
  let delta = arr.length - newSize

  if (delta > 0) {
    // if the array length is greater than the new size, trim the array
    arr.length = newSize
  } else {
    // otherwise, fill the difference to the array with the default value
    while (delta++ < 0) { arr.push(defaultValue) }
  }
}

export class Solution {
  person_to_object: number[]
  object_to_person: number[]
  unassigned: number
  epsilon: number
  iterations: number

  constructor (rowCapacity: number, colCapacity: number) {
    this.person_to_object = new Array<number>(rowCapacity)
    this.object_to_person = new Array<number>(colCapacity)
    this.unassigned = Number.MAX_VALUE
    this.epsilon = Number.NaN
    this.iterations = 0
  }
}
