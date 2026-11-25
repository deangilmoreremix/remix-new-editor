-- ===========================================================================
-- block_guest_copy_deletes.sql
--
-- "Get link" copies a signed-out person's result to smartvideo/anonymous/copies/<name>. The existing delete policy
-- lets ANY signed-out caller delete anything under smartvideo/anonymous/ (the folder name is the same for everyone
-- without an account), so anyone could break another person's link. This keeps the policy for every other path and
-- removes the delete right for that one subfolder. Signed-in people are unaffected: their folder is
-- smartvideo/<their id>/..., which never equals 'anonymous'.
-- ===========================================================================

DROP POLICY IF EXISTS "smartvideo_uploads_delete" ON storage.objects;

CREATE POLICY "smartvideo_uploads_delete"
  ON storage.objects FOR DELETE
  TO public
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = 'smartvideo'
    AND (storage.foldername(name))[2] = coalesce(auth.jwt() ->> 'sub', 'anonymous')
    AND NOT (
      (storage.foldername(name))[2] = 'anonymous'
      AND (storage.foldername(name))[3] = 'copies'
    )
  );
