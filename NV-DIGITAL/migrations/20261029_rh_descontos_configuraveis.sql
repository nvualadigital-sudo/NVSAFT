-- Opções guardadas no JSON já versionado dos perfis. Não altera folhas aprovadas.
ALTER TABLE public.nv_hr_profiles ADD CONSTRAINT nv_hr_payroll_options_object CHECK(NOT(data ? 'payrollOptions') OR jsonb_typeof(data->'payrollOptions')='object');
ALTER TABLE public.nv_hr_profiles ADD CONSTRAINT nv_hr_internal_deductions_array CHECK(NOT(data ? 'internalDeductions') OR jsonb_typeof(data->'internalDeductions')='array');
