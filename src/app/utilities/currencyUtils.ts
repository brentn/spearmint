export class Currency {
  static sum(addends: (number | undefined)[]): number {
    if (addends.length === 0) return 0;
    if (addends.length === 1) return addends[0] || 0;
    return addends.reduce((a: number, b: number | undefined) => Math.round((a + (b || 0)) * 100) / 100, 0);
  }

  static round(float: number): number {
    return Math.round(float * 100) / 100;
  }

}
