Type: grilling
Status: resolved

## Question

Should the app have any kind of alerting, and if so, what triggers it and how is it delivered?

## Answer

**In-app badge/alert only — no push notifications** (explicitly confirmed; push would require service-worker + web-push infrastructure, reopening the no-backend decision).

**Triggers**: authentication issues and errors.

Budget-related alerts are **not** a badge trigger — amended by [Budget alert rules](14-budget-alert-rules.md), which conveys budget status entirely via progress-bar color instead of a notification.
