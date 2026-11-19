CREATE TYPE activity_category AS ENUM (
  'COMMUNITY_EDUCATION',
  'CHILD_WELLBEING',
  'CULTURE',
  'ECONOMY',
  'GOVERNANCE',
  'HEALTH_AND_NUTRITION',
  'HOUSING_AND_INFRASTRUCTURE',
  'SPIRITUAL_DEVELOPMENT',
  'AGRICULTURE',
  'ENVIRONMENT'
);

ALTER TABLE work_plan_activities
  ADD COLUMN spc_dimensions activity_dimension[] NOT NULL DEFAULT '{}',
  ADD COLUMN spc_categories activity_category[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT spc_classification_complete CHECK (
    (cardinality(spc_dimensions) = 0 AND cardinality(spc_categories) = 0) OR
    (status = 'APPROVED' AND cardinality(spc_dimensions) > 0 AND cardinality(spc_categories) > 0)
  );
