/**
 * NIS Connect — Profile Page JavaScript (Supabase)
 * Loads profile data, followers, posts with likes/comments for the standalone profile page.
 */

// ── Toast helper ────────────────────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-10px)'; toast.style.transition = '0.3s ease'; setTimeout(() => toast.remove(), 300); }, 3500);
}

let currentUser = null;

async function checkSession() {
    try {
        const session = await sbGetSession();
        if (session) {
            const profile = await sbGetProfile(session.user.id);
            currentUser = { user_id: session.user.id, full_name: profile.full_name, avatar_url: profile.avatar_url };
        }
    } catch { }
}

function getUserIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

async function loadProfile() {
    const userId = getUserIdFromURL() || currentUser?.user_id;
    if (!userId) return;
    try {
        const p = await sbGetProfile(userId);
        setTextById('profile-name', p.full_name || 'NIS Alumni');
        setTextById('profile-branch', p.nis_branch ? `NIS ${p.nis_branch}` : '');
        setTextById('profile-year', p.graduation_year ? `Class of ${p.graduation_year}` : '');
        setTextById('profile-university', p.university || '—');
        setTextById('profile-degree', p.degree_major || '—');
        setTextById('profile-bio', p.bio || 'No bio yet.');
        setTextById('profile-email', p.email || '—');

        const avatarEl = document.getElementById('profile-avatar');
        if (avatarEl && p.avatar_url) avatarEl.src = p.avatar_url;

        const coverEl = document.getElementById('profile-cover');
        if (coverEl && p.cover_url) coverEl.style.backgroundImage = `url('${p.cover_url}')`;

        setSocialLink('link-linkedin', p.linkedin);
        setSocialLink('link-instagram', p.instagram);
        setSocialLink('link-youtube', p.youtube);

        loadFollowData(userId);
        loadProfilePosts(userId);

        if (currentUser && currentUser.user_id !== userId) {
            document.getElementById('profile-follow-wrap')?.classList.remove('hidden');
            loadFollowButton(userId);
        }
    } catch { showToast('Network error loading profile.', 'error'); }
}

async function loadFollowData(userId) {
    try {
        const data = await sbGetFollowStatus(currentUser?.user_id || userId, userId);
        setTextById('profile-follower-count', data.follower_count);
        setTextById('profile-following-count', data.following_count);
    } catch { }
}

async function loadFollowButton(userId) {
    try {
        const data = await sbGetFollowStatus(currentUser.user_id, userId);
        const btn = document.getElementById('profile-follow-btn');
        const msgBtn = document.getElementById('profile-msg-btn');
        if (!btn) return;
        btn.dataset.userId = userId;
        if (data.i_follow) {
            const label = data.is_mutual ? '✓ Mutual' : 'Following';
            btn.textContent = label;
            btn.className = 'follow-btn following px-6 py-2.5 rounded-full text-sm font-semibold transition bg-gray-100 text-gray-600';
            btn.dataset.following = '1'; btn.dataset.label = label;
            if (msgBtn) msgBtn.classList.remove('hidden');
        } else {
            btn.textContent = 'Follow';
            btn.className = 'follow-btn px-6 py-2.5 rounded-full text-sm font-semibold transition bg-navy text-white hover:bg-navy-light';
            btn.dataset.following = '0'; btn.dataset.label = 'Follow';
            if (msgBtn) msgBtn.classList.add('hidden');
        }
        btn.onclick = () => toggleFollow(userId, btn);
    } catch { }
}

document.getElementById('profile-follow-btn')?.addEventListener('mouseenter', function () { if (this.dataset.following === '1') this.textContent = 'Unfollow'; });
document.getElementById('profile-follow-btn')?.addEventListener('mouseleave', function () { if (this.dataset.following === '1') this.textContent = this.dataset.label || 'Following'; });

async function toggleFollow(userId, btn) {
    const isFollowing = btn.dataset.following === '1';
    try {
        if (isFollowing) await sbUnfollow(currentUser.user_id, userId);
        else await sbFollow(currentUser.user_id, userId);
        loadFollowButton(userId); loadFollowData(userId);
    } catch { }
}

