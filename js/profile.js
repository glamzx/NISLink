/**
 * NIS Alumni — Profile Page JavaScript
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

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = '0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ── Current user (for like/comment/follow) ──────────────────
let currentUser = null;

async function checkSession() {
    try {
        const res = await fetch('/api/session.php');
        const data = await res.json();
        if (data.logged_in) {
            currentUser = data;
        }
    } catch { }
}

// ── Get user ID from URL query string ───────────────────────
function getUserIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// ── Load profile data and fill the page ─────────────────────
async function loadProfile() {
    const userId = getUserIdFromURL();
    const url = userId ? `/api/profile.php?id=${userId}` : '/api/profile.php';

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success || !data.profile) {
            showToast('Could not load profile.', 'error');
            return;
        }

        const p = data.profile;
        const profileId = p.id;

        // Fill display elements
        setTextById('profile-name', p.full_name || 'NIS Alumni');
        setTextById('profile-branch', p.nis_branch ? `NIS ${p.nis_branch}` : '');
        setTextById('profile-year', p.graduation_year ? `Class of ${p.graduation_year}` : '');
        setTextById('profile-university', p.university || '—');
        setTextById('profile-degree', p.degree_major || '—');
        setTextById('profile-bio', p.bio || 'No bio yet.');
        setTextById('profile-email', p.email || '—');

        // Avatar
        const avatarEl = document.getElementById('profile-avatar');
        if (avatarEl && p.avatar_url) {
            avatarEl.src = p.avatar_url;
        }

        // Cover image
        const coverEl = document.getElementById('profile-cover');
        if (coverEl && p.cover_url) {
            coverEl.style.backgroundImage = `url('${p.cover_url}')`;
        }

        // Social links
        setSocialLink('link-linkedin', p.linkedin);
        setSocialLink('link-instagram', p.instagram);
        setSocialLink('link-youtube', p.youtube);

        // Load follower/following counts
        loadFollowData(profileId);

        // Load posts
        loadProfilePosts(profileId);

        // Follow button (only for other users)
        if (currentUser && currentUser.user_id != profileId) {
            const followWrap = document.getElementById('profile-follow-wrap');
            followWrap?.classList.remove('hidden');
            loadFollowButton(profileId);
        }

    } catch (err) {
        showToast('Network error loading profile.', 'error');
    }
}

// ── Follower/Following data ─────────────────────────────────
async function loadFollowData(userId) {
    try {
        const res = await fetch(`/api/subscriptions.php?user_id=${userId}`);
        const data = await res.json();
        if (data.success) {
            setTextById('profile-follower-count', data.follower_count);
            setTextById('profile-following-count', data.following_count);
        }
    } catch { }
}

// ── Follow button ───────────────────────────────────────────
async function loadFollowButton(userId) {
    try {
        const res = await fetch(`/api/subscriptions.php?user_id=${userId}`);
        const data = await res.json();
        const btn = document.getElementById('profile-follow-btn');
        const msgBtn = document.getElementById('profile-msg-btn');
        if (!btn) return;
        btn.dataset.userId = userId;

        if (data.i_follow) {
            const label = data.is_mutual ? '✓ Mutual' : 'Following';
            btn.textContent = label;
            btn.className = 'follow-btn following px-6 py-2.5 rounded-full text-sm font-semibold transition bg-gray-100 text-gray-600';
            btn.dataset.following = '1';
            btn.dataset.label = label;
            if (msgBtn) msgBtn.classList.remove('hidden');
        } else {
            btn.textContent = 'Follow';
            btn.className = 'follow-btn px-6 py-2.5 rounded-full text-sm font-semibold transition bg-navy text-white hover:bg-navy-light';
            btn.dataset.following = '0';
            btn.dataset.label = 'Follow';
            if (msgBtn) msgBtn.classList.add('hidden');
        }

        btn.onclick = () => toggleFollow(userId, btn);
    } catch { }
}

// Follow button hover: swap text to "Unfollow"
document.getElementById('profile-follow-btn')?.addEventListener('mouseenter', function () {
    if (this.dataset.following === '1') {
        this.textContent = 'Unfollow';
    }
});
document.getElementById('profile-follow-btn')?.addEventListener('mouseleave', function () {
    if (this.dataset.following === '1') {
        this.textContent = this.dataset.label || 'Following';
    }
});

async function toggleFollow(userId, btn) {
    const isFollowing = btn.dataset.following === '1';
    try {
        if (isFollowing) {
            await fetch('/api/subscriptions.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: parseInt(userId) }),
            });
        } else {
            await fetch('/api/subscriptions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: parseInt(userId) }),
            });
        }
        loadFollowButton(userId);
        loadFollowData(userId);
    } catch { }
}

// ── Followers/Following list modal ──────────────────────────
async function showFollowListStandalone(type) {
    const modal = document.getElementById('follow-list-modal');
    const title = document.getElementById('follow-list-title');
    const body = document.getElementById('follow-list-body');
    if (!modal) return;
    modal.classList.remove('hidden');
    title.textContent = type === 'followers' ? 'Followers' : 'Following';
    body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Loading…</div>';

    const userId = getUserIdFromURL() || (currentUser?.user_id);
    try {
        const res = await fetch(`/api/subscriptions.php?list=${type}&user_id=${userId}`);
        const data = await res.json();
        if (!data.users?.length) {
            body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">No ' + type + ' yet.</div>';
            return;
        }
        body.innerHTML = '';
        data.users.forEach(u => {
            const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
            const div = document.createElement('div');
            div.className = 'flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition';
            div.onclick = () => { window.location.href = `profile.html?id=${u.id}`; };
            div.innerHTML = `
                <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover" />
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-sm text-navy truncate">${u.full_name}</p>
                    <p class="text-xs text-gray-400 truncate">${u.username ? '@' + u.username : (u.nis_branch || '')}</p>
                </div>
            `;
            body.appendChild(div);
        });
    } catch { }
}

function closeFollowListModal() {
    document.getElementById('follow-list-modal')?.classList.add('hidden');
}

// ── Posts ────────────────────────────────────────────────────
async function loadProfilePosts(userId) {
    try {
        const res = await fetch(`/api/posts.php?user_id=${userId}`);
        const data = await res.json();
        const container = document.getElementById('profile-posts');
        if (!container) return;
        container.innerHTML = '';

        // Update post count
        setTextById('profile-post-count', data.total || 0);

        if (!data.posts?.length) {
            container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No posts yet.</div>';
            return;
        }

        data.posts.forEach(post => container.appendChild(createPostCard(post)));
        lucide.createIcons();
    } catch { }
}

function createPostCard(post) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-2xl border border-gray-200 p-5 shadow-sm';
    div.dataset.postId = post.id;

    const avatarUrl = post.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.full_name)}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
    const timeAgo = formatTimeAgo(post.created_at);
    const likeCount = parseInt(post.like_count) || 0;
    const commentCount = parseInt(post.comment_count) || 0;
    const isLiked = parseInt(post.is_liked) > 0;

    let attachHtml = '';
    if (post.attachments?.length) {
        attachHtml = '<div class="flex flex-wrap gap-2 mt-3">' +
            post.attachments.map(att => {
                if (att.file_type === 'image') {
                    return `<img src="${att.file_path}" class="rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition" onclick="window.open('${att.file_path}','_blank')" />`;
                }
                return `<a href="${att.file_path}" target="_blank" class="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-200 transition">📎 ${att.original_name || 'File'}</a>`;
            }).join('') + '</div>';
    }

    div.innerHTML = `
    <div class="flex items-start gap-3">
      <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm text-navy">${escHtml(post.full_name)}</span>
          <span class="text-xs text-gray-400">${post.nis_branch || ''}</span>
          <span class="text-xs text-gray-300">·</span>
          <span class="text-xs text-gray-400">${timeAgo}</span>
        </div>
        <p class="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">${escHtml(post.content)}</p>
        ${attachHtml}
        
        <!-- Like / Comment action bar -->
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

        <!-- Comments section (hidden by default) -->
        <div id="comments-${post.id}" class="comments-section hidden mt-3">
          <div class="comments-list space-y-3"></div>
          <div class="flex items-center gap-2 mt-3">
            <input type="text" class="comment-input flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-accent/30" placeholder="Write a comment…" onkeydown="if(event.key==='Enter')addComment(${post.id}, this)" />
            <button onclick="addComment(${post.id}, this.previousElementSibling)" class="text-sm text-navy font-semibold hover:text-accent transition px-3 py-2">Post</button>
          </div>
        </div>
      </div>
    </div>
  `;
    return div;
}

// ── Like / Comment functions ────────────────────────────────
async function toggleLike(postId, btn) {
    if (!currentUser) { showToast('Please log in to like posts.', 'error'); return; }
    try {
        const res = await fetch('/api/likes.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId }),
        });
        const data = await res.json();
        if (!data.success) return;

        const countEl = btn.querySelector('.like-count');
        const iconEl = btn.querySelector('[data-lucide]');
        countEl.textContent = data.like_count || '';

        if (data.is_liked) {
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-red-500');
            iconEl.classList.add('fill-red-500');
        } else {
            btn.classList.add('text-gray-400');
            btn.classList.remove('text-red-500');
            iconEl.classList.remove('fill-red-500');
        }
    } catch { }
}

function toggleCommentSection(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        loadComments(postId);
    } else {
        section.classList.add('hidden');
    }
}

async function loadComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;
    const list = section.querySelector('.comments-list');

    try {
        const res = await fetch(`/api/comments.php?post_id=${postId}`);
        const data = await res.json();
        if (!data.success) return;

        list.innerHTML = '';
        if (data.comments.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-400 py-2">No comments yet.</p>';
            return;
        }

        data.comments.forEach(c => {
            const cAvatarUrl = c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.full_name)}&background=C8FF00&color=0B1D3A&size=28&bold=true&font-size=0.45`;
            const deleteHtml = (currentUser && c.user_id == currentUser.user_id)
                ? `<button onclick="deleteComment(${c.id}, ${postId})" class="text-gray-300 hover:text-red-500 transition ml-auto shrink-0"><i data-lucide="x" class="w-3 h-3"></i></button>`
                : '';

            const commentDiv = document.createElement('div');
            commentDiv.className = 'flex items-start gap-2 p-2 rounded-lg bg-gray-50';
            commentDiv.innerHTML = `
                <img src="${cAvatarUrl}" class="w-7 h-7 rounded-full object-cover shrink-0" />
                <div class="flex-1 min-w-0">
                    <span class="font-semibold text-xs text-navy">${escHtml(c.full_name)}</span>
                    <span class="text-xs text-gray-400 ml-1">${formatTimeAgo(c.created_at)}</span>
                    <p class="text-sm text-gray-700 mt-0.5">${escHtml(c.content)}</p>
                </div>
                ${deleteHtml}
            `;
            list.appendChild(commentDiv);
        });

        lucide.createIcons();
    } catch { }
}

async function addComment(postId, inputEl) {
    if (!currentUser) { showToast('Please log in to comment.', 'error'); return; }
    const content = inputEl.value.trim();
    if (!content) return;

    try {
        const res = await fetch('/api/comments.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId, content }),
        });
        const data = await res.json();
        if (data.success) {
            inputEl.value = '';
            loadComments(postId);
            const postCard = document.querySelector(`[data-post-id="${postId}"]`);
            if (postCard) {
                const countEl = postCard.querySelector('.comment-count');
                if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1;
            }
        }
    } catch { }
}

async function deleteComment(commentId, postId) {
    if (!confirm('Delete this comment?')) return;
    try {
        const res = await fetch(`/api/comments.php?id=${commentId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            loadComments(postId);
            const postCard = document.querySelector(`[data-post-id="${postId}"]`);
            if (postCard) {
                const countEl = postCard.querySelector('.comment-count');
                const curr = parseInt(countEl.textContent || '1');
                countEl.textContent = curr > 1 ? curr - 1 : '';
            }
        }
    } catch { }
}

// ── Helpers ──────────────────────────────────────────────────
function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
}

function setSocialLink(id, url) {
    const el = document.getElementById(id);
    if (el) {
        if (url) {
            el.href = url.startsWith('http') ? url : `https://${url}`;
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    }
}

function escHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function formatTimeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    loadProfile();
});
