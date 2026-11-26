tally/currency.py:7

> _SYMBOLS = {"EUR": "€", "USD": "$", "GBP": "£", "JPY": "¥"}

`KWD` gets three decimals above but no symbol here.

---

(file) tally/refunds.py

Consider folding this into `ledger.py`; it only has two callers.

---

## Pending feedback in Diffle

Run `diffle comments context <target>` immediately before addressing each item. Read the thread and applicable repository instructions, including `AGENTS.md`. Investigate questions against the current code. For requested changes, plan the fix and its verification, implement it, then run the relevant tests and required repository checks. Check each target against the final diff. Reply with the finding or fix and the observed check result using `diffle comments reply <target> <summary>`. Leave blocked items pending.

Consider folding this into `ledger.py`; it only has two callers.

Target: `[target]`

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
