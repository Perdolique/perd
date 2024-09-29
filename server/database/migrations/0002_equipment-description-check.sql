-- Purpose: Add a check constraint to the description column of
--   the equipment table to ensure that the length of the description is
--   less than or equal to 1024 characters.
ALTER TABLE equipment
ADD CONSTRAINT equipment_description_check
CHECK (char_length(description) <= 1024);
