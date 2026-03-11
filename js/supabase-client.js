/**
 * NIS Connect — Supabase Client
 * Central config + helper functions for all Supabase operations.
 */

// ══════════════════════════════════════════════════════════
//  SUPABASE CONFIG — Replace with your project credentials
// ══════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://cycemjhtxvcigrhrnvaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5Y2Vtamh0eHZjaWdyaHJudmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjA4MTAsImV4cCI6MjA4ODc5NjgxMH0.c3ltBmWmkgDE0c2HfHPwwyAOIclZPX8p05YecPRUnyY';

// The CDN UMD bundle may expose createClient in different ways
const _sb = window.supabase;
const createClient = _sb.createClient || _sb.default?.createClient || _sb;
const supabase = (typeof createClient === 'function' && createClient.length >= 2)
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : _sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ══════════════════════════════════════════════════════════
//  AUTH HELPERS
// ══════════════════════════════════════════════════════════

async function sbSignUp(email, password, fullName, username) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName, username },
        },
    });
    if (error) throw error;
    return data;
}

async function sbSignIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

async function sbSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

async function sbGetSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

async function sbGetUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// ══════════════════════════════════════════════════════════
//  PROFILE HELPERS
// ══════════════════════════════════════════════════════════

async function sbGetProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data;
}

async function sbUpdateProfile(userId, updates) {
    const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function sbCheckUsername(username) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
    if (error) throw error;
    return { available: !data };
}

// ══════════════════════════════════════════════════════════
//  POSTS HELPERS
// ══════════════════════════════════════════════════════════

async function sbGetFeedPosts() {
    const { data, error } = await supabase
        .from('posts')
        .select(`
            id, content, created_at, user_id,
            profiles!posts_user_id_fkey ( full_name, avatar_url, nis_branch, username ),
            post_attachments ( id, file_path, file_type, original_name ),
            post_likes ( id, user_id ),
            post_comments ( id )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) throw error;
    return data;
}

async function sbGetUserPosts(userId) {
    const { data, error } = await supabase
        .from('posts')
        .select(`
            id, content, created_at, user_id,
            profiles!posts_user_id_fkey ( full_name, avatar_url, nis_branch, username ),
            post_attachments ( id, file_path, file_type, original_name ),
            post_likes ( id, user_id ),
            post_comments ( id )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function sbCreatePost(userId, content) {
    const { data, error } = await supabase
        .from('posts')
        .insert({ user_id: userId, content })
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function sbDeletePost(postId) {
    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
    if (error) throw error;
}

async function sbAddAttachment(postId, filePath, fileType, originalName) {
    const { data, error } = await supabase
        .from('post_attachments')
        .insert({ post_id: postId, file_path: filePath, file_type: fileType, original_name: originalName })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ══════════════════════════════════════════════════════════
//  LIKES HELPERS
// ══════════════════════════════════════════════════════════

async function sbToggleLike(postId, userId) {
    // Check if already liked
    const { data: existing } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existing) {
        await supabase.from('post_likes').delete().eq('id', existing.id);
        return { liked: false };
    } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
        return { liked: true };
    }
}

// ══════════════════════════════════════════════════════════
//  COMMENTS HELPERS
// ══════════════════════════════════════════════════════════

async function sbGetComments(postId) {
    const { data, error } = await supabase
        .from('post_comments')
        .select(`
            id, content, created_at, user_id,
            profiles!post_comments_user_id_fkey ( full_name, avatar_url )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
}

async function sbAddComment(postId, userId, content) {
    const { data, error } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, user_id: userId, content })
        .select(`
            id, content, created_at, user_id,
            profiles!post_comments_user_id_fkey ( full_name, avatar_url )
        `)
        .single();
    if (error) throw error;
    return data;
}

async function sbDeleteComment(commentId) {
    const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);
    if (error) throw error;
}

// ══════════════════════════════════════════════════════════
//  SUBSCRIPTIONS (FOLLOW) HELPERS
// ══════════════════════════════════════════════════════════

async function sbGetFollowStatus(currentUserId, targetUserId) {
    const { data: iFollow } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle();

    const { data: followsMe } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('follower_id', targetUserId)
        .eq('following_id', currentUserId)
        .maybeSingle();

    const { count: followerCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', targetUserId);

    const { count: followingCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', targetUserId);

    return {
        i_follow: !!iFollow,
        follows_me: !!followsMe,
        is_mutual: !!iFollow && !!followsMe,
        follower_count: followerCount || 0,
        following_count: followingCount || 0,
    };
}

async function sbFollow(followerId, followingId) {
    const { error } = await supabase
        .from('subscriptions')
        .insert({ follower_id: followerId, following_id: followingId });
    if (error) throw error;
}

async function sbUnfollow(followerId, followingId) {
    const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);
    if (error) throw error;
}

async function sbGetFollowList(userId, type) {
    if (type === 'followers') {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('profiles!subscriptions_follower_id_fkey ( id, full_name, avatar_url, username, nis_branch )')
            .eq('following_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data.map(d => d.profiles);
    } else {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('profiles!subscriptions_following_id_fkey ( id, full_name, avatar_url, username, nis_branch )')
            .eq('follower_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data.map(d => d.profiles);
    }
}

// ══════════════════════════════════════════════════════════
//  CHAT HELPERS
// ══════════════════════════════════════════════════════════

async function sbGetConversations(userId) {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .order('updated_at', { ascending: false });
    if (error) throw error;

    // Enrich with other user info and last message
    const enriched = [];
    for (const conv of data) {
        const otherId = conv.user_a === userId ? conv.user_b : conv.user_a;
        const otherUser = await sbGetProfile(otherId);
        const { data: lastMsgArr } = await supabase
            .from('messages')
            .select('content, attachment_type, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);
        enriched.push({
            conv_id: conv.id,
            other_user: otherUser,
            last_message: lastMsgArr?.[0] || null,
            updated_at: conv.updated_at,
        });
    }
    return enriched;
}

async function sbGetMessages(userId, otherUserId) {
    // Find conversation
    const convId = await sbFindConversation(userId, otherUserId);
    const otherUser = await sbGetProfile(otherUserId);

    if (!convId) {
        return { messages: [], other_user: otherUser };
    }

    const { data, error } = await supabase
        .from('messages')
        .select(`
            id, sender_id, content, attachment_path, attachment_type, created_at,
            profiles!messages_sender_id_fkey ( full_name, avatar_url )
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(200);
    if (error) throw error;

    return { messages: data, other_user: otherUser };
}

async function sbSendMessage(userId, recipientId, content, attachmentPath, attachmentType) {
    let convId = await sbFindConversation(userId, recipientId);

    if (!convId) {
        const a = userId < recipientId ? userId : recipientId;
        const b = userId < recipientId ? recipientId : userId;
        const { data, error } = await supabase
            .from('conversations')
            .insert({ user_a: a, user_b: b })
            .select()
            .single();
        if (error) throw error;
        convId = data.id;
    }

    const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
            conversation_id: convId,
            sender_id: userId,
            content: content || null,
            attachment_path: attachmentPath || null,
            attachment_type: attachmentType || null,
        })
        .select(`
            id, sender_id, content, attachment_path, attachment_type, created_at,
            profiles!messages_sender_id_fkey ( full_name, avatar_url )
        `)
        .single();
    if (msgErr) throw msgErr;

    // Touch conversation timestamp
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);

    return msg;
}

