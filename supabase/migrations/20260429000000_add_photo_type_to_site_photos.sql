-- Add photo_type column to distinguish admin reference photos from field log photos
ALTER TABLE site_photos
  ADD COLUMN photo_type text NOT NULL DEFAULT 'admin';

-- All existing photos are admin photos (uploaded by office staff)
-- No backfill needed since DEFAULT handles it

COMMENT ON COLUMN site_photos.photo_type IS 'admin = permanent reference image, field_log = from work order completion';
