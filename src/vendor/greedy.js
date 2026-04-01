const GLASS = 2

module.exports = function GreedyMesh(volume) {
  function f(i, j, k) {
    // console.log(i, j, k, dims)

    if ((i >= 0) && (i < dims[0]) && (j >= 0) && (j < dims[1]) && (k >= 0) && (k < dims[2])) {
      let r = volume.get(i, j, k) || 0

      if (r == GLASS) {
        return 0
      }

      return r
    } else {
      // console.log('DENIED')
      return 0
    }
  }

  let dims = volume.shape
  // console.log('dims', dims)

  //Sweep over 3-axes
  var quads = []
  for (var d = 0; d < 3; ++d) {
    var i, j, k, l, w, h
      , u = (d + 1) % 3
      , v = (d + 2) % 3
      , x = [0, 0, 0]
      , q = [0, 0, 0]
      , mask = new Int32Array(dims[u] * dims[v])
    // , facing = new Int32Array(dims[u] * dims[v])

    q[d] = 1

    // console.log('sweep dimension ' + d)

    for (x[d] = -1; x[d] < dims[d];) {

      //Compute mask
      var n = 0
      for (x[v] = 0; x[v] < dims[v]; ++x[v])
        for (x[u] = 0; x[u] < dims[u]; ++x[u]) {

          let a = f(x[0], x[1], x[2])
          let b = f(x[0] + q[0], x[1] + q[1], x[2] + q[2])

          if (a != b && (a == 0 || b == 0)) {
            mask[n] = a == 0 ? b : -a
          }

          // mask[n] = (a == 0 || b == 0) && a != b
          // (0    <= x[d]      ? a      : false) !=
          // (x[d] <  dims[d]-1 ?  : false);

          // if (mask[n]) {
          // console.log(x[0], x[1], x[2], a, '=>', x[0] + q[0], x[1] + q[1], x[2] + q[2], b)
          // }

          // facing[n] =
          //   (a != 0 ? 1 : 0) - (b != 0 ? 1 : 0)

          // if (mask[n] && x[d] == -1) {
          //   facing[n] = -facing[n]
          // }

          // // one weird hack for the y axis
          // if (d != 1) {
          //   facing[n] = -facing[n]
          // }

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
            for (w = 1; (mask[n + w] === c) && i + w < dims[u]; ++w) {
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
            var du = [0, 0, 0]
            du[u] = w
            var dv = [0, 0, 0]
            dv[v] = h

            // let frontFace = c > 0 // Math.random() < 0.5 ? true : false

            //Zero-out mask
            for (l = 0; l < h; ++l)
              for (k = 0; k < w; ++k) {
                mask[n + k + l * dims[u]] = false
              }

            // One weird hack for the y dimension, programmers HATE him
            if (d == 1) {
              c = -c
            }

            quads.push([
              [x[0], x[1], x[2]]
              , [x[0] + du[0], x[1] + du[1], x[2] + du[2]]
              , [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]]
              , [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]],
              c
            ])

            //Increment counters and continue
            i += w
            n += w
          } else {
            ++i
            ++n
          }
        }
    }
  }
  return quads
}
