-- New, isolated ledger; no existing society/member data is changed.
-- Runtime must not own or directly change the ledger (including default grants).
CREATE TABLE public.sarvoai_monthly_allowance (
    period_start DATE PRIMARY KEY,
    reserved_cents INTEGER NOT NULL CHECK (reserved_cents BETWEEN 0 AND 2000),
    attempted_calls INTEGER NOT NULL CHECK (attempted_calls BETWEEN 0 AND 10)
);
REVOKE ALL ON TABLE public.sarvoai_monthly_allowance FROM PUBLIC;

CREATE FUNCTION public.reserve_sarvoai_call() RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    admitted INTEGER;
BEGIN
    -- UTC database time, not the caller's clock or a client-supplied month.
    INSERT INTO public.sarvoai_monthly_allowance AS allowance
        (period_start, reserved_cents, attempted_calls)
    VALUES (date_trunc('month', clock_timestamp() AT TIME ZONE 'UTC')::date, 200, 1)
    ON CONFLICT (period_start) DO UPDATE
        SET reserved_cents = allowance.reserved_cents + 200,
            attempted_calls = allowance.attempted_calls + 1
        WHERE allowance.reserved_cents <= 1800 AND allowance.attempted_calls < 10
    RETURNING reserved_cents INTO admitted;
    RETURN admitted IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_sarvoai_call() FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sc_test_app') THEN
        REVOKE ALL ON TABLE public.sarvoai_monthly_allowance FROM sc_test_app;
        GRANT EXECUTE ON FUNCTION public.reserve_sarvoai_call() TO sc_test_app;
    END IF;
END;
$$;
