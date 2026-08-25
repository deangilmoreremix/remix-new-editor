-- ============================================================
-- Cloudflare BYOC Integration — Database Migration
-- Version: 1.0.0
-- Last Updated: 2026-08-25
-- ============================================================
-- Run this migration in your Supabase SQL editor or via CLI:
-- supabase db push --file supabase/migrations/20260825_cloudflare_byoc.sql
-- ============================================================

-- ============================================================
-- Extension for UUID generation
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table: user_cloudflare_creds
-- Purpose: Stores encrypted Cloudflare API credentials per user
-- Security: AES-256-GCM encryption, RLS enabled
-- ============================================================

CREATE TABLE IF NOT EXISTS user_cloudflare_creds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Cloudflare account identifier (plaintext, used for lookups)
    account_id TEXT NOT NULL,
    
    -- Encrypted credential data
    encrypted_token BYTEA NOT NULL,
    token_nonce BYTEA NOT NULL,
    token_tag BYTEA NOT NULL,
    
    -- Metadata (non-sensitive)
    token_scope TEXT[] DEFAULT '{}',
    account_email TEXT,
    account_name TEXT,
    
    -- Status tracking
    is_active BOOLEAN DEFAULT true,
    is_valid BOOLEAN DEFAULT true,
    last_validated_at TIMESTAMPTZ,
    last_validation_error TEXT,
    
    -- Rotation tracking
    last_rotated_at TIMESTAMPTZ DEFAULT now(),
    rotation_reminder_sent BOOLEAN DEFAULT false,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    total_deployments INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT one_active_creds_per_user UNIQUE (user_id, account_id),
    CONSTRAINT valid_token_shape CHECK (
        octet_length(encrypted_token) > 0 
        AND octet_length(token_nonce) = 12
        AND octet_length(token_tag) = 16
    )
);

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cloudflare_creds_user_active 
    ON user_cloudflare_creds(user_id, is_active) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_cloudflare_creds_account 
    ON user_cloudflare_creds(account_id);

CREATE INDEX IF NOT EXISTS idx_cloudflare_creds_rotation 
    ON user_cloudflare_creds(last_rotated_at) 
    WHERE is_active = true;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE user_cloudflare_creds ENABLE ROW LEVEL SECURITY;

-- Users can only access their own credentials
CREATE POLICY "Users can manage own cloudflare creds"
    ON user_cloudflare_creds
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Auto-update timestamp trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cloudflare_creds_updated_at ON user_cloudflare_creds;
CREATE TRIGGER update_cloudflare_creds_updated_at
    BEFORE UPDATE ON user_cloudflare_creds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Table: deployment_history
-- Purpose: Track all deployments for rollback capability
-- ============================================================

CREATE TABLE IF NOT EXISTS deployment_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES user_cloudflare_creds(id) ON DELETE SET NULL,
    
    -- Deployment target
    project_name TEXT NOT NULL,
    domain TEXT,
    is_custom_domain BOOLEAN DEFAULT false,
    
    -- Deployment details
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'building', 'deploying', 'live', 'failed', 'rolled_back')),
    cloudflare_deployment_id TEXT,
    artifact_url TEXT,
    
    -- Error tracking
    error_message TEXT,
    error_code TEXT,
    
    -- Rollback tracking
    rolled_back_from UUID REFERENCES deployment_history(id),
    
    -- Timestamps
    deployed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deployments_user_status 
    ON deployment_history(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deployments_credential 
    ON deployment_history(credential_id, created_at DESC);

-- RLS for deployment history
ALTER TABLE deployment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own deployments"
    ON deployment_history
    FOR ALL
    USING (auth.uid() = user_id);

-- ============================================================
-- Table: admin_credential_access_log
-- Purpose: Audit trail for support access to credentials
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_credential_access_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID NOT NULL,
    target_user_id UUID NOT NULL,
    credential_id UUID NOT NULL,
    access_reason TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_access_target 
    ON admin_credential_access_log(target_user_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_access_admin 
    ON admin_credential_access_log(admin_user_id, accessed_at DESC);

-- ============================================================
-- Table: deployment_locks
-- Purpose: Prevent concurrent deployments for same project
-- ============================================================

CREATE TABLE IF NOT EXISTS deployment_locks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    locked_at TIMESTAMPTZ DEFAULT now(),
    locked_by TEXT NOT NULL, -- session or request ID
    
    CONSTRAINT unique_project_lock UNIQUE (user_id, project_name)
);

-- Auto-cleanup old locks (older than 5 minutes)
-- Note: Partial index with now() not allowed in PostgreSQL, using full index instead
CREATE INDEX IF NOT EXISTS idx_deployment_locks_cleanup 
    ON deployment_locks(locked_at);

-- ============================================================
-- View: user_cloudflare_status
-- Purpose: Non-sensitive credential status for UI display
-- ============================================================

CREATE OR REPLACE VIEW user_cloudflare_status AS
SELECT 
    id,
    user_id,
    account_id,
    token_scope,
    account_email,
    account_name,
    is_active,
    is_valid,
    last_validated_at,
    last_validation_error,
    last_rotated_at,
    last_used_at,
    total_deployments,
    created_at,
    updated_at,
    -- Calculate days until rotation needed
    EXTRACT(DAY FROM (now() - last_rotated_at)) as days_since_rotation,
    CASE 
        WHEN EXTRACT(DAY FROM (now() - last_rotated_at)) > 90 THEN 'expired'
        WHEN EXTRACT(DAY FROM (now() - last_rotated_at)) > 75 THEN 'expiring_soon'
        ELSE 'active'
    END as rotation_status
FROM user_cloudflare_creds
WHERE is_active = true;

-- ============================================================
-- Function: cleanup_expired_deployment_locks
-- Purpose: Remove stale deployment locks
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_deployment_locks()
RETURNS void AS $$
BEGIN
    DELETE FROM deployment_locks 
    WHERE locked_at < now() - interval '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Function: record_admin_access
-- Purpose: Log support access to credentials
-- ============================================================

CREATE OR REPLACE FUNCTION record_admin_access(
    p_admin_user_id UUID,
    p_target_user_id UUID,
    p_credential_id UUID,
    p_access_reason TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO admin_credential_access_log (
        admin_user_id,
        target_user_id,
        credential_id,
        access_reason,
        ip_address,
        user_agent
    ) VALUES (
        p_admin_user_id,
        p_target_user_id,
        p_credential_id,
        p_access_reason,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Verification: Confirm tables were created
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE 'Cloudflare BYOC migration complete:';
    RAISE NOTICE '- user_cloudflare_creds table created with RLS';
    RAISE NOTICE '- deployment_history table created with RLS';
    RAISE NOTICE '- admin_credential_access_log table created';
    RAISE NOTICE '- deployment_locks table created';
    RAISE NOTICE '- user_cloudflare_status view created';
    RAISE NOTICE '- cleanup and audit functions created';
END $$;
