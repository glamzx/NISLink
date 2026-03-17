/**
 * NIS Connect — Supabase Client
 * Central config + helper functions for all Supabase operations.
 * NOTE: We use 'supabaseClient' (not 'supabase') because
 * the UMD bundle already creates a global 'var supabase'.
 */

// ══════════════════════════════════════════════════════════
//  SUPABASE CONFIG
// ══════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://cycemjhtxvcigrhrnvaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5Y2Vtamh0eHZjaWdyaHJudmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjA4MTAsImV4cCI6MjA4ODc5NjgxMH0.c3ltBmWmkgDE0c2HfHPwwyAOIclZPX8p05YecPRUnyY';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ══════════════════════════════════════════════════════════
//  AUTH HELPERS
// ══════════════════════════════════════════════════════════

async function sbSignUp(email, password, fullName, username) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName, username },
            emailRedirectTo: window.location.origin + '/NISConnect/verify.html',
        },
    });
    if (error) throw error;
    return data;
}

async function sbSignIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

async function sbSignOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
}

async function sbGetSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

async function sbGetUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

// ══════════════════════════════════════════════════════════
//  PROFILE HELPERS
// ══════════════════════════════════════════════════════════

async function sbGetProfile(userId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data;
}

async function sbUpdateProfile(userId, updates) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function sbCheckUsername(username) {
    const { data, error } = await supabaseClient
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
    // Try with all columns — uses * to gracefully handle missing columns
    const { data, error } = await supabaseClient
        .from('posts')
        .select(`
            *,
            profiles!posts_user_id_fkey ( full_name, avatar_url, nis_branch, username ),
            post_attachments ( id, file_path, file_type, original_name ),
            post_likes ( id, user_id ),
            post_comments ( id ),
            post_views ( id, viewer_id ),
            reposts ( id, user_id, repost_text )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) {
        // Fallback without post_views/reposts if tables don't exist
        const res = await supabaseClient.from('posts').select(`
            *,
            profiles!posts_user_id_fkey ( full_name, avatar_url, nis_branch, username ),
            post_attachments ( id, file_path, file_type, original_name ),
            post_likes ( id, user_id ),
            post_comments ( id )
        `).order('created_at', { ascending: false }).limit(50);
        if (res.error) throw res.error;
        return await sbEnrichPostsWithOriginals(res.data || []);
    }
    return await sbEnrichPostsWithOriginals(data || []);
}

// Enrich posts that are reposts with original post data, and wall posts with wall profile
async function sbEnrichPostsWithOriginals(posts) {
    // Collect original post IDs
    const originalIds = posts.filter(p => p.original_post_id).map(p => p.original_post_id);
    // Collect wall user IDs
    const wallUserIds = posts.filter(p => p.wall_user_id).map(p => p.wall_user_id);
    
    // Fetch original posts in one batch
    let originals = {};
    if (originalIds.length) {
        const { data } = await supabaseClient.from('posts').select(`
            id, content, created_at, user_id,
            profiles!posts_user_id_fkey ( full_name, avatar_url, nis_branch, username ),
            post_attachments ( id, file_path, file_type, original_name )
        `).in('id', originalIds);
        if (data) data.forEach(op => originals[op.id] = op);
    }
    
    // Fetch wall profiles in one batch
    let wallProfiles = {};
    if (wallUserIds.length) {
        const { data } = await supabaseClient.from('profiles').select('id, full_name, avatar_url, username').in('id', wallUserIds);
        if (data) data.forEach(wp => wallProfiles[wp.id] = wp);
    }
    
    // Attach to posts
    posts.forEach(p => {
        if (p.original_post_id && originals[p.original_post_id]) {
            p._originalPost = originals[p.original_post_id];
        }
        if (p.wall_user_id && wallProfiles[p.wall_user_id]) {
            p.wall_profile = wallProfiles[p.wall_user_id];
        }
    });
    return posts;
}

async function sbGetUserPosts(userId) {
    let { data, error } = await supabaseClient
        .from('posts')
        .select(`
            *,
            profiles!posts_user_id_fkey ( full_name, avatar_url, nis_branch, username ),
            post_attachments ( id, file_path, file_type, original_name ),
            post_likes ( id, user_id ),
            post_comments ( id ),
            post_views ( id, viewer_id ),
            reposts ( id, user_id, repost_text )
        `)
        .or(`user_id.eq.${userId},wall_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });
    if (error) {
        // Fallback without newer tables
        const res = await supabaseClient.from('posts').select(`
            *,
            profiles!posts_user_id_fkey ( full_name, avatar_url, nis_branch, username ),
            post_attachments ( id, file_path, file_type, original_name ),
            post_likes ( id, user_id ),
            post_comments ( id )
        `).or(`user_id.eq.${userId},wall_user_id.eq.${userId}`).order('created_at', { ascending: false });
        if (res.error) throw res.error;
        data = res.data;
    }
    return await sbEnrichPostsWithOriginals(data || []);
}

