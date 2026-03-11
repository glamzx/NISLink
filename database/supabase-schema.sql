-- ============================================================
-- NIS Connect — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run (uses IF NOT EXISTS and DROP POLICY IF EXISTS)
-- ============================================================

-- -----------------------------------------------------------
-- Profiles table (extends Supabase auth.users)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  full_name     TEXT NOT NULL DEFAULT '',
  username      TEXT UNIQUE,
  nis_branch    TEXT,
  graduation_year INT,
  university    TEXT,
  degree_major  TEXT,
  bio           TEXT,
  status        TEXT,
  linkedin      TEXT,
  instagram     TEXT,
  youtube       TEXT,
  avatar_url    TEXT,
  cover_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile when a user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------
-- Posts
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------
-- Post Attachments
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_attachments (
  id            BIGSERIAL PRIMARY KEY,
  post_id       BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  file_type     TEXT,
  original_name TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------
-- Post Likes
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_likes (
  id          BIGSERIAL PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- -----------------------------------------------------------
-- Post Comments
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_comments (
  id          BIGSERIAL PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------
-- Subscriptions (Follow)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id            BIGSERIAL PRIMARY KEY,
  follower_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- -----------------------------------------------------------
-- Conversations
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id          BIGSERIAL PRIMARY KEY,
  user_a      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_a, user_b)
);

-- -----------------------------------------------------------
-- Messages
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id                BIGSERIAL PRIMARY KEY,
  conversation_id   BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content           TEXT,
  attachment_path   TEXT,
  attachment_type   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------
-- Row Level Security (RLS)
-- -----------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first (safe to re-run)
DROP POLICY IF EXISTS "Profiles: public read" ON profiles;
DROP POLICY IF EXISTS "Profiles: own update" ON profiles;
DROP POLICY IF EXISTS "Posts: public read" ON posts;
DROP POLICY IF EXISTS "Posts: auth insert" ON posts;
DROP POLICY IF EXISTS "Posts: own delete" ON posts;
DROP POLICY IF EXISTS "Attachments: public read" ON post_attachments;
DROP POLICY IF EXISTS "Attachments: auth insert" ON post_attachments;
DROP POLICY IF EXISTS "Attachments: cascade delete" ON post_attachments;
DROP POLICY IF EXISTS "Likes: public read" ON post_likes;
DROP POLICY IF EXISTS "Likes: auth insert" ON post_likes;
DROP POLICY IF EXISTS "Likes: own delete" ON post_likes;
DROP POLICY IF EXISTS "Comments: public read" ON post_comments;
DROP POLICY IF EXISTS "Comments: auth insert" ON post_comments;
DROP POLICY IF EXISTS "Comments: own delete" ON post_comments;
DROP POLICY IF EXISTS "Subs: public read" ON subscriptions;
DROP POLICY IF EXISTS "Subs: auth insert" ON subscriptions;
DROP POLICY IF EXISTS "Subs: own delete" ON subscriptions;
DROP POLICY IF EXISTS "Convos: participant read" ON conversations;
DROP POLICY IF EXISTS "Convos: auth insert" ON conversations;
DROP POLICY IF EXISTS "Convos: participant update" ON conversations;
DROP POLICY IF EXISTS "Messages: participant read" ON messages;
DROP POLICY IF EXISTS "Messages: auth insert" ON messages;
DROP POLICY IF EXISTS "Uploads: public read" ON storage.objects;
DROP POLICY IF EXISTS "Uploads: auth insert" ON storage.objects;
DROP POLICY IF EXISTS "Uploads: own delete" ON storage.objects;

-- Profiles: anyone can read, only own profile can update
CREATE POLICY "Profiles: public read" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: own update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Posts: anyone can read, auth users can insert, only author can delete
CREATE POLICY "Posts: public read" ON posts FOR SELECT USING (true);
CREATE POLICY "Posts: auth insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Posts: own delete" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Post Attachments: anyone can read, auth users can insert
CREATE POLICY "Attachments: public read" ON post_attachments FOR SELECT USING (true);
CREATE POLICY "Attachments: auth insert" ON post_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Attachments: cascade delete" ON post_attachments FOR DELETE USING (true);

-- Post Likes: anyone can read, auth users can insert/delete own
CREATE POLICY "Likes: public read" ON post_likes FOR SELECT USING (true);
CREATE POLICY "Likes: auth insert" ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Likes: own delete" ON post_likes FOR DELETE USING (auth.uid() = user_id);

-- Comments: anyone can read, auth users can insert, own delete
CREATE POLICY "Comments: public read" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Comments: auth insert" ON post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Comments: own delete" ON post_comments FOR DELETE USING (auth.uid() = user_id);

-- Subscriptions: anyone can read, auth users can insert/delete own
CREATE POLICY "Subs: public read" ON subscriptions FOR SELECT USING (true);
CREATE POLICY "Subs: auth insert" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Subs: own delete" ON subscriptions FOR DELETE USING (auth.uid() = follower_id);

-- Conversations: only participants can read/insert
CREATE POLICY "Convos: participant read" ON conversations FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Convos: auth insert" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Convos: participant update" ON conversations FOR UPDATE USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Messages: only conversation participants can read/insert
CREATE POLICY "Messages: participant read" ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations c WHERE c.id = conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  ));
CREATE POLICY "Messages: auth insert" ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM conversations c WHERE c.id = conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  ));

-- -----------------------------------------------------------
-- Storage bucket for uploads
-- -----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can read, auth users can upload
CREATE POLICY "Uploads: public read" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "Uploads: auth insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');
CREATE POLICY "Uploads: own delete" ON storage.objects FOR DELETE USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
