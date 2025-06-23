-- Chat機能用のデータベーススキーマ

-- 1. メッセージテーブル
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  image_url TEXT,
  image_metadata JSONB,
  reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. メッセージ既読テーブル
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- 3. メッセージリアクションテーブル
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_chat_messages_trip_id ON chat_messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);

-- RLS (Row Level Security) 設定
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- chat_messages のポリシー
CREATE POLICY "Trip members can view chat messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_members 
      WHERE trip_members.trip_id = chat_messages.trip_id 
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can insert chat messages" ON chat_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM trip_members 
      WHERE trip_members.trip_id = chat_messages.trip_id 
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages" ON chat_messages
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON chat_messages
  FOR DELETE USING (user_id = auth.uid());

-- message_reads のポリシー
CREATE POLICY "Users can view their own read status" ON message_reads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own read status" ON message_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own read status" ON message_reads
  FOR UPDATE USING (user_id = auth.uid());

-- message_reactions のポリシー
CREATE POLICY "Trip members can view reactions" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_messages cm
      JOIN trip_members tm ON cm.trip_id = tm.trip_id
      WHERE cm.id = message_reactions.message_id 
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reactions" ON message_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_messages cm
      JOIN trip_members tm ON cm.trip_id = tm.trip_id
      WHERE cm.id = message_reactions.message_id 
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own reactions" ON message_reactions
  FOR DELETE USING (user_id = auth.uid());

-- updated_at の自動更新用トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE
    ON chat_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Realtime 有効化
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- Storage bucket for chat images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy
CREATE POLICY "Trip members can upload chat images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Trip members can view chat images" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-images');