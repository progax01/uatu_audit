-- Change score_value from smallint to real to support decimal scores
ALTER TABLE audit_results ALTER COLUMN score_value TYPE real USING score_value::real;
