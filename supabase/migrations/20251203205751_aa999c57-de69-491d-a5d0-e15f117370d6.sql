-- Add 'accounting' to app_role enum (must be committed before use)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'accounting';