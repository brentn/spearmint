import { Currency } from "./currencyUtils";

describe('Currency utilities', () => {
  describe('sum()', () => {
    it('adds all the numbers in a list', () => {
      expect(Currency.sum([1, 2, 3])).toBe(6);
    });
    it('treats undefined entries as 0', () => {
      expect(Currency.sum([1, undefined, 3])).toBe(4);
    });
    it('does proper floating point math', () => {
      expect(Currency.sum([0.1, 0.2, 0.3])).toBe(0.6);
    });
    it('rounds numbers that are more than 2 decimal places', () => {
      expect(Currency.sum([.101, .206])).toBe(0.31);
    })
  });
});