async function sbCreatePost(userId, content, mediaUrls, wallUserId, originalPostId) {
    const postData = { user_id: userId, content };
    if (wallUserId) postData.wall_user_id = wallUserId;
    if (originalPostId) postData.original_post_id = originalPostId;
    const { data, error } = await supabaseClient
        .from('posts')
        .insert(postData)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function sbDeletePost(postId) {
    const { error } = await supabaseClient
        .from('posts')
        .delete()
        .eq('id', postId);
    if (error) throw error;
}

async function sbAddAttachment(postId, filePath, fileType, originalName) {
    const { data, error } = await supabaseClient
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
    const { data: existing } = await supabaseClient
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existing) {
        await supabaseClient.from('post_likes').delete().eq('id', existing.id);
        return { liked: false };
    } else {
        await supabaseClient.from('post_likes').insert({ post_id: postId, user_id: userId });
        return { liked: true };
    }
}

// ══════════════════════════════════════════════════════════
//  COMMENTS HELPERS
// ══════════════════════════════════════════════════════════

async function sbGetComments(postId) {
    const { data, error } = await supabaseClient
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
    const { data, error } = await supabaseClient
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
    const { error } = await supabaseClient
        .from('post_comments')
        .delete()
        .eq('id', commentId);
    if (error) throw error;
}

// ══════════════════════════════════════════════════════════
//  SUBSCRIPTIONS (FOLLOW) HELPERS
// ══════════════════════════════════════════════════════════

async function sbGetFollowStatus(currentUserId, targetUserId) {
    const { data: iFollow } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle();

    const { data: followsMe } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('follower_id', targetUserId)
        .eq('following_id', currentUserId)
        .maybeSingle();

    const { count: followerCount } = await supabaseClient
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', targetUserId);

    const { count: followingCount } = await supabaseClient
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
    const { error } = await supabaseClient
        .from('subscriptions')
        .insert({ follower_id: followerId, following_id: followingId });
    if (error) throw error;
}

async function sbUnfollow(followerId, followingId) {
    const { error } = await supabaseClient
        .from('subscriptions')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);
    if (error) throw error;
}

async function sbToggleFollow(followerId, followingId) {
    // Check if already following
    const { data: existing } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();
    if (existing) {
        await sbUnfollow(followerId, followingId);
        return { action: 'unfollowed' };
    } else {
        await sbFollow(followerId, followingId);
        return { action: 'followed' };
    }
}

