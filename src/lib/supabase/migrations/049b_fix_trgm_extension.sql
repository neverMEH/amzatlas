-- Migration: 049b_fix_trgm_extension.sql
-- Description: Enable pg_trgm extension and fix migration 049
-- Date: 2025-09-08
-- Author: Claude

-- Enable pg_trgm extension for trigram matching (required for gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Now we can safely create the GIN index with trigram ops
-- This fixes the error in migration 049