async function showFollowListStandalone(type) {
    const modal = document.getElementById('follow-list-modal');
    const title = document.getElementById('follow-list-title');
    const body = document.getElementById('follow-list-body');
    if (!modal) return;
    modal.classList.remove('hidden');
    title.textContent = type === 'followers' ? 'Followers' : 'Following';
    body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Loading…</div>';
    const userId = getUserIdFromURL() || currentUser?.user_id;
    try {
        const users = await sbGetFollowList(userId, type);
        if (!users?.length) { body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">No ' + type + ' yet.</div>'; return; }
        body.innerHTML = '';
        users.forEach(u => {
            const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
            const div = document.createElement('div');
            div.className = 'flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition';
            div.onclick = () => { window.location.href = `profile.html?id=${u.id}`; };
            div.innerHTML = `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover" /><div class="flex-1 min-w-0"><p class="font-semibold text-sm text-navy truncate">${u.full_name}</p><p class="text-xs text-gray-400 truncate">${u.username ? '@' + u.username : (u.nis_branch || '')}</p></div>`;
            body.appendChild(div);
        });
    } catch { }
}

function closeFollowListModal() { document.getElementById('follow-list-modal')?.classList.add('hidden'); }

async function loadProfilePosts(userId) {
    try {
        const posts = await sbGetUserPosts(userId);
        const container = document.getElementById('profile-posts');
        if (!container) return;
        container.innerHTML = '';
        setTextById('profile-post-count', posts.length);
        if (!posts.length) { container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No posts yet.</div>'; return; }
        posts.forEach(post => container.appendChild(createPostCard(post)));
        lucide.createIcons();
    } catch { }
}

function createPostCard(post) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-2xl border border-gray-200 p-5 shadow-sm';
    div.dataset.postId = post.id;
    const p = post.profiles || {};
    const avatarUrl = p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'U')}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
    const timeAgo = formatTimeAgo(post.created_at);
    const likeCount = post.post_likes?.length || 0;
    const commentCount = post.post_comments?.length || 0;
    const isLiked = currentUser && post.post_likes?.some(l => l.user_id === currentUser.user_id);
    let attachHtml = '';
    if (post.post_attachments?.length) {
        attachHtml = '<div class="flex flex-wrap gap-2 mt-3">' + post.post_attachments.map(att => {
            if (att.file_type === 'image') return `<img src="${att.file_path}" class="rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition" onclick="window.open('${att.file_path}','_blank')" />`;
            if (att.file_type === 'video') return `<div class="video-preview rounded-lg max-h-64 overflow-hidden" onclick="window.open('${att.file_path}','_blank')"><video src="${att.file_path}" class="rounded-lg max-h-64 object-cover" muted preload="metadata"></video><div class="play-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="#0B1D3A"><polygon points="5 3 19 12 5 21"></polygon></svg></div></div>`;
            return `<a href="${att.file_path}" target="_blank" class="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-200 transition">📎 ${att.original_name || 'File'}</a>`;
        }).join('') + '</div>';
    }
    div.innerHTML = `
    <div class="flex items-start gap-3">
      <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm text-navy">${escHtml(p.full_name)}</span>
          <span class="text-xs text-gray-400">${p.nis_branch || ''}</span>
          <span class="text-xs text-gray-300">·</span>
          <span class="text-xs text-gray-400">${timeAgo}</span>
        </div>
        <p class="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">${escHtml(post.content)}</p>
        ${attachHtml}
        <div class="flex items-center gap-5 mt-3 pt-3 border-t border-gray-100">
          <button onclick="toggleLike(${post.id}, this)" class="post-like-btn flex items-center gap-1.5 text-sm transition ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}" data-liked="${isLiked ? '1' : '0'}">
            <i data-lucide="heart" class="w-4 h-4 ${isLiked ? 'fill-red-500' : ''}"></i>
            <span class="like-count">${likeCount || ''}</span>
          </button>
          <button onclick="toggleCommentSection(${post.id})" class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy transition">
            <i data-lucide="message-circle" class="w-4 h-4"></i>
            <span class="comment-count">${commentCount || ''}</span>
          </button>
        </div>
        <div id="comments-${post.id}" class="comments-section hidden mt-3">
          <div class="comments-list space-y-3"></div>
          <div class="flex items-center gap-2 mt-3">
            <input type="text" class="comment-input flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-accent/30" placeholder="Write a comment…" onkeydown="if(event.key==='Enter')addComment(${post.id}, this)" />
            <button onclick="addComment(${post.id}, this.previousElementSibling)" class="text-sm text-navy font-semibold hover:text-accent transition px-3 py-2">Post</button>
          </div>
        </div>
      </div>
    </div>`;
    return div;
}

