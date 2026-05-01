-- Create RPC for efficient collection item counting
-- Avoids O(n) multi-query pattern by counting in database layer

CREATE OR REPLACE FUNCTION count_user_collection_items(user_id UUID)
RETURNS BIGINT AS $$
  SELECT COUNT(*)::BIGINT
  FROM collection_items ci
  WHERE ci.collection_id IN (
    SELECT id FROM collections WHERE user_id = $1
  )
$$ LANGUAGE SQL STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION count_user_collection_items(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION count_user_collection_items(UUID) TO service_role;
