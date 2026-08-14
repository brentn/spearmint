Type: task
Status: resolved

## Question

The SimpleFIN CORS/protocol research ([#10](10-simplefin-cors-protocol-research.md)) and access-layer design ([#11](11-simplefin-access-layer-design.md)) both need a real SimpleFIN Bridge setup token and access URL to test against — this can't be judged from documentation alone. Brent needs to sign up with a SimpleFIN Bridge provider and claim a setup token for at least one real bank account.

This is a HITL task: the agent can produce the exact checklist (which Bridge provider, sign-up URL, how to generate a setup token per account) but Brent has to actually do the sign-up and claim step himself, since it involves his own bank credentials.

## Answer

Brent signed up with SimpleFIN Bridge (`https://beta-bridge.simplefin.org/`), subscribed, linked a real bank account, and generated a setup token — redeemed into an access URL. The credential is held by Brent personally (kept in his notepad), not committed to the repo or pasted into any ticket. [SimpleFIN CORS/protocol research](10-simplefin-cors-protocol-research.md) and [SimpleFIN access-layer design](11-simplefin-access-layer-design.md) can now proceed using it.