async function toggleLike(postId, btn) {
    if (!currentUser) { showToast('Please log in to like posts.', 'error'); return; }
    try {
        const result = await sbToggleLike(postId, currentUser.user_id);
        const countEl = btn.querySelector('.like-count');
        const iconEl = btn.querySelector('[data-lucide]');
        const { count } = await supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
        countEl.textContent = count || '';
        if (result.liked) { btn.classList.remove('text-gray-400'); btn.classList.add('text-red-500'); iconEl.classList.add('fill-red-500'); }
        else { btn.classList.add('text-gray-400'); btn.classList.remove('text-red-500'); iconEl.classList.remove('fill-red-500'); }
    } catch { }
}

function toggleCommentSection(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;
    if (section.classList.contains('hidden')) { section.classList.remove('hidden'); loadComments(postId); } else { section.classList.add('hidden'); }
}

async function loadComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;
    const list = section.querySelector('.comments-list');
    try {
        const comments = await sbGetComments(postId);
        list.innerHTML = '';
        if (!comments.length) { list.innerHTML = '<p class="text-xs text-gray-400 py-2">No comments yet.</p>'; return; }
        comments.forEach(c => {
            const cp = c.profiles || {};
            const cAvatarUrl = cp.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(cp.full_name || 'U')}&background=C8FF00&color=0B1D3A&size=28&bold=true&font-size=0.45`;
            const deleteHtml = (currentUser && c.user_id === currentUser.user_id) ? `<button onclick="deleteComment(${c.id}, ${postId})" class="text-gray-300 hover:text-red-500 transition ml-auto shrink-0"><i data-lucide="x" class="w-3 h-3"></i></button>` : '';
            const commentDiv = document.createElement('div');
            commentDiv.className = 'flex items-start gap-2 p-2 rounded-lg bg-gray-50';
            commentDiv.innerHTML = `<img src="${cAvatarUrl}" class="w-7 h-7 rounded-full object-cover shrink-0" /><div class="flex-1 min-w-0"><span class="font-semibold text-xs text-navy">${escHtml(cp.full_name)}</span><span class="text-xs text-gray-400 ml-1">${formatTimeAgo(c.created_at)}</span><p class="text-sm text-gray-700 mt-0.5">${escHtml(c.content)}</p></div>${deleteHtml}`;
            list.appendChild(commentDiv);
        });
        lucide.createIcons();
    } catch { }
}

async function addComment(postId, inputEl) {
    if (!currentUser) { showToast('Please log in to comment.', 'error'); return; }
    const content = inputEl.value.trim(); if (!content) return;
    try {
        await sbAddComment(postId, currentUser.user_id, content);
        inputEl.value = ''; loadComments(postId);
        const postCard = document.querySelector(`[data-post-id="${postId}"]`);
        if (postCard) { const countEl = postCard.querySelector('.comment-count'); if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1; }
    } catch { }
}

async function deleteComment(commentId, postId) {
    if (!confirm('Delete this comment?')) return;
    try {
        await sbDeleteComment(commentId); loadComments(postId);
        const postCard = document.querySelector(`[data-post-id="${postId}"]`);
        if (postCard) { const countEl = postCard.querySelector('.comment-count'); const curr = parseInt(countEl.textContent || '1'); countEl.textContent = curr > 1 ? curr - 1 : ''; }
    } catch { }
}

function setTextById(id, text) { const el = document.getElementById(id); if (el) el.textContent = text || ''; }
function setSocialLink(id, url) { const el = document.getElementById(id); if (el) { if (url) { el.href = url.startsWith('http') ? url : `https://${url}`; el.style.display = ''; } else { el.style.display = 'none'; } } }
function escHtml(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function formatTimeAgo(dateStr) { const d = new Date(dateStr); const now = new Date(); const diff = Math.floor((now - d) / 1000); if (diff < 60) return 'just now'; if (diff < 3600) return `${Math.floor(diff / 60)}m ago`; if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`; if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

document.addEventListener('DOMContentLoaded', async () => { await checkSession(); loadProfile(); });
