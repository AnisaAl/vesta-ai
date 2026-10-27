# Milestone 5 — Persisted wardrobe + chat grounding

## Goal

Replace in-memory Unsplash / blob-URL wardrobe with Postgres rows + `objectStorage` uploads. Session-scoped like the cart (`vesta_sid`). Chat can reference closet pieces; **only affiliate/DeepFashion catalog cards are shoppable**.

## What shipped

| Piece | Location |
|--------|----------|
| `wardrobe_items` table | `shared/schema.ts` + `migrations/0001_wardrobe_items.sql` |
| Storage CRUD | `server/storage.ts` |
| Boot ensure (if push skipped) | `ensureWardrobeItemsTable` in `server/db.ts` |
| Upload decode + wardrobe API | `server/routes.ts` |
| Closet scoring / inventory text | `server/services/wardrobe.ts` |
| Chat grounding (prompt + non-shoppable cards) | `server/services/fashionAi.ts` |
| Client hook | `client/src/hooks/useWardrobe.ts` |
| Wardrobe page | `client/src/pages/Wardrobe.tsx` |

## Identity

Same anonymous session cookie as cart. Optional `userId` set to the seeded local MVP user on create (mirrors chat history). Ownership checks always include `sessionId`.

## API

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/wardrobe` | Items for this session |
| `POST` | `/api/wardrobe` | `{ imageData, title?, tag?, category?, colors? }` → stores via `objectStorage` |
| `PATCH` | `/api/wardrobe/:id` | Metadata only |
| `DELETE` | `/api/wardrobe/:id` | Session-scoped |

Images are served from `/uploads/...` when `STORAGE_MODE=local`.

## Chat

- Loads wardrobe for the session on every `POST /api/chat`.
- Injects inventory into the mentor system prompt.
- For combine / similar / browse (and wardrobe cues), may prepend non-shoppable `source: "wardrobe"` outfits; catalog injection still uses existing intent filters.
- No `productId` on wardrobe cards → no Add to bag.

## Out of scope

M6 trends · Kolors · embeddings · auth-editable profile · merchant-of-record · selling wardrobe items.

## Acceptance

1. Upload on `/wardrobe` → survives refresh.
2. Ask chat about “my wardrobe” / a titled piece → reply can reference it (and may show a wardrobe card).
3. `npm run eval:chat` stays green (no Claude / no DB).
4. Try-on Demo path unchanged.
