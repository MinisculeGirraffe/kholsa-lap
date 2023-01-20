# kholsa-lap

A Solver for a weighted bipartite matching problem best suited for asymettrical k-regular sparse graphs. 

The solver finds ε-optimal assignments of N persons to M objects, where N <= M.

Solver can be re-used for multiple problems by calling init() between calls to solve() to prevent re-allocation of memory.

If a perfect matching is not possible, a good matching is found in finite steps.

Algorithim implemented from https://arxiv.org/pdf/2101.07155.pdf.

## Time complexity:

    - Sparse K-regular Graph:
        O(N * K * (wMax - wMin) / ε)
    - Dense Graph:
        O(N ^ 2 * (wMax - wMin) / ε)

### Definitions:

    - N = number of persons
    - M = number of objects
    - K = number of objects per person
    - ε = the maximum difference between the value of the optimal assignment and the assignment found by the solver
    - wMin = the minimum weight of an edge in the graph
    - wMax = the maximum weight of an edge in the graph


