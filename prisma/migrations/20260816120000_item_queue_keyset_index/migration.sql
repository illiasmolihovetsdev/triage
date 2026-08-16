-- Keyset pagination for the unfiltered queue.
--
-- Listing is `WHERE workspaceId = $ws ORDER BY createdAt DESC, id DESC`
-- with a seek predicate `(createdAt, id) < (cursor)` on later pages.
-- The previous index is `(workspaceId, status, createdAt)`, which cannot
-- serve that query well: `status` sits in the middle, and there is no `id`
-- tiebreaker. This index matches the unfiltered keyset left-to-right.

CREATE INDEX "Item_workspaceId_createdAt_id_idx"
ON "Item"("workspaceId", "createdAt" DESC, "id" DESC);
