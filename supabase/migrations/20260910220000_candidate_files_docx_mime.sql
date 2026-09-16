-- Allow common resume attachment types (Word, ODT) in candidate-files bucket

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'text/plain',
  'message/rfc822',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text'
]::text[]
WHERE id = 'candidate-files';
