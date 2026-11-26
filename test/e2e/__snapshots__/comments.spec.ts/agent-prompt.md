tally/currency.py:7

> _SYMBOLS = {"EUR": "€", "USD": "$", "GBP": "£", "JPY": "¥"}

`KWD` gets three decimals above but no symbol here.

(agent) Added `KD` to `_SYMBOLS`.

---

(file) tally/refunds.py

(agent) Consider folding this into `ledger.py`; it only has two callers.

Agreed, in a follow-up.

---

## Pending feedback in Diffle

On the first Diffle task for this review in this chat, run `diffle review-context` and read the whole patch before handling individual comments. Refresh that understanding if the review changes. Run `diffle comments context <target>` immediately before addressing each item. Read the README and applicable `AGENTS.md`. Before the first fix, explain the change's purpose, rationale and flow in chat and ask about unresolved intent. Read the thread and investigate questions against the current code. For requested changes, plan the fix and its verification, implement it, then run the relevant tests and required repository checks. Check each target against the final diff. Reply with the finding or fix and the observed check result using `diffle comments reply <target> <summary>`. Leave blocked items pending.

`KWD` gets three decimals above but no symbol here.

Target: `[target]`

Original (New side) tally/currency.py:7–7
> 4:
> 5: # Minor units per currency; everything else has two.
> 6: _DIGITS = {"JPY": 0, "KWD": 3}
> 7: _SYMBOLS = {"EUR": "€", "USD": "$", "GBP": "£", "JPY": "¥"}
> 8:
> 9:
> 10: def minor_units(currency: str) -> int:

Agreed, in a follow-up.

Target: `[target]`
