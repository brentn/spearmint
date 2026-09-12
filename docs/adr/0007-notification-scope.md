# Notification scope: in-app only, auth/sync errors only

Notifications are in-app badge/alert only — no push infrastructure. Triggers are limited to auth issues and sync/data errors; budget-threshold crossings were considered as a trigger and explicitly dropped in favor of conveying budget status entirely through progress-bar color (see [Budget status & rollup computation](0008-budget-status-and-rollup.md)).

A successful sync that changes data (new or updated transactions) is also an approved in-app trigger, alongside errors — surfaced as a small ambient toast (`ToastService`, `src/app/shell/toast/`) rather than a push notification, silent when a sync finds nothing new.
