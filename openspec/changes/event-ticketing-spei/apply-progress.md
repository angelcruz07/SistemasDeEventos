# Apply Progress: event-ticketing-spei

## Batch 1: PR0 (branch feat/ticketing-pr0-foundation) - DONE
- [x] 0.1 tree verified clean (only untracked .atl/, not committed)
- [x] 0.2 vitest@3.2.7 + vite-tsconfig-paths@5.1.4, vitest.config.mts
- [x] 0.3 scripts test, db:migrate, db:deploy, db:generate
- [x] 0.4 RED then GREEN formatMx (4 tests)
- [x] 0.5 updateEvent no longer regenerates slug
- [x] 0.6 updateEvent no longer rejects past date/time (createEvent keeps it)
- [x] 0.7 deleteEvent relies on cascade
- [x] 0.8 deleted 3 empty action files (no imports existed)

Verification: tsc clean; vitest 4/4; lint 5 problems (2 errors, 3 warnings) identical before/after, pre-existing.
Next: PR1 (not started).
