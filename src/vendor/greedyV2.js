'use strict'
// this is copied from the tsc output from Lightmapper. 
// Refer to the lightmapper repo for the definitive version
const GLASS = 2

function GreedyMesh(volume) {
  function f(i, j, k) {
    if (i >= 0 && i < dims[0] && j >= 0 && j < dims[1] && k >= 0 && k < dims[2]) {
      const r = volume.get(i, j, k) || 0
      if (r == GLASS) {
        return 0
      }
      return r
    } else {
      // console.log('DENIED')
      return 0
    }
  }

  const dims = volume.shape
  //Sweep over 3-axes
  const result = []
  for (let d = 0; d < 3; ++d) {
    let i, j, k, l, w, h, u = (d + 1) % 3, v = (d + 2) % 3, x = [0, 0, 0], q = [0, 0, 0], mask = new Int32Array(dims[u] * dims[v])
    q[d] = 1
    for (x[d] = -1; x[d] < dims[d];) {
      const quadsPerSwatch = []
      //Compute mask
      let n = 0
      for (x[v] = 0; x[v] < dims[v]; ++x[v])
        for (x[u] = 0; x[u] < dims[u]; ++x[u]) {
          let a = f(x[0], x[1], x[2])
          let b = f(x[0] + q[0], x[1] + q[1], x[2] + q[2])
          if (a != b && (a == 0 || b == 0)) {
            mask[n] = a == 0 ? b : -a
          }
          n++
        }
      //Increment x[d]
      ++x[d]
      //Generate mesh for mask using lexicographic ordering
      n = 0
      for (j = 0; j < dims[v]; ++j)
        for (i = 0; i < dims[u];) {
          if (mask[n]) {
            let c = mask[n]
            //Compute width
            for (w = 1; mask[n + w] === c && i + w < dims[u]; ++w) {
            }
            //Compute height (this is slightly awkward
            var done = false
            for (h = 1; j + h < dims[v]; ++h) {
              for (k = 0; k < w; ++k) {
                if (c !== mask[n + k + h * dims[u]]) {
                  done = true
                  break
                }
              }
              if (done) {
                break
              }
            }
            //Add quad
            x[u] = i
            x[v] = j
            const du = [0, 0, 0]
            du[u] = w
            const dv = [0, 0, 0]
            dv[v] = h
            // let frontFace = c > 0 // Math.random() < 0.5 ? true : false
            //Zero-out mask
            for (l = 0; l < h; ++l)
              for (k = 0; k < w; ++k) {
                mask[n + k + l * dims[u]] = 0 //(false as unknown) as number // wouldnt setting this to 0 be betterer?
              }
            // One weird hack for the y dimension, programmers HATE him
            if (d == 1) {
              c = -c
            }
            quadsPerSwatch.push([[x[0], x[1], x[2]], [x[0] + du[0], x[1] + du[1], x[2] + du[2]], [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]], [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]], c])
            //Increment counters and continue
            i += w
            n += w
          } else {
            ++i
            ++n
          }
        }
      if (quadsPerSwatch.length > 0) {
        result.push(quadsPerSwatch)
      }
    }
  }
  return result
}

module.exports = GreedyMesh