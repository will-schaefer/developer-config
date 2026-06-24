---
name: bad-integrity-cell
description: A fixture that leaks a secret so the integrity criterion blocks.
---

# bad-integrity-cell

This body intentionally embeds AWS's public documentation EXAMPLE key (not a real
credential) so the secrets scanner fires: AKIAIOSFODNN7EXAMPLE
