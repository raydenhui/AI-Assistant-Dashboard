-- =============================================================================
-- AI Personal Productivity Dashboard - Database Initialization
-- =============================================================================
-- This file is executed when the PostgreSQL container is first created.
-- It sets up the database with proper extensions and configurations.

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy text search (useful for email search)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant necessary permissions to the application user
-- (The user is created by Docker, but we ensure proper permissions)
GRANT ALL PRIVILEGES ON DATABASE ai_dashboard TO ai_dashboard;

-- Create a function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully at %', NOW();
END $$;
