-- Add conversation context for multi-turn AI conversations
-- This stores partial data during invoice/bill creation conversations

CREATE TABLE IF NOT EXISTS conversation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What the AI is currently working on
  pending_action TEXT NOT NULL, -- 'CREATE_INVOICE', 'CREATE_BILL', etc.
  
  -- Collected data so far (JSON)
  collected_data JSONB DEFAULT '{}'::jsonb,
  
  -- What fields are still missing
  missing_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Current state
  state TEXT DEFAULT 'collecting', -- 'collecting', 'preview', 'confirmed'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active context per conversation
CREATE UNIQUE INDEX idx_conversation_context_unique 
  ON conversation_context(conversation_id);

-- Index for user queries
CREATE INDEX idx_conversation_context_user 
  ON conversation_context(user_id);

-- Index for finding active contexts
CREATE INDEX idx_conversation_context_state 
  ON conversation_context(state) 
  WHERE state IN ('collecting', 'preview');

-- Add RLS policies
ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversation context"
  ON conversation_context
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversation context"
  ON conversation_context
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation context"
  ON conversation_context
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversation context"
  ON conversation_context
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add message_type to messages table for preview messages
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index on message type
CREATE INDEX IF NOT EXISTS idx_messages_type 
  ON messages(message_type);

COMMENT ON TABLE conversation_context IS 'Stores partial/incomplete data during multi-turn AI conversations';
COMMENT ON COLUMN conversation_context.pending_action IS 'The action being worked on (CREATE_INVOICE, CREATE_BILL, etc)';
COMMENT ON COLUMN conversation_context.collected_data IS 'JSON object with collected field values';
COMMENT ON COLUMN conversation_context.missing_fields IS 'Array of field names still needed';
COMMENT ON COLUMN conversation_context.state IS 'Current state: collecting, preview, or confirmed';
COMMENT ON COLUMN messages.message_type IS 'Type of message: text, preview, or success';
COMMENT ON COLUMN messages.metadata IS 'Additional data for preview messages';


