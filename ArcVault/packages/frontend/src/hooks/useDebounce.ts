import { useState, useEffect } from 'react';

/**
 * Debounce a value by the given delay (in ms).
 * Returns the debounced value and cleans up the timer on unmount / value change.
 *
 * @example
 * const debouncedAmount = useDebounce(amount, 500);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
