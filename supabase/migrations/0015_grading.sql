-- CardLink — card grading
-- A copy is either raw (uses `condition`) or professionally graded. `grade` holds
-- a label like "PSA 10", "BGS 9.5", "CGC 10". Null grade = raw.
alter table user_cards add column grade text;
