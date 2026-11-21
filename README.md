# ASIA MAI — Online Bestellen V3

Official working repository for the Asia Mai restaurant ordering website.

## Confirmed scope
- German-language, responsive customer ordering website (Lieferung / Abholung).
- Delivery address autocomplete and validation; distance measured by **Fahrstrecke** (actual driving route).
- Admin-configurable delivery zones and fees (distance tiers), maximum range, minimum order value and opening hours.
- Pickup: customer selects time; restaurant may propose a new time; customer must confirm the proposal.
- Menu, categories, dishes, images, options, cart and checkout.
- Payment: PayPal Business (capture immediately; refund through API if restaurant rejects), or Bargeld.
- Tracking: secure unguessable token, automatic status updates without re-entering the code.
- Admin: new-order alert, accept/reject, delivery ETA, menu editor, customers, statistics and settings.
- Security: authenticated admin, roles, rate limits, 2FA where appropriate; no secrets in git.

## Workflow
- `main`: stable, reviewed changes.
- `dev`: ongoing work and testing.
- Each change modifies the existing project files; do not regenerate unrelated site copies.
- Record requirements and changes in the repository.

## Current status
Repository initialized. The earlier standalone HTML prototype has **not yet been uploaded** to this repository. No live payment or Google API integration is enabled.

## Security
Never commit PayPal credentials, Google secret keys, passwords or personal customer data.
