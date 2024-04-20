export type Budget = {
  categoryId: string | undefined;
  amount: number;
  rollover?: boolean;
  rolloverAmount?: number;
}
