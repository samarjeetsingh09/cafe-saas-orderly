@AGENTS.md

# Cafiyara/Bëlla rebuild — the four rules

See `NOTES.md` and `../plan/START-HERE.md` for full context. These rules govern everything
built after the login click (owner console, kitchen display, customer ordering, HQ portal).
The marketing website is out of scope for these rules — it does not change.

1. **Do not redesign anything.** Port prototype HTML/CSS from `../plan/bella-*.html` verbatim.
   Allowed edits: hex → CSS token, mock array → API data, fake `setInterval` → live
   subscription, inline `onclick` → React handler. Nothing else. If something could look
   better, write it in `NOTES.md` and move on.
2. **No hardcoded cafe data.** No cafe name, colour, dish, price, table count or GST number in
   any component — it lives in the database.
3. **One frontend, one backend, one menu builder.** No second app, no Express server, no
   separate HQ menu editor.
4. **Never mark a task done unless you ran it.** State plainly what works, what doesn't, and
   what was skipped.
