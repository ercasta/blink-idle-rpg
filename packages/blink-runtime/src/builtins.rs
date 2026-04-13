/// Built-in functions available to all BRL programs.
/// These are called directly from generated Rust code.

/// Minimum of two values.
#[inline]
pub fn brl_min(a: f64, b: f64) -> f64 {
    a.min(b)
}

/// Maximum of two values.
#[inline]
pub fn brl_max(a: f64, b: f64) -> f64 {
    a.max(b)
}

/// Floor of a number.
#[inline]
pub fn brl_floor(a: f64) -> f64 {
    a.floor()
}

/// Ceiling of a number.
#[inline]
pub fn brl_ceil(a: f64) -> f64 {
    a.ceil()
}

/// Round a number to the nearest integer.
#[inline]
pub fn brl_round(a: f64) -> f64 {
    a.round()
}

/// Absolute value.
#[inline]
pub fn brl_abs(a: f64) -> f64 {
    a.abs()
}

/// Square root.
#[inline]
pub fn brl_sqrt(a: f64) -> f64 {
    a.sqrt()
}

/// Natural logarithm (base e).
#[inline]
pub fn brl_log(a: f64) -> f64 {
    a.ln()
}

/// Deterministic pseudo-random number generator.
/// Uses xoshiro256** for reproducibility across JS and WASM engines.
pub struct Rng {
    state: [u64; 4],
}

impl Rng {
    /// Create a new RNG with the given seed.
    pub fn new(seed: u64) -> Self {
        // SplitMix64 to initialize the state from a single seed
        let mut s = seed;
        let mut state = [0u64; 4];
        for item in &mut state {
            s = s.wrapping_add(0x9e3779b97f4a7c15);
            let mut z = s;
            z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
            z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
            *item = z ^ (z >> 31);
        }
        Rng { state }
    }

    /// Generate a random f64 in [0, 1).
    pub fn random(&mut self) -> f64 {
        let result = self.next_u64();
        // Convert to f64 in [0, 1)
        (result >> 11) as f64 / (1u64 << 53) as f64
    }

    /// Generate a random f64 in [min, max).
    pub fn random_range(&mut self, min: f64, max: f64) -> f64 {
        min + self.random() * (max - min)
    }

    /// Generate a random integer in [min, max] (inclusive).
    pub fn random_int_range(&mut self, min: i64, max: i64) -> i64 {
        if min >= max {
            return min;
        }
        let range = (max - min + 1) as u64;
        let result = self.next_u64() % range;
        min + result as i64
    }

    /// xoshiro256** next
    fn next_u64(&mut self) -> u64 {
        let result = self.state[1].wrapping_mul(5).rotate_left(7).wrapping_mul(9);
        let t = self.state[1] << 17;
        self.state[2] ^= self.state[0];
        self.state[3] ^= self.state[1];
        self.state[1] ^= self.state[2];
        self.state[0] ^= self.state[3];
        self.state[2] ^= t;
        self.state[3] = self.state[3].rotate_left(45);
        result
    }
}

impl Default for Rng {
    fn default() -> Self {
        Self::new(42)
    }
}

/// Length of a list (as Value::List).
#[inline]
pub fn brl_len(list: &[crate::value::Value]) -> i64 {
    list.len() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_min_max() {
        assert_eq!(brl_min(3.0, 5.0), 3.0);
        assert_eq!(brl_max(3.0, 5.0), 5.0);
    }

    #[test]
    fn test_floor_ceil_round() {
        assert_eq!(brl_floor(3.7), 3.0);
        assert_eq!(brl_ceil(3.2), 4.0);
        assert_eq!(brl_round(3.5), 4.0);
        assert_eq!(brl_round(3.4), 3.0);
    }

    #[test]
    fn test_abs() {
        assert_eq!(brl_abs(-5.0), 5.0);
        assert_eq!(brl_abs(5.0), 5.0);
    }

    #[test]
    fn test_sqrt() {
        assert_eq!(brl_sqrt(9.0), 3.0);
        assert_eq!(brl_sqrt(0.0), 0.0);
        assert_eq!(brl_sqrt(1.0), 1.0);
        assert!((brl_sqrt(2.0) - std::f64::consts::SQRT_2).abs() < 1e-10);
    }

    #[test]
    fn test_log() {
        assert_eq!(brl_log(1.0), 0.0);
        assert!((brl_log(std::f64::consts::E) - 1.0).abs() < 1e-10);
        assert!((brl_log(10.0) - 10.0_f64.ln()).abs() < 1e-10);
    }

    #[test]
    fn test_rng_determinism() {
        let mut rng1 = Rng::new(12345);
        let mut rng2 = Rng::new(12345);

        for _ in 0..100 {
            assert_eq!(rng1.random().to_bits(), rng2.random().to_bits());
        }
    }

    #[test]
    fn test_rng_range() {
        let mut rng = Rng::new(42);
        for _ in 0..100 {
            let v = rng.random();
            assert!((0.0..1.0).contains(&v));
        }
        for _ in 0..100 {
            let v = rng.random_range(10.0, 20.0);
            assert!((10.0..20.0).contains(&v));
        }
    }

    #[test]
    fn test_rng_int_range() {
        let mut rng = Rng::new(42);
        for _ in 0..100 {
            let v = rng.random_int_range(1, 6);
            assert!((1..=6).contains(&v));
        }
    }
}