async function sbGetFollowList(userId, type) {
    if (type === 'followers') {
        const { data, error } = await supabaseClient
            .from('subscriptions')
            .select('profiles!subscriptions_follower_id_fkey ( id, full_name, avatar_url, username, nis_branch )')
            .eq('following_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data.map(d => d.profiles);
    } else {
        const { data, error } = await supabaseClient
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
    const { data, error } = await supabaseClient
        .from('conversations')
        .select('*')
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .order('updated_at', { ascending: false });
    if (error) throw error;
    if (!data?.length) return [];

    // Batch: collect all other-user IDs and fetch profiles in one query
    const otherIds = [...new Set(data.map(c => c.user_a === userId ? c.user_b : c.user_a))];
    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('*')
        .in('id', otherIds);
    const profileMap = {};
    (profiles || []).forEach(p => profileMap[p.id] = p);

    // Batch: fetch last message per conversation in one query
    // Get all conv IDs and fetch latest messages
    const convIds = data.map(c => c.id);
    const { data: allMsgs } = await supabaseClient
        .from('messages')
        .select('conversation_id, content, attachment_type, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });

    // Group by conversation, take first (newest) per conv
    const lastMsgMap = {};
    (allMsgs || []).forEach(m => {
        if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m;
    });

    return data.map(conv => {
        const otherId = conv.user_a === userId ? conv.user_b : conv.user_a;
        return {
            conv_id: conv.id,
            other_user: profileMap[otherId] || { full_name: 'User', id: otherId },
            last_message: lastMsgMap[conv.id] || null,
            updated_at: conv.updated_at,
        };
    });
}

async function sbGetMessages(userId, otherUserId) {
    const convId = await sbFindConversation(userId, otherUserId);
    const otherUser = await sbGetProfile(otherUserId);

    if (!convId) {
        return { messages: [], other_user: otherUser };
    }

    const { data, error } = await supabaseClient
        .from('messages')
        .select(`
            id, sender_id, content, attachment_path, attachment_type, created_at, read_at, edited_at,
            profiles!messages_sender_id_fkey ( full_name, avatar_url )
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(200);
    if (error) throw error;

    // Mark received (not mine) unread messages as read
    const unreadIds = (data || []).filter(m => m.sender_id !== userId && !m.read_at).map(m => m.id);
    if (unreadIds.length) {
        supabaseClient.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds).then(() => {});
    }

    return { messages: data, other_user: otherUser };
}

async function sbSendMessage(userId, recipientId, content, attachmentPath, attachmentType) {
    let convId = await sbFindConversation(userId, recipientId);

    if (!convId) {
        const a = userId < recipientId ? userId : recipientId;
        const b = userId < recipientId ? recipientId : userId;
        const { data, error } = await supabaseClient
            .from('conversations')
            .insert({ user_a: a, user_b: b })
            .select()
            .single();
        if (error) throw error;
        convId = data.id;
    }

    const { data: msg, error: msgErr } = await supabaseClient
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

    await supabaseClient.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);

    return msg;
}

async function sbFindConversation(userA, userB) {
    const a = userA < userB ? userA : userB;
    const b = userA < userB ? userB : userA;
    const { data } = await supabaseClient
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

async function sbUploadFile(file, folder) {
    folder = folder || 'attachments';
    var ext = file.name.split('.').pop();
    var fileName = folder + '/' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.' + ext;

    var result = await supabaseClient.storage
        .from('uploads')
        .upload(fileName, file, { upsert: false });
    if (result.error) throw result.error;

    var urlData = supabaseClient.storage
        .from('uploads')
        .getPublicUrl(result.data.path);

    return {
        file_path: urlData.data.publicUrl,
        file_type: file.type.startsWith('image') ? 'image'
                 : file.type.startsWith('video') ? 'video'
                 : file.type.startsWith('audio') ? 'audio'
                 : 'file',
        original_name: file.name,
    };
}

// Upload with progress tracking
function sbUploadFileWithProgress(file, folder) {
    folder = folder || 'attachments';
    return new Promise(function(resolve, reject) {
        var ext = file.name.split('.').pop();
        var fileName = folder + '/' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.' + ext;

        sbGetSession().then(function(session) {
            if (!session) return reject(new Error('Not authenticated'));

            var progressBar = document.getElementById('upload-progress-bar');
            var progressFill = document.getElementById('upload-progress-fill');
            var progressText = document.getElementById('upload-progress-text');
            if (progressBar) progressBar.classList.remove('hidden');

            var xhr = new XMLHttpRequest();
            xhr.open('POST', SUPABASE_URL + '/storage/v1/object/uploads/' + fileName);
            xhr.setRequestHeader('Authorization', 'Bearer ' + session.access_token);
            xhr.setRequestHeader('x-upsert', 'false');

            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable && progressFill && progressText) {
                    var pct = Math.round((e.loaded / e.total) * 100);
                    progressFill.style.width = pct + '%';
                    progressText.textContent = 'Uploading… ' + pct + '%';
                }
            };

            xhr.onload = function() {
                if (progressBar) setTimeout(function() { progressBar.classList.add('hidden'); }, 1000);
                if (xhr.status >= 200 && xhr.status < 300) {
                    var urlData = supabaseClient.storage.from('uploads').getPublicUrl(fileName);
                    resolve({
                        file_path: urlData.data.publicUrl,
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

            xhr.onerror = function() {
                if (progressBar) progressBar.classList.add('hidden');
                reject(new Error('Upload failed'));
            };

            xhr.send(file);
        });
    });
}

// ══════════════════════════════════════════════════════════
//  READ RECEIPTS
// ══════════════════════════════════════════════════════════

async function sbMarkMessagesRead(conversationId, userId) {
    const { error } = await supabaseClient
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .is('read_at', null);
    if (error) console.error('[NIS] markRead error:', error);
    return !error;
}

/**
 * Mark ALL unread messages as read across all conversations.
 * Used by "Mark all as read" button in chat sidebar.
 */
async function sbMarkAllMessagesRead(userId) {
    try {
        // Get all my conversations
        const { data: convs } = await supabaseClient.from('conversations')
            .select('id')
            .or(`user_a.eq.${userId},user_b.eq.${userId}`);
        if (!convs?.length) return;
        const convIds = convs.map(c => c.id);
        // Mark all messages in those conversations as read
        const { error } = await supabaseClient.from('messages')
            .update({ read_at: new Date().toISOString() })
            .in('conversation_id', convIds)
            .neq('sender_id', userId)
            .is('read_at', null);
        if (error) console.error('[NIS] markAllRead error:', error);
        return !error;
    } catch(e) { console.error('[NIS] markAllRead exception:', e); return false; }
}

// ══════════════════════════════════════════════════════════
//  OPPORTUNITIES HELPERS
// ══════════════════════════════════════════════════════════

async function sbGetOpportunities(category, search) {
    // Try with profile join first, fallback to plain query
    let query = supabaseClient
        .from('opportunities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (category && category !== 'all') {
        query = query.eq('category', category);
    }
    if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,stack.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with profile data
    const userIds = [...new Set((data || []).map(o => o.user_id).filter(Boolean))];
    let profileMap = {};
    if (userIds.length) {
        const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, full_name, avatar_url, nis_branch, graduation_year, username')
            .in('id', userIds);
        if (profiles) profiles.forEach(p => profileMap[p.id] = p);
    }
    (data || []).forEach(opp => { opp.profiles = profileMap[opp.user_id] || null; });
    return data || [];
}

async function sbCreateOpportunity(oppData) {
    const { data, error } = await supabaseClient
        .from('opportunities')
        .insert(oppData)
        .select('*')
        .single();
    if (error) throw error;
    // Enrich with profile
    try {
        const profile = await sbGetProfile(data.user_id);
        data.profiles = profile;
    } catch {}
    return data;
}

async function sbUpdateOpportunity(id, oppData) {
    const { data, error } = await supabaseClient
        .from('opportunities')
        .update(oppData)
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

async function sbDeleteOpportunity(id) {
    const { error } = await supabaseClient
        .from('opportunities')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

