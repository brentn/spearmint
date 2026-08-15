import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, isDevMode, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * PROTOTYPE — throwaway (issue #21). Three layout options for the Budgets screen's cash-flow
 * box: how "budgeted income"/"budgeted expenses" bars sit next to the existing Earned/Spent
 * bars, and how the unbudgeted-actual overage renders as a dotted extension. Switch with
 * ?variant=A|B|C on /budgets. Delete this whole directory once a variant is chosen, and fold
 * the winner into budgets.html/budgets.ts/budgets.scss properly.
 */

export interface CashFlowProtoData {
  earned: number;
  spent: number;
  budgetedIncome: number;
  budgetedExpenses: number;
}

const CAP_HEIGHT_PX = 70;

/** Bar height in px, scaled against whichever value in this variant's set is largest. */
function scaleHeight(value: number, max: number): number {
  if (value <= 0) {
    return 0;
  }
  return Math.max((value / Math.max(max, 1)) * CAP_HEIGHT_PX, 4);
}

// ---------- Variant A: Earned, Spent, Budgeted Income, Budgeted Expenses (4 bars) ----------

@Component({
  selector: 'app-cash-flow-variant-a',
  imports: [DecimalPipe],
  template: `
    <div class="cfp-bars">
      <div class="cfp-group">
        <div class="cfp-stack">
          <div class="cfp-bar cfp-bar--income" [style.height.px]="h(data().earned)"></div>
        </div>
        <div class="cfp-caption"><span>Earned</span><strong>\${{ data().earned | number: '1.0-0' }}</strong></div>
      </div>
      <div class="cfp-group">
        <div class="cfp-stack">
          <div class="cfp-bar cfp-bar--expense" [style.height.px]="h(data().spent)"></div>
        </div>
        <div class="cfp-caption"><span>Spent</span><strong>\${{ data().spent | number: '1.0-0' }}</strong></div>
      </div>
      <div class="cfp-group cfp-group--gap">
        <div class="cfp-stack">
          <div class="cfp-bar cfp-bar--income-dotted" [style.height.px]="h(incomeOverageH())"></div>
          <div class="cfp-bar cfp-bar--income-ghost" [style.height.px]="h(data().budgetedIncome)"></div>
        </div>
        <div class="cfp-caption">
          <span>Budgeted income</span><strong>\${{ data().budgetedIncome | number: '1.0-0' }}</strong>
        </div>
      </div>
      <div class="cfp-group">
        <div class="cfp-stack">
          <div class="cfp-bar cfp-bar--expense-dotted" [style.height.px]="h(expenseOverageH())"></div>
          <div class="cfp-bar cfp-bar--expense-ghost" [style.height.px]="h(data().budgetedExpenses)"></div>
        </div>
        <div class="cfp-caption">
          <span>Budgeted expenses</span><strong>\${{ data().budgetedExpenses | number: '1.0-0' }}</strong>
        </div>
      </div>
    </div>
  `,
  styles: [cashFlowProtoStyles()],
})
export class CashFlowVariantA {
  readonly data = input.required<CashFlowProtoData>();

  private readonly max = computed(() => {
    const d = this.data();
    return Math.max(d.earned, d.spent, d.budgetedIncome, d.budgetedExpenses, 1);
  });

  protected readonly incomeOverageH = computed(() => Math.max(0, this.data().earned - this.data().budgetedIncome));
  protected readonly expenseOverageH = computed(() => Math.max(0, this.data().spent - this.data().budgetedExpenses));

  protected h(value: number): number {
    return scaleHeight(value, this.max());
  }
}

// ---------- Variant B: paired — Earned+Budgeted Income, then Spent+Budgeted Expenses ----------

@Component({
  selector: 'app-cash-flow-variant-b',
  imports: [DecimalPipe],
  template: `
    <div class="cfp-bars">
      <div class="cfp-pair">
        <div class="cfp-group">
          <div class="cfp-stack">
            <div class="cfp-bar cfp-bar--income" [style.height.px]="h(data().earned)"></div>
          </div>
          <div class="cfp-caption"><span>Earned</span><strong>\${{ data().earned | number: '1.0-0' }}</strong></div>
        </div>
        <div class="cfp-group">
          <div class="cfp-stack">
            <div class="cfp-bar cfp-bar--income-dotted" [style.height.px]="h(incomeOverageH())"></div>
            <div class="cfp-bar cfp-bar--income-ghost" [style.height.px]="h(data().budgetedIncome)"></div>
          </div>
          <div class="cfp-caption">
            <span>Budgeted</span><strong>\${{ data().budgetedIncome | number: '1.0-0' }}</strong>
          </div>
        </div>
      </div>
      <div class="cfp-pair">
        <div class="cfp-group">
          <div class="cfp-stack">
            <div class="cfp-bar cfp-bar--expense" [style.height.px]="h(data().spent)"></div>
          </div>
          <div class="cfp-caption"><span>Spent</span><strong>\${{ data().spent | number: '1.0-0' }}</strong></div>
        </div>
        <div class="cfp-group">
          <div class="cfp-stack">
            <div class="cfp-bar cfp-bar--expense-dotted" [style.height.px]="h(expenseOverageH())"></div>
            <div class="cfp-bar cfp-bar--expense-ghost" [style.height.px]="h(data().budgetedExpenses)"></div>
          </div>
          <div class="cfp-caption">
            <span>Budgeted</span><strong>\${{ data().budgetedExpenses | number: '1.0-0' }}</strong>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    cashFlowProtoStyles(),
    `
      .cfp-bars { justify-content: space-between; }
      .cfp-pair { display: flex; gap: 0.9rem; padding: 0 0.4rem; border-radius: 0.6rem; }
    `,
  ],
})
export class CashFlowVariantB {
  readonly data = input.required<CashFlowProtoData>();

  private readonly max = computed(() => {
    const d = this.data();
    return Math.max(d.earned, d.spent, d.budgetedIncome, d.budgetedExpenses, 1);
  });

  protected readonly incomeOverageH = computed(() => Math.max(0, this.data().earned - this.data().budgetedIncome));
  protected readonly expenseOverageH = computed(() => Math.max(0, this.data().spent - this.data().budgetedExpenses));

  protected h(value: number): number {
    return scaleHeight(value, this.max());
  }
}

// ---------- Variant C: merged — Income / Expenses (2 bars total) ----------

@Component({
  selector: 'app-cash-flow-variant-c',
  imports: [DecimalPipe],
  template: `
    <div class="cfp-bars cfp-bars--wide">
      <div class="cfp-group">
        <div class="cfp-stack">
          <div class="cfp-bar cfp-bar--income-dotted" [style.height.px]="h(incomeOverageH())"></div>
          <div class="cfp-bar cfp-bar--income-ghost" [style.height.px]="h(data().budgetedIncome)"></div>
        </div>
        <div class="cfp-caption">
          <span>Income</span>
          <strong>\${{ data().earned | number: '1.0-0' }}</strong>
          <em>of \${{ data().budgetedIncome | number: '1.0-0' }} budgeted</em>
        </div>
      </div>
      <div class="cfp-group">
        <div class="cfp-stack">
          <div class="cfp-bar cfp-bar--expense-dotted" [style.height.px]="h(expenseOverageH())"></div>
          <div class="cfp-bar cfp-bar--expense-ghost" [style.height.px]="h(data().budgetedExpenses)"></div>
        </div>
        <div class="cfp-caption">
          <span>Expenses</span>
          <strong>\${{ data().spent | number: '1.0-0' }}</strong>
          <em>of \${{ data().budgetedExpenses | number: '1.0-0' }} budgeted</em>
        </div>
      </div>
    </div>
  `,
  styles: [
    cashFlowProtoStyles(),
    `
      .cfp-bars--wide { gap: 3rem; justify-content: center; }
      .cfp-caption em { display: block; font-size: 0.62rem; font-style: normal; color: var(--spearmint-muted); margin-top: 0.1rem; }
    `,
  ],
})
export class CashFlowVariantC {
  readonly data = input.required<CashFlowProtoData>();

  private readonly max = computed(() => {
    const d = this.data();
    return Math.max(d.earned, d.spent, d.budgetedIncome, d.budgetedExpenses, 1);
  });

  protected readonly incomeOverageH = computed(() => Math.max(0, this.data().earned - this.data().budgetedIncome));
  protected readonly expenseOverageH = computed(() => Math.max(0, this.data().spent - this.data().budgetedExpenses));

  protected h(value: number): number {
    return scaleHeight(value, this.max());
  }
}

function cashFlowProtoStyles(): string {
  return `
    .cfp-bars { display: flex; gap: 1.5rem; align-items: flex-end; height: 7rem; margin-top: 0.9rem; }
    .cfp-group { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; height: 100%; justify-content: flex-end; }
    .cfp-group--gap { margin-left: 0.75rem; }
    .cfp-stack { display: flex; flex-direction: column; justify-content: flex-end; width: 2.75rem; }
    .cfp-bar { width: 100%; border-radius: 0.4rem 0.4rem 0 0; box-sizing: border-box; }
    .cfp-bar--income { background: var(--spearmint-primary); }
    .cfp-bar--expense { background: var(--spearmint-accent); }
    .cfp-bar--income-ghost { background: var(--spearmint-primary); opacity: 0.4; }
    .cfp-bar--expense-ghost { background: var(--spearmint-accent); opacity: 0.4; }
    .cfp-bar--income-dotted { background: transparent; border: 2px dashed var(--spearmint-primary); border-bottom: none; }
    .cfp-bar--expense-dotted { background: transparent; border: 2px dashed var(--spearmint-accent); border-bottom: none; }
    .cfp-caption { text-align: center; }
    .cfp-caption span { display: block; font-size: 0.7rem; color: var(--spearmint-muted); }
    .cfp-caption strong { font-size: 0.8rem; font-weight: 800; color: var(--spearmint-ink); }
  `;
}

// ---------- Switcher host: reads ?variant=, renders the right one, shows the floating bar ----------

const VARIANTS = ['A', 'B', 'C'] as const;
type Variant = (typeof VARIANTS)[number];

@Component({
  selector: 'app-cash-flow-prototype-host',
  imports: [CashFlowVariantA, CashFlowVariantB, CashFlowVariantC],
  template: `
    @switch (variant()) {
      @case ('A') {
        <app-cash-flow-variant-a [data]="data()" />
      }
      @case ('B') {
        <app-cash-flow-variant-b [data]="data()" />
      }
      @case ('C') {
        <app-cash-flow-variant-c [data]="data()" />
      }
    }
    @if (devMode) {
      <div class="cfp-switcher">
        <button type="button" (click)="cycle(-1)" aria-label="Previous variant">&larr;</button>
        <span>{{ variant() }} &mdash; {{ variantLabel() }}</span>
        <button type="button" (click)="cycle(1)" aria-label="Next variant">&rarr;</button>
      </div>
    }
  `,
  styles: [
    `
      :host { display: contents; }
      .cfp-switcher {
        position: fixed;
        bottom: calc(5.5rem + env(safe-area-inset-bottom));
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: #15251b;
        color: #fff;
        padding: 0.4rem 0.9rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        box-shadow: 0 4px 16px rgba(21, 37, 27, 0.35);
        z-index: 50;
      }
      .cfp-switcher button {
        background: rgba(255, 255, 255, 0.16);
        border: none;
        color: #fff;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 50%;
        cursor: pointer;
      }
    `,
  ],
})
export class CashFlowPrototypeHost {
  readonly data = input.required<CashFlowProtoData>();

  protected readonly devMode = isDevMode();

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly variant = signal<Variant>(this.readVariantFromRoute());

  protected readonly variantLabel = computed(
    () =>
      ({
        A: 'Earned/Spent + Budgeted pair',
        B: 'Paired actual + budgeted',
        C: 'Merged income/expense bars',
      })[this.variant()],
  );

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const fromUrl = params.get('variant');
      if (fromUrl && this.isVariant(fromUrl) && fromUrl !== this.variant()) {
        this.variant.set(fromUrl);
      }
    });
  }

  protected cycle(delta: number): void {
    const currentIndex = VARIANTS.indexOf(this.variant());
    const next = VARIANTS[(currentIndex + delta + VARIANTS.length) % VARIANTS.length];
    this.variant.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { variant: next },
      queryParamsHandling: 'merge',
    });
  }

  private readVariantFromRoute(): Variant {
    const fromUrl = this.route.snapshot.queryParamMap.get('variant');
    return fromUrl && this.isVariant(fromUrl) ? fromUrl : 'A';
  }

  private isVariant(value: string): value is Variant {
    return (VARIANTS as readonly string[]).includes(value);
  }
}
