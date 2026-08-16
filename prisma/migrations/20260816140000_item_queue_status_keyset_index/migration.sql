-- Filtered queue keyset: workspace, status, then recency with id as the
-- tiebreaker. The previous index was (workspaceId, status, createdAt) without
-- id and without DESC, so a deep pending page could not seek on the full
-- sort key. This replacement matches
-- WHERE workspaceId = $ws AND status = $status
--   AND (createdAt, id) < (cursor)
-- ORDER BY createdAt DESC, id DESC.

DROP INDEX "Item_workspaceId_status_createdAt_idx";

CREATE INDEX "Item_workspaceId_status_createdAt_id_idx"
ON "Item"("workspaceId", "status", "createdAt" DESC, "id" DESC);
