-- Transactional batch update for sequence steps.
-- Validates all steps belong to the given sequence, then updates atomically.
CREATE OR REPLACE FUNCTION batch_update_sequence_steps(
  p_sequence_id uuid,
  p_steps jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  step_record jsonb;
BEGIN
  FOR step_record IN SELECT * FROM jsonb_array_elements(p_steps)
  LOOP
    UPDATE sequence_steps
    SET
      offset_hours = GREATEST(0, (step_record->>'offset_hours')::int),
      subject = step_record->>'subject',
      body_template = step_record->>'body_template',
      updated_at = now()
    WHERE id = (step_record->>'id')::uuid
      AND sequence_id = p_sequence_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Step % not found in sequence %',
        step_record->>'id', p_sequence_id;
    END IF;
  END LOOP;
END;
$$;
