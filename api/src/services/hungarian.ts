/**
 * Jonker-Volgenant / Kuhn-Munkres minimum-cost assignment.
 *
 * Takes a 2D cost matrix and returns `assignment[i] = j` meaning
 * request i is matched to resource j, or -1 if i is unmatched.
 * Handles rectangular matrices (n requests × m resources) by padding
 * with a large sentinel. Runs in O(n³).
 */
const INF = 1e18;
const PAD = 1e15;

export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  const m = cost[0].length;
  const size = Math.max(n, m);

  // pad to square with large cost
  const c: number[][] = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i < n && j < m ? cost[i][j] : PAD))
  );

  const u = new Array(size + 1).fill(0);
  const v = new Array(size + 1).fill(0);
  const p = new Array(size + 1).fill(0);
  const way = new Array(size + 1).fill(0);

  for (let i = 1; i <= size; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(size + 1).fill(INF);
    const used = new Array(size + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = -1;
      for (let j = 1; j <= size; j++) {
        if (used[j]) continue;
        const cur = c[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= size; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else { minv[j] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const assign = new Array(n).fill(-1);
  for (let j = 1; j <= size; j++) {
    const i = p[j] - 1;
    if (i >= 0 && i < n && j - 1 < m && cost[i][j - 1] < PAD / 2) {
      assign[i] = j - 1;
    }
  }
  return assign;
}
