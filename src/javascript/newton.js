// Represents a complex number `a + bi` as an array `[a, b]`.
export const Complex = {
  add(a, b) {
    return [a[0] + b[0], a[1] + b[1]];
  },

  multiply(a, b) {
    return [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
  },
};

// Represents a complex polynomial `p0 + p1*x + p2*x^2 + ... + pn*x^n`
// as an array `[pn, ..., p2, p1, p0]`.
export const Poly = {
  add(p1, p2) {
    if (p1.length < p2.length) {
      let tmp = p1;
      p1 = p2;
      p2 = tmp;
    }
    // p1 is now at least as long as p2

    // Get the higher-order terms from p1 which aren't affected
    let p = p1.slice(0, p1.length - p2.length);
    p1 = p1.slice(p1.length - p2.length);

    // Sum the lower-order terms
    for (let i = 0; i < p1.length; i += 1) {
      p.push(Complex.add(p1[i], p2[i]));
    }

    return p;
  },

  multiply(p1, p2) {
    let p = [];

    for (let i = 0; i <= Math.max(p1.length, p2.length); i += 1) {
    // For every term in the result polynomial
      let term = [0, 0];

      for (let a = 0; a < p1.length; a += 1) {
        let b = i - a;
        if (b < 0) {
          break;
        } else if (b >= p2.length) {
          continue;
        }

        term = Complex.add(term, Complex.multiply(p1[a], p2[b]));
      }

      p.push(term);
    }

    return p;
  },
};

// We ultimately want to be able to compute `f(x)/f'(x)` on the GPU.
// If we constrain `f` to be a polynomial-like object, with roots `z_i` and
// complex multiplicities `m_i`, we can simplify to obtain a complex rational
// function. This process was informed by material at
//   http://www.chiark.greenend.org.uk/~sgtatham/newton/
// While the original formula called for `1/sum([m_i/(x - z_i)])`, that form runs
// afoul of numerical instability when `x` is close to a `z_i`. Instead, we
// algebraically manipulate this form to obtain the stable but more complicated
// `product([x - z_i]) / sum([m_i*product[j!=i](x - z_j)])`.
export function preprocessPolynomial(roots, multiplicities) {
  let numerator = [[1, 0]];
  for (let i = 0; i < roots.length; i += 1) {
    numerator = Poly.multiply(numerator, [[1, 0], Complex.multiply([-1, 0], roots[i])]);
  }

  let denominator = [[0, 0]];
  for (let i = 0; i < roots.length; i += 1) {
    let term = [multiplicities[i]];
    for (let j = 0; j < roots.length; j += 1) {
      if (j !== i) {
        term = Poly.multiply(term, [[1, 0], Complex.multiply([-1, 0], roots[j])]);
      }
    }
    denominator = Poly.add(denominator, term);
  }

  return {numerator, denominator};
}