async function sbFindConversation(userA, userB) {
    const a = userA < userB ? userA : userB;
    const b = userA < userB ? userB : userA;
    const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_a', a)
        .eq('user_b', b)
        .maybeSingle();
    return data?.id || null;
}

// ══════════════════════════════════════════════════════════
//  FILE UPLOAD HELPER
// ══════════════════════════════════════════════════════════

async function sbUploadFile(file, folder = 'attachments') {
    const ext = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

    const { data, error } = await supabase.storage
        .from('uploads')
        .upload(fileName, file, { upsert: false });
    if (error) throw error;

    const { data: urlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(data.path);

    return {
        file_path: urlData.publicUrl,
        file_type: file.type.startsWith('image') ? 'image'
                 : file.type.startsWith('video') ? 'video'
                 : file.type.startsWith('audio') ? 'audio'
                 : 'file',
        original_name: file.name,
    };
}

// Upload with progress tracking (uses XMLHttpRequest for progress)
function sbUploadFileWithProgress(file, folder = 'attachments') {
    return new Promise(async (resolve, reject) => {
        const ext = file.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

        const session = await sbGetSession();
        if (!session) return reject(new Error('Not authenticated'));

        const progressBar = document.getElementById('upload-progress-bar');
        const progressFill = document.getElementById('upload-progress-fill');
        const progressText = document.getElementById('upload-progress-text');
        if (progressBar) progressBar.classList.remove('hidden');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/uploads/${fileName}`);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('x-upsert', 'false');

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && progressFill && progressText) {
                const pct = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = pct + '%';
                progressText.textContent = `Uploading… ${pct}%`;
            }
        };

        xhr.onload = () => {
            if (progressBar) setTimeout(() => progressBar.classList.add('hidden'), 1000);
            if (xhr.status >= 200 && xhr.status < 300) {
                const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
                resolve({
                    file_path: urlData.publicUrl,
                    file_type: file.type.startsWith('image') ? 'image'
                             : file.type.startsWith('video') ? 'video'
                             : file.type.startsWith('audio') ? 'audio'
                             : 'file',
                    original_name: file.name,
                });
            } else {
                reject(new Error('Upload failed'));
            }
        };

        xhr.onerror = () => {
            if (progressBar) progressBar.classList.add('hidden');
            reject(new Error('Upload failed'));
        };

        xhr.send(file);
    });
}
