-- Email attachments can be any MIME type (PDF, Word, PNG signatures, etc.)

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'candidate-files';
