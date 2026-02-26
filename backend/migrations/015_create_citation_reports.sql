-- Migration 015: Create citation_reports table for reports and edit suggestions

CREATE TABLE IF NOT EXISTS citation_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type     VARCHAR(20) NOT NULL,          -- 'report' | 'suggestion'
  reporter_id     UUID NOT NULL REFERENCES users(id),
  share_token     VARCHAR(8) NOT NULL,
  annotation_id   VARCHAR(255),                   -- ID of the specific annotation within the share
  reason          TEXT,                           -- Report reason or suggestion reason
  suggested_text  TEXT,                           -- Only for suggestions
  details         TEXT,                           -- Additional details from reporter
  status          VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for listing reports by status
CREATE INDEX IF NOT EXISTS idx_citation_reports_status ON citation_reports(status);

-- Index for looking up reports by share
CREATE INDEX IF NOT EXISTS idx_citation_reports_share_token ON citation_reports(share_token);

-- Index for listing reports by reporter
CREATE INDEX IF NOT EXISTS idx_citation_reports_reporter ON citation_reports(reporter_id);
