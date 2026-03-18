/**
 * NIS Connect — Dashboard JavaScript (Supabase)
 * Powers: navigation, feed, alumni, profile, settings, chat.
 */

// ── State ──────────────────────────────────────────────────
let currentSection = 'feed';
let currentUser = null;
let currentProfileUserId = null;
let profileUserId = null;
let pendingFiles = [];

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    setupAvatarDropdown();
    setupPostComposer();
    setupSettings();
    setupAvatarUpload();
    setupSearch();
    updateOnlineStatus();
    // Check for ?profile=username URL param
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('profile');
    if (profileUsername) {
        try {
            const { data } = await supabaseClient.from('profiles').select('id').eq('username', profileUsername).single();
            if (data) { navigateTo('profile', data.id); return; }
        } catch { }
    }
    const hash = location.hash.replace('#', '') || 'feed';
    navigateTo(hash);
});

// ── Session Check (Supabase) ───────────────────────────────
async function checkSession() {
    try {
        const session = await sbGetSession();
        if (!session) { window.location.href = 'login.html'; return; }
        const user = session.user;
        const profile = await sbGetProfile(user.id);
        currentUser = {
            user_id: user.id,
            full_name: profile.full_name || user.email,
            avatar_url: profile.avatar_url,
            email: user.email,
            username: profile.username,
        };
        updateNavAvatar(currentUser);
    } catch {
        window.location.href = 'login.html';
    }
}

function updateNavAvatar(user) {
    const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=C8FF00&color=0B1D3A&size=36&bold=true&font-size=0.45`;
    document.getElementById('nav-avatar').src = avatarUrl;
    document.getElementById('composer-avatar').src = avatarUrl;
    document.getElementById('dropdown-name').textContent = user.full_name;
}

// ── Logout (Supabase) ──────────────────────────────────────
async function logout() {
    await sbSignOut();
    window.location.href = 'login.html';
}

// ── Avatar Dropdown ────────────────────────────────────────
function setupAvatarDropdown() {
    const btn = document.getElementById('avatar-btn');
    const dropdown = document.getElementById('avatar-dropdown');
    btn?.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); });
    document.addEventListener('click', () => dropdown?.classList.add('hidden'));
}

// ── Navigation ─────────────────────────────────────────────
function navigateTo(section, userId) {
    // Stop chat polling when leaving the chat section
    if (currentSection === 'chat' && section !== 'chat') {
        if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
        currentChatUserId = null;
    }
    const currentEl = document.querySelector('.page-section:not(.hidden)');
    const targetEl = document.getElementById(`section-${section}`);
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.classList.remove('bg-accent/10', 'text-navy', '!text-navy');
        btn.classList.add('text-gray-600', 'text-gray-400');
    });
    document.querySelectorAll(`[data-nav="${section}"]`).forEach(btn => {
        btn.classList.add('bg-accent/10', '!text-navy');
        btn.classList.remove('text-gray-600', 'text-gray-400');
    });
    location.hash = section;
    currentSection = section;
    if (currentEl && targetEl && currentEl !== targetEl) {
        currentEl.classList.add('section-exit');
        setTimeout(() => {
            document.querySelectorAll('.page-section').forEach(s => { s.classList.add('hidden'); s.classList.remove('section-exit', 'section-enter'); });
            targetEl.classList.remove('hidden');
            targetEl.classList.add('section-enter');
            loadSectionData(section, userId);
            lucide.createIcons();
        }, 200);
    } else {
        document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
        if (targetEl) targetEl.classList.remove('hidden');
        loadSectionData(section, userId);
        lucide.createIcons();
    }
}

function loadSectionData(section, userId) {
    switch (section) {
        case 'feed': loadPosts(); break;
        case 'alumni': loadAlumni(true); break;
        case 'map': loadGoogleMaps(); break;
        case 'profile': profileUserId = userId || currentUser?.user_id; loadProfile(profileUserId); break;
        case 'chat': loadConversations(); break;
        case 'settings': loadSettings(); break;
        case 'notifications': loadNotifications(); break;
        case 'opportunities': loadOpportunities(); break;
    }
}

// ══════════════════════════════════════════════════════════
//  FEED — Posts
// ══════════════════════════════════════════════════════════
function setupPostComposer() {
    document.getElementById('post-submit')?.addEventListener('click', createPost);
    ['post-file', 'post-attachment'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            const oversized = files.filter(f => f.size > 10 * 1024 * 1024);
            if (oversized.length) { showToast('Media files must be less than 10MB each.', 'error'); e.target.value = ''; return; }
            pendingFiles = [...pendingFiles, ...files];
            renderFilePreview();
        });
    });
}

function renderFilePreview() {
    const preview = document.getElementById('file-preview');
    if (!pendingFiles.length) { preview.classList.add('hidden'); preview.innerHTML = ''; return; }
    preview.classList.remove('hidden');
    preview.innerHTML = pendingFiles.map((f, i) => {
        if (f.type.startsWith('image/')) {
            return `<div class="relative group"><img src="${URL.createObjectURL(f)}" class="w-16 h-16 rounded-lg object-cover border border-gray-200" /><button onclick="removeFile(${i})" class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button></div>`;
        }
        return `<div class="relative group flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600">📎 ${f.name}<button onclick="removeFile(${i})" class="text-red-500 ml-1">×</button></div>`;
    }).join('');
}

function removeFile(index) { pendingFiles.splice(index, 1); renderFilePreview(); }

async function createPost() {
    const content = document.getElementById('post-content').value.trim();
    if (!content && !pendingFiles.length) return;
    const submitBtn = document.getElementById('post-submit');
    submitBtn.disabled = true; submitBtn.textContent = 'Publishing…';
    try {
        const uploadedFiles = [];
        for (const file of pendingFiles) {
            const result = await sbUploadFileWithProgress(file, 'posts');
            uploadedFiles.push(result);
        }
        const post = await sbCreatePost(currentUser.user_id, content);
        for (const uf of uploadedFiles) {
            await sbAddAttachment(post.id, uf.file_path, uf.file_type, uf.original_name);
        }
        document.getElementById('post-content').value = '';
        pendingFiles = []; renderFilePreview();
        loadPosts();
        showToast('Post published!', 'success');
    } catch (err) { showToast('Failed to post.', 'error'); }
    finally { submitBtn.disabled = false; submitBtn.textContent = 'Publish'; }
}

let currentFeedTab = 'foryou';

function setFeedTab(tab) {
    currentFeedTab = tab;
    const fyBtn = document.getElementById('feed-tab-foryou');
    const flBtn = document.getElementById('feed-tab-following');
    if (tab === 'foryou') {
        fyBtn.className = 'px-5 py-2 rounded-full text-sm font-semibold transition bg-white text-navy shadow-sm';
        flBtn.className = 'px-5 py-2 rounded-full text-sm font-semibold transition text-gray-500 hover:text-navy';
    } else {
        flBtn.className = 'px-5 py-2 rounded-full text-sm font-semibold transition bg-white text-navy shadow-sm';
        fyBtn.className = 'px-5 py-2 rounded-full text-sm font-semibold transition text-gray-500 hover:text-navy';
    }
    loadPosts(true);
}

async function loadPosts(reset = false) {
    const container = document.getElementById('posts-list');
    if (reset) container.innerHTML = '<div class="text-center py-8"><div class="inline-block w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin"></div></div>';
    try {
        let posts;
        if (currentFeedTab === 'following' && currentUser?.user_id) {
            const { data: follows, error: followError } = await supabaseClient.from('subscriptions').select('following_id').eq('follower_id', currentUser.user_id);
            const followedIds = follows?.map(f => f.following_id) || [];
            // Include own posts in following tab
            if (!followedIds.includes(currentUser.user_id)) followedIds.push(currentUser.user_id);
            if (followedIds.length <= 1 && followedIds[0] === currentUser.user_id) {
                container.innerHTML = '<div class="text-center py-12 text-gray-400"><p>Follow people to see their posts here!</p></div>';
                return;
            }
            // Try full query, fallback without new tables
            let { data, error } = await supabaseClient.from('posts').select('*, profiles!posts_user_id_fkey(*), post_likes(*), post_comments(*), post_attachments(*), post_views(*), reposts(*)').in('user_id', followedIds).order('created_at', { ascending: false }).limit(50);
            if (error) {
                const res = await supabaseClient.from('posts').select('*, profiles!posts_user_id_fkey(*), post_likes(*), post_comments(*), post_attachments(*)').in('user_id', followedIds).order('created_at', { ascending: false }).limit(50);
                data = res.data || [];
            }
            posts = await sbEnrichPostsWithOriginals(data || []);
        } else {
            posts = await sbGetFeedPosts();
        }
        if (reset) container.innerHTML = '';
        if (!posts.length && reset) return;
        posts.forEach(post => {
            const card = createPostCard(post);
            if (reset) card.classList.add('post-enter');
            container.appendChild(card);
        });
        document.getElementById('feed-load-more')?.classList.add('hidden');
        lucide.createIcons();
    } catch(e) { console.error('loadPosts error:', e); if (reset) container.innerHTML = ''; }
}

function createPostCard(post) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-2xl border border-gray-200 p-5 shadow-sm dark:bg-gray-800 dark:border-gray-700';
    div.dataset.postId = post.id;
    const p = post.profiles || {};
    const avatarUrl = p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'U')}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
    const timeAgo = formatTimeAgo(post.created_at);
    const likeCount = post.post_likes?.length || 0;
    const commentCount = post.post_comments?.length || 0;
    const isLiked = post.post_likes?.some(l => l.user_id === currentUser?.user_id);
    const viewCount = post.post_views?.length || 0;
    const repostCount = post.reposts?.length || 0;
    const isReposted = post.reposts?.some(r => r.user_id === currentUser?.user_id);

    // Attachments
    let attachHtml = '';
    if (post.post_attachments?.length) {
        attachHtml = '<div class="flex flex-wrap gap-2 mt-3">' +
            post.post_attachments.map(att => {
                if (att.file_type === 'image') return `<img src="${att.file_path}" loading="lazy" class="rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition" onclick="openMediaViewer('${att.file_path}', 'image')" />`;
                if (att.file_type === 'video') return `<div class="video-preview rounded-lg max-h-64 overflow-hidden" onclick="openMediaViewer('${att.file_path}', 'video')"><video src="${att.file_path}" class="rounded-lg max-h-64 object-cover" muted preload="metadata"></video><div class="play-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="#0B1D3A"><polygon points="5 3 19 12 5 21"></polygon></svg></div></div>`;
                if (att.file_type === 'audio') return `<div class="bg-gray-100 rounded-lg px-3 py-2"><audio controls src="${att.file_path}" class="max-w-[250px]"></audio></div>`;
                return `<a href="${att.file_path}" target="_blank" class="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-200 transition">📎 ${att.original_name || 'File'}</a>`;
            }).join('') + '</div>';
    }

    // Repost indicator (legacy _repostedBy)
    let repostIndicator = '';
    if (post._repostedBy) {
        repostIndicator = `<div class="flex items-center gap-1.5 text-xs text-gray-400 mb-2"><i data-lucide="repeat-2" class="w-3 h-3"></i> ${escHtml(post._repostedBy)} reposted</div>`;
    }

    // Wall post attribution
    let wallAttribution = '';
    if (post.wall_user_id && post.wall_profile) {
        const wallName = post.wall_profile.full_name || 'someone';
        wallAttribution = `<div class="flex items-center gap-1 text-xs text-gray-400 mt-0.5"><i data-lucide="arrow-right" class="w-3 h-3"></i> Posted on <a onclick="navigateTo('profile','${post.wall_user_id}')" class="text-navy font-medium cursor-pointer hover:underline dark:text-accent">${escHtml(wallName)}'s</a> wall</div>`;
    }

    // Embedded original post (for reposts)
    let embeddedPostHtml = '';
    if (post._originalPost) {
        const op = post._originalPost;
        const opProf = op.profiles || {};
        const opAvatar = opProf.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(opProf.full_name || 'U')}&background=C8FF00&color=0B1D3A&size=32&bold=true&font-size=0.45`;
        const opTime = formatTimeAgo(op.created_at);
        let opAttachHtml = '';
        if (op.post_attachments?.length) {
            opAttachHtml = '<div class="flex flex-wrap gap-2 mt-2">' +
                op.post_attachments.map(att => {
                    if (att.file_type === 'image') return `<img src="${att.file_path}" loading="lazy" class="rounded-lg max-h-48 object-cover" />`;
                    if (att.file_type === 'video') return `<video src="${att.file_path}" class="rounded-lg max-h-48 object-cover" muted preload="metadata" controls></video>`;
                    return '';
                }).join('') + '</div>';
        }
        embeddedPostHtml = `
        <div class="mt-3 border border-gray-200 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-700/30 dark:border-gray-600 cursor-pointer hover:bg-gray-50 transition" onclick="navigateTo('profile','${op.user_id}')">
          <div class="flex items-center gap-2 mb-2">
            <i data-lucide="repeat-2" class="w-3.5 h-3.5 text-gray-400"></i>
            <img src="${opAvatar}" loading="lazy" class="w-6 h-6 rounded-full object-cover" />
            <span class="font-semibold text-xs text-navy dark:text-white">${escHtml(opProf.full_name || 'Unknown')}</span>
            <span class="text-xs text-gray-300">·</span>
            <span class="text-xs text-gray-400">${opTime}</span>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">${escHtml(op.content || '')}</p>
          ${opAttachHtml}
        </div>`;
    }

    const isMyPost = post.user_id === currentUser?.user_id;
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const canEdit = isMyPost && new Date(post.created_at).getTime() > oneHourAgo;
    const editBtn = canEdit ? `<button onclick="openEditPostModal(${post.id}, this)" class="text-gray-300 hover:text-blue-500 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>` : '';
    const deleteBtn = isMyPost ? `<button onclick="deletePost(${post.id}, this)" class="text-gray-300 hover:text-red-500 transition ml-auto">${editBtn}<i data-lucide="trash-2" class="w-4 h-4 ml-1"></i></button>` : '';
    const editedLabel = post.edited_at ? '<span class="text-[10px] text-gray-400 italic">edited</span>' : '';

    const contentHtml = post.content ? `<p class="text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed post-content-text">${escHtml(post.content)}</p>` : '';

    div.innerHTML = `
    ${repostIndicator}
    <div class="flex items-start gap-3">
      <img src="${avatarUrl}" loading="lazy" class="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer" onclick="navigateTo('profile','${post.user_id}')" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <a onclick="navigateTo('profile','${post.user_id}')" class="user-name-link font-semibold text-sm text-navy cursor-pointer dark:text-white">${escHtml(p.full_name)}</a>
          <span class="text-xs text-gray-400">${p.nis_branch || ''}</span>
          <span class="text-xs text-gray-300">·</span>
          <span class="text-xs text-gray-400">${timeAgo}</span>
          ${editedLabel}
          ${deleteBtn}
        </div>
        ${wallAttribution}
        ${contentHtml}
        ${attachHtml}
        ${embeddedPostHtml}
        <div class="flex items-center gap-5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button onclick="toggleLike(${post.id}, this)" class="post-like-btn flex items-center gap-1.5 text-sm transition ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}" data-liked="${isLiked ? '1' : '0'}">
            <i data-lucide="heart" class="w-4 h-4 ${isLiked ? 'fill-red-500' : ''}"></i>
            <span class="like-count">${likeCount || ''}</span>
          </button>
          <button onclick="toggleCommentSection(${post.id}, this)" class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy transition dark:hover:text-accent">
            <i data-lucide="message-circle" class="w-4 h-4"></i>
            <span class="comment-count">${commentCount || ''}</span>
          </button>
          <button onclick="openRepostModal(${post.id})" class="flex items-center gap-1.5 text-sm ${isReposted ? 'text-green-500' : 'text-gray-400 hover:text-green-500'} transition">
            <i data-lucide="repeat-2" class="w-4 h-4"></i>
            <span>${repostCount || ''}</span>
          </button>
          <span class="flex items-center gap-1 text-xs text-gray-300 ml-auto">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            <span class="view-count">${viewCount || 0}</span>
          </span>
        </div>
        <div id="comments-${post.id}" class="comments-section hidden mt-3">
          <div class="comments-list space-y-3"></div>
          <div class="flex items-center gap-2 mt-3">
            <input type="text" class="comment-input flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-accent/30 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Write a comment…" onkeydown="if(event.key==='Enter')addComment(${post.id}, this)" />
            <button onclick="addComment(${post.id}, this.previousElementSibling)" class="text-sm text-navy font-semibold hover:text-accent transition px-3 py-2 dark:text-accent">Post</button>
          </div>
        </div>
      </div>
    </div>`;
    // Track view
    if (currentUser?.user_id) trackPostView(post.id);
    return div;
}

// ══════════════════════════════════════════════════════════
//  EDIT POST (within first hour)
// ══════════════════════════════════════════════════════════
let editingPostId = null;

function openEditPostModal(postId, btnEl) {
    editingPostId = String(postId); // Always store as string for consistent comparison
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    const contentEl = postCard?.querySelector('.post-content-text');
    const currentContent = contentEl?.textContent || '';
    const modal = document.getElementById('edit-post-modal');
    const textarea = document.getElementById('edit-post-content');
    if (modal && textarea) {
        textarea.value = currentContent;
        modal.classList.remove('hidden');
        textarea.focus();
    } else {
        console.error('Edit post modal or textarea not found');
    }
}

async function saveEditPost() {
    if (!editingPostId) return;
    const textarea = document.getElementById('edit-post-content');
    const newContent = textarea?.value?.trim();
    if (!newContent) { showToast('Post content cannot be empty.', 'error'); return; }
    const btn = document.querySelector('#edit-post-modal button[onclick="saveEditPost()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
        // Try with edited_at first; if column doesn't exist, retry without it
        let result = await supabaseClient.from('posts')
            .update({ content: newContent, edited_at: new Date().toISOString() })
            .eq('id', editingPostId)
            .eq('user_id', currentUser.user_id);
        if (result.error && result.error.message?.includes('edited_at')) {
            // Column doesn't exist yet — update content only
            result = await supabaseClient.from('posts')
                .update({ content: newContent })
                .eq('id', editingPostId)
                .eq('user_id', currentUser.user_id);
        }
        if (result.error) {
            console.error('Edit post error:', result.error);
            showToast('Failed to update post: ' + (result.error.message || 'Unknown error'), 'error');
        } else {
            closeEditPostModal();
            showToast('Post updated!', 'success');
            loadPosts(true);
        }
    } catch(e) {
        console.error('saveEditPost exception:', e);
        showToast('Failed to update post.', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
}

function closeEditPostModal() {
    editingPostId = null;
    document.getElementById('edit-post-modal')?.classList.add('hidden');
}

let pendingDeletePostId = null;
let pendingDeleteBtn = null;

async function deletePost(postId, btn) {
    pendingDeletePostId = postId;
    pendingDeleteBtn = btn;
    document.getElementById('delete-post-modal')?.classList.remove('hidden');
    lucide.createIcons();
}

function closeDeleteModal() {
    document.getElementById('delete-post-modal')?.classList.add('hidden');
    pendingDeletePostId = null;
    pendingDeleteBtn = null;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirm-delete-btn')?.addEventListener('click', async () => {
        if (!pendingDeletePostId) return;
        try {
            await sbDeletePost(pendingDeletePostId);
            pendingDeleteBtn?.closest('.bg-white')?.remove();
            showToast('Post deleted.', 'success');
        } catch { showToast('Failed to delete.', 'error'); }
        closeDeleteModal();
    });
});

// ══════════════════════════════════════════════════════════
//  DIRECTORY (formerly Alumni)
// ══════════════════════════════════════════════════════════
let directoryTypeFilter = 'all'; // 'all', 'student', 'alumni'

function setDirectoryType(type) {
    directoryTypeFilter = type;
    ['all', 'student', 'alumni'].forEach(t => {
        const btn = document.getElementById(`dir-type-${t}`);
        if (!btn) return;
        if (t === type) {
            btn.className = 'px-4 py-2 rounded-full text-sm font-semibold transition bg-navy text-white';
        } else {
            btn.className = 'px-4 py-2 rounded-full text-sm font-semibold transition bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300';
        }
    });
    loadAlumni(true);
}

function toggleDirectoryFilter() {
    const popup = document.getElementById('dir-filter-popup');
    popup?.classList.toggle('hidden');
    lucide.createIcons();
}

function applyDirectoryFilters() {
    loadAlumni(true);
}

function clearDirectoryFilters() {
    document.getElementById('dir-filter-branch').value = '';
    document.getElementById('dir-filter-year').value = '';
    document.getElementById('dir-filter-uni').value = '';
    document.getElementById('dir-filter-uni-year').value = '';
    loadAlumni(true);
}

function setupAlumniControls() {} // search handled inline

async function loadAlumni(reset = false) {
    const search = document.getElementById('alumni-search')?.value?.toLowerCase() || '';
    const sortBy = document.getElementById('alumni-sort')?.value || 'name';
    const filterBranch = document.getElementById('dir-filter-branch')?.value || '';
    const filterYear = document.getElementById('dir-filter-year')?.value || '';
    const filterUni = document.getElementById('dir-filter-uni')?.value?.trim()?.toLowerCase() || '';
    const filterUniYear = document.getElementById('dir-filter-uni-year')?.value || '';

    try {
        let orderCol = 'full_name', ascending = true;
        if (sortBy === 'branch') orderCol = 'nis_branch';
        else if (sortBy === 'year') { orderCol = 'graduation_year'; ascending = false; }
        else if (sortBy === 'newest') { orderCol = 'created_at'; ascending = false; }

        let query = supabaseClient.from('profiles').select('*').order(orderCol, { ascending });

        if (search) query = query.or(`full_name.ilike.%${search}%,nis_branch.ilike.%${search}%,username.ilike.%${search}%`);
        if (directoryTypeFilter !== 'all') query = query.eq('user_type', directoryTypeFilter);
        if (filterBranch) query = query.eq('nis_branch', filterBranch);
        if (filterYear) query = query.eq('graduation_year', parseInt(filterYear));
        if (filterUni) query = query.ilike('university', `%${filterUni}%`);
        if (filterUniYear) query = query.eq('uni_graduation_year', parseInt(filterUniYear));

        const { data: users, error } = await query.limit(50);
        if (error) throw error;

        // Fetch follow data for accurate button state
        let myFollowing = new Set();
        let myFollowers = new Set();
        if (currentUser?.user_id) {
            const { data: f1 } = await supabaseClient.from('subscriptions').select('following_id').eq('follower_id', currentUser.user_id);
            const { data: f2 } = await supabaseClient.from('subscriptions').select('follower_id').eq('following_id', currentUser.user_id);
            (f1 || []).forEach(f => myFollowing.add(f.following_id));
            (f2 || []).forEach(f => myFollowers.add(f.follower_id));
        }

        const grid = document.getElementById('alumni-grid');
        if (reset) grid.innerHTML = '';
        if (!users?.length && reset) { grid.innerHTML = '<div class="text-center py-12 text-gray-400 col-span-full"><p>No results found.</p></div>'; return; }
        users.forEach(user => {
            const isFollowing = myFollowing.has(user.id);
            const isMutual = isFollowing && myFollowers.has(user.id);
            grid.appendChild(createAlumniCard(user, isFollowing, isMutual));
        });
        document.getElementById('alumni-load-more')?.classList.add('hidden');
        lucide.createIcons();
    } catch(e) { console.error('loadAlumni error:', e); }
}

// Alumni search debounce
document.getElementById('alumni-search')?.addEventListener('input', (() => {
    let timer;
    return () => { clearTimeout(timer); timer = setTimeout(() => loadAlumni(true), 300); };
})());
document.getElementById('alumni-sort')?.addEventListener('change', () => loadAlumni(true));

function createAlumniCard(user, isFollowing = false, isMutual = false) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer dark:bg-gray-800 dark:border-gray-700';
    const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=C8FF00&color=0B1D3A&size=48&bold=true&font-size=0.45`;
    const isMe = user.id === currentUser?.user_id;
    const isOnline = user.last_seen && (Date.now() - new Date(user.last_seen).getTime() < 5 * 60 * 1000) && user.show_online !== false;
    const onlineDot = isOnline ? '<span class="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></span>' : '';
    div.setAttribute('onclick', `navigateTo('profile', '${user.id}')`);
    let followBtnHtml = '';
    if (!isMe) {
        if (isMutual) {
            followBtnHtml = `<button onclick="event.stopPropagation();directoryFollow('${user.id}', this)" class="dir-follow-btn shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full bg-accent text-navy transition" data-following="1" data-mutual="1" onmouseenter="this.textContent='Unfollow'" onmouseleave="this.textContent='Friend'">Friend</button>`;
        } else if (isFollowing) {
            followBtnHtml = `<button onclick="event.stopPropagation();directoryFollow('${user.id}', this)" class="dir-follow-btn shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full bg-navy text-white transition" data-following="1" onmouseenter="this.textContent='Unfollow'" onmouseleave="this.textContent='Following'">Following</button>`;
        } else {
            followBtnHtml = `<button onclick="event.stopPropagation();directoryFollow('${user.id}', this)" class="dir-follow-btn shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full border-2 border-navy text-navy hover:bg-navy hover:text-white transition dark:border-accent dark:text-accent" data-following="0">Follow</button>`;
        }
    }
    div.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="relative shrink-0">
        <img src="${avatarUrl}" class="w-12 h-12 rounded-full object-cover" />
        ${onlineDot}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-sm text-navy truncate dark:text-white">${escHtml(user.full_name)}</p>
        <p class="text-xs text-gray-400 truncate">${user.nis_branch || ''} ${user.graduation_year ? `'${String(user.graduation_year).slice(2)}` : ''}</p>
        ${user.university ? `<p class="text-xs text-gray-400 truncate mt-0.5">${escHtml(user.university)}</p>` : ''}
      </div>
      ${followBtnHtml}
    </div>`;
    return div;
}

// ── Directory follow ──
async function directoryFollow(userId, btn) {
    if (!currentUser?.user_id) return;
    btn.disabled = true;
    const wasFollowing = btn.dataset.following === '1';
    if (wasFollowing) {
        btn.textContent = 'Follow';
        btn.dataset.following = '0';
        btn.className = 'dir-follow-btn shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full border-2 border-navy text-navy hover:bg-navy hover:text-white transition dark:border-accent dark:text-accent';
        btn.onmouseenter = null; btn.onmouseleave = null;
    } else {
        btn.textContent = 'Following';
        btn.dataset.following = '1';
        btn.className = 'dir-follow-btn shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full bg-navy text-white transition';
        btn.onmouseenter = () => btn.textContent = 'Unfollow';
        btn.onmouseleave = () => btn.textContent = 'Following';
    }
    try { await sbToggleFollow(currentUser.user_id, userId); } catch { }
    btn.disabled = false;
}

// ══════════════════════════════════════════════════════════
//  MAP (Google Maps)
// ══════════════════════════════════════════════════════════
let map = null;
let mapMarkers = [];

let mapsLoaded = false;

function loadGoogleMaps() {
    if (typeof google !== 'undefined' && google.maps) {
        initDashboardMap();
        return;
    }
    if (mapsLoaded) return;
    mapsLoaded = true;
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyBKpd_lSsfUE50uQaPcNl4NnFfXRre14HI&libraries=places&callback=initDashboardMap';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
}

function initDashboardMap() {
    const mapEl = document.getElementById('google-map');
    if (!mapEl) return;
    map = new google.maps.Map(mapEl, {
        center: { lat: 51.1694, lng: 71.4491 },
        zoom: 5,
        styles: [
            { elementType: 'geometry', stylers: [{ color: '#0B1D3A' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#0B1D3A' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#071428' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#15325E' }] },
        ],
        disableDefaultUI: true, zoomControl: true,
    });

    // Populate the map with mutual friends grouped by university
    populateMap();
}

// Map cache to store geocoded universities to save API calls
let universityGeoCache = JSON.parse(localStorage.getItem('uniGeoCache') || '{}');

async function populateMap() {
    if (!currentUser?.user_id || !map) return;
    try {
        const friends = await sbGetMutualFriendsProfiles(currentUser.user_id);
        const countSpan = document.getElementById('map-alumni-count');
        if (countSpan) countSpan.textContent = friends.length;

        const uniGroups = {};
        for (const f of friends) {
            if (!f.university) continue;
            const uni = String(f.university).trim();
            if (!uni) continue;
            if (!uniGroups[uni]) uniGroups[uni] = [];
            uniGroups[uni].push(f);
        }

        const placesService = new google.maps.places.PlacesService(map);

        for (const [uniName, alumniArray] of Object.entries(uniGroups)) {
            await placeUniversityMarker(uniName, alumniArray, placesService);
        }
    } catch(e) {
        console.error('Failed to populate map:', e);
    }
}

async function placeUniversityMarker(uniName, alumniArray, placesService) {
    if (!universityGeoCache[uniName]) {
        // Search for the university location and icon
        const request = {
            query: uniName + ' university',
            fields: ['name', 'geometry', 'icon', 'photos']
        };
        await new Promise((resolve) => {
            placesService.textSearch(request, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                    const place = results[0];
                    let iconUrl = place.icon;
                    if (place.photos && place.photos.length > 0) {
                        iconUrl = place.photos[0].getUrl({ maxWidth: 100, maxHeight: 100 });
                    }
                    universityGeoCache[uniName] = {
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng(),
                        icon: iconUrl
                    };
                    localStorage.setItem('uniGeoCache', JSON.stringify(universityGeoCache));
                }
                resolve();
            });
        });
    }

    const geo = universityGeoCache[uniName];
    if (!geo) return; // Geocoding failed

    // Create custom marker icon
    const markerIcon = {
        url: geo.icon || 'https://maps.gstatic.com/mapfiles/place_api/icons/v1/png_71/school-71.png',
        scaledSize: new google.maps.Size(40, 40),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(20, 20)
    };

    const marker = new google.maps.Marker({
        position: { lat: geo.lat, lng: geo.lng },
        map: map,
        title: uniName,
        icon: markerIcon,
        animation: google.maps.Animation.DROP
    });

    mapMarkers.push(marker);

    // Build InfoWindow HTML
    let html = `
        <div class="p-2 w-64 max-h-72 overflow-y-auto custom-scrollbar">
            <h4 class="font-display font-bold text-navy mb-3 pb-2 border-b border-gray-100 flex items-center gap-2">
                <i data-lucide="graduation-cap" class="w-4 h-4 text-accent border border-gray-200 rounded-full"></i> 
                ${escHtml(uniName)}
            </h4>
            <div class="space-y-3">
    `;
    
    for (const a of alumniArray) {
        const avatar = a.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.full_name)}&background=C8FF00&color=0B1D3A&size=40&bold=true`;
        const branch = a.nis_branch ? `<span class="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">${escHtml(a.nis_branch)}</span>` : '';
        const year = a.graduation_year ? `<span class="text-[10px] text-gray-400">'${String(a.graduation_year).slice(-2)}</span>` : '';
        html += `
            <div class="flex items-center gap-2 group cursor-pointer" onclick="navigateTo('profile', '${a.id}')">
                <img src="${avatar}" class="w-8 h-8 rounded-full object-cover border border-gray-200">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-navy truncate group-hover:text-blue-600 transition">${escHtml(a.full_name)}</p>
                    <div class="flex items-center gap-1 mt-0.5">${branch}${year}</div>
                </div>
            </div>
        `;
    }
    
    html += `</div></div>`;

    const infoWindow = new google.maps.InfoWindow({ content: html });
    marker.addListener('click', () => {
        infoWindow.open({
            anchor: marker,
            map,
            shouldFocus: false,
        });
        setTimeout(() => lucide.createIcons(), 50); // render lucide icons in popup
    });
}

// ══════════════════════════════════════════════════════════
//  PROFILE / WALL
// ══════════════════════════════════════════════════════════
async function loadProfile(userId) {
    if (!userId) return;
    try {
        const u = await sbGetProfile(userId);
        const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=96&bold=true&font-size=0.4`;
        document.getElementById('profile-avatar-img').src = avatarUrl;
        document.getElementById('profile-display-name').textContent = u.full_name || '—';
        document.getElementById('profile-display-branch').textContent = u.nis_branch || '';
        const yearEl = document.getElementById('profile-display-year');
        if (u.graduation_year) { yearEl.innerHTML = `<em class="font-display italic">NIS ${String(u.graduation_year).slice(2)}'</em>`; } else { yearEl.textContent = ''; }
        document.getElementById('profile-display-bio').textContent = u.bio || '—';
        // Pronouns display
        const pronounsEl = document.getElementById('profile-display-pronouns');
        if (pronounsEl) { if (u.pronouns) { pronounsEl.textContent = u.pronouns; pronounsEl.classList.remove('hidden'); } else { pronounsEl.classList.add('hidden'); } }
        // Student check: if not graduated, just show NIS branch, hide uni/degree
        const now2 = new Date();
        const pHasGraduated = u.graduation_year && (now2.getFullYear() > u.graduation_year || (now2.getFullYear() === u.graduation_year && now2.getMonth() >= 5));
        if (!pHasGraduated && u.user_type === 'student') {
            document.getElementById('profile-display-uni').textContent = u.nis_branch || '—';
            document.getElementById('profile-display-degree').textContent = 'Student';
        } else {
            document.getElementById('profile-display-uni').textContent = u.university || '—';
            document.getElementById('profile-display-degree').textContent = u.degree_major || '—';
        }
        // Work info display
        const workEl = document.getElementById('profile-display-work');
        if (workEl) {
            const workParts = [u.work_status, u.company, u.workfield].filter(Boolean);
            if (workParts.length) {
                const labels = { student: 'Student', intern: 'Intern', working: 'Working', freelance: 'Freelance', looking: 'Looking for opportunities' };
                let workText = labels[u.work_status] || u.work_status || '';
                if (u.company) workText += ` at ${u.company}`;
                if (u.workfield) workText += ` • ${u.workfield}`;
                workEl.querySelector('span').textContent = workText;
                workEl.classList.remove('hidden');
            } else { workEl.classList.add('hidden'); }
        }

        const statusEl = document.getElementById('profile-display-status');
        if (statusEl) { if (u.status) { statusEl.textContent = u.status; statusEl.classList.remove('hidden'); } else { statusEl.classList.add('hidden'); } }

        const coverEl = document.getElementById('profile-cover');
        if (u.cover_url) { coverEl.style.backgroundImage = `url('${u.cover_url}')`; }
        else { coverEl.style.backgroundImage = 'none'; coverEl.style.backgroundColor = '#0B1D3A'; }

        toggleSocialLink('prof-linkedin', u.linkedin);
        toggleSocialLink('prof-instagram', u.instagram);
        toggleSocialLink('prof-youtube', u.youtube);

        const isOwnProfile = (userId === currentUser?.user_id);
        const coverLabel = document.getElementById('cover-upload-label');
        const avatarLabel = document.getElementById('profile-avatar-upload-label');
        const editBtn = document.getElementById('profile-edit-btn');
        currentProfileUserId = userId; // Track whose profile we're viewing
        if (isOwnProfile) {
            coverLabel?.classList.remove('hidden'); avatarLabel?.classList.remove('hidden'); editBtn?.classList.remove('hidden');
            document.getElementById('profile-post-composer')?.classList.remove('hidden');
            const composerText = document.getElementById('profile-post-content');
            if (composerText) composerText.placeholder = "What's on your mind?";
            setupProfileUploads(); setupProfilePostFile();
        } else {
            coverLabel?.classList.add('hidden'); avatarLabel?.classList.add('hidden'); editBtn?.classList.add('hidden');
            // Show wall composer based on wall_privacy
            const wallPrivacy = u.wall_privacy || 'everyone';
            let canPost = false;
            if (wallPrivacy === 'everyone') canPost = true;
            else if (wallPrivacy === 'friends') {
                // Check if mutual follow
                const { data: f1 } = await supabaseClient.from('subscriptions').select('id').eq('follower_id', currentUser.user_id).eq('following_id', userId).maybeSingle();
                const { data: f2 } = await supabaseClient.from('subscriptions').select('id').eq('follower_id', userId).eq('following_id', currentUser.user_id).maybeSingle();
                canPost = !!(f1 && f2);
            }
            const composer = document.getElementById('profile-post-composer');
            if (canPost && composer) {
                composer.classList.remove('hidden');
                const composerText = document.getElementById('profile-post-content');
                if (composerText) composerText.placeholder = `Write on ${u.full_name}'s wall…`;
                setupProfilePostFile();
            } else if (composer) {
                composer.classList.add('hidden');
            }
        }

        const followWrap = document.getElementById('profile-follow-wrap');
        if (!isOwnProfile) { followWrap.classList.remove('hidden'); loadFollowStatus(userId); }
        else { followWrap.classList.add('hidden'); }

        const followData = await sbGetFollowStatus(currentUser?.user_id, userId);
        document.getElementById('profile-follower-count').textContent = followData.follower_count;
        document.getElementById('profile-following-count').textContent = followData.following_count;

        loadWallPosts(userId);
        lucide.createIcons();
    } catch { }
}

function toggleSocialLink(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    if (url) { el.href = url; el.classList.remove('hidden'); } else { el.classList.add('hidden'); }
}

async function loadFollowStatus(userId) {
    try {
        const data = await sbGetFollowStatus(currentUser?.user_id, userId);
        const btn = document.getElementById('profile-follow-btn');
        const msgBtn = document.getElementById('profile-msg-btn');
        btn.dataset.userId = userId;
        if (data.i_follow) {
            btn.textContent = data.is_mutual ? '✓ Friends' : 'Following';
            btn.className = 'follow-btn following px-5 py-2 rounded-full text-sm font-semibold transition bg-gray-100 text-gray-600';
            btn.dataset.following = '1';
            btn.dataset.label = data.is_mutual ? '✓ Friends' : 'Following';
            if (msgBtn) msgBtn.classList.remove('hidden');
        } else {
            btn.textContent = 'Follow';
            btn.className = 'follow-btn px-5 py-2 rounded-full text-sm font-semibold transition bg-navy text-white hover:bg-navy-light';
            btn.dataset.following = '0';
            btn.dataset.label = 'Follow';
            if (msgBtn) msgBtn.classList.add('hidden');
        }
    } catch { }
}

// Follow button hover
document.getElementById('profile-follow-btn')?.addEventListener('mouseenter', function () { if (this.dataset.following === '1') this.textContent = 'Unfollow'; });
document.getElementById('profile-follow-btn')?.addEventListener('mouseleave', function () { if (this.dataset.following === '1') this.textContent = this.dataset.label || 'Following'; });

async function toggleFollow() {
    const btn = document.getElementById('profile-follow-btn');
    const userId = btn.dataset.userId;
    const isFollowing = btn.dataset.following === '1';
    try {
        if (isFollowing) { await sbUnfollow(currentUser.user_id, userId); }
        else {
            await sbFollow(currentUser.user_id, userId);
            createNotification('follow', userId);
        }
        loadFollowStatus(userId);
        const followData = await sbGetFollowStatus(currentUser?.user_id, userId);
        document.getElementById('profile-follower-count').textContent = followData.follower_count;
    } catch { }
}

async function loadWallPosts(userId) {
    try {
        const posts = await sbGetUserPosts(userId);
        const container = document.getElementById('wall-posts');
        container.innerHTML = '';
        const postCountEl = document.getElementById('profile-post-count');
        if (postCountEl) postCountEl.textContent = posts.length;
        if (!posts.length) { container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No posts yet.</div>'; return; }
        posts.forEach(post => container.appendChild(createPostCard(post)));
        lucide.createIcons();
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  LIKE & COMMENT FUNCTIONS
// ══════════════════════════════════════════════════════════
async function toggleLike(postId, btn) {
    // Optimistic UI: toggle immediately
    const countEl = btn.querySelector('.like-count');
    const iconEl = btn.querySelector('[data-lucide]');
    const wasLiked = btn.dataset.liked === '1';
    const currentCount = parseInt(countEl.textContent) || 0;
    if (wasLiked) {
        btn.classList.add('text-gray-400'); btn.classList.remove('text-red-500');
        btn.dataset.liked = '0'; iconEl.classList.remove('fill-red-500');
        countEl.textContent = Math.max(0, currentCount - 1) || '';
    } else {
        btn.classList.remove('text-gray-400'); btn.classList.add('text-red-500');
        btn.dataset.liked = '1'; iconEl.classList.add('fill-red-500');
        countEl.textContent = currentCount + 1;
        btn.style.transform = 'scale(1.2)';
        setTimeout(() => btn.style.transform = '', 200);
        // Notify post owner
        getPostOwnerId(postId).then(ownerId => { if (ownerId && ownerId !== currentUser.user_id) createNotification('like', ownerId, postId); });
    }
    // Server call in background
    try { await sbToggleLike(postId, currentUser.user_id); } catch { }
}

function toggleCommentSection(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;
    if (section.classList.contains('hidden')) { section.classList.remove('hidden'); loadComments(postId); }
    else { section.classList.add('hidden'); }
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
            const p = c.profiles || {};
            const cAvatarUrl = p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'U')}&background=C8FF00&color=0B1D3A&size=28&bold=true&font-size=0.45`;
            const deleteHtml = (c.user_id === currentUser?.user_id) ? `<button onclick="deleteComment(${c.id}, ${postId}, this)" class="text-gray-300 hover:text-red-500 transition ml-auto shrink-0"><i data-lucide="x" class="w-3 h-3"></i></button>` : '';
            const commentDiv = document.createElement('div');
            commentDiv.className = 'flex items-start gap-2 p-2 rounded-lg bg-gray-50';
            commentDiv.innerHTML = `<img src="${cAvatarUrl}" class="w-7 h-7 rounded-full object-cover shrink-0 cursor-pointer" onclick="navigateTo('profile','${c.user_id}')" /><div class="flex-1 min-w-0"><span class="font-semibold text-xs text-navy cursor-pointer" onclick="navigateTo('profile','${c.user_id}')">${escHtml(p.full_name)}</span><span class="text-xs text-gray-400 ml-1">${formatTimeAgo(c.created_at)}</span><p class="text-sm text-gray-700 mt-0.5">${escHtml(c.content)}</p></div>${deleteHtml}`;
            list.appendChild(commentDiv);
        });
        lucide.createIcons();
    } catch { }
}

async function addComment(postId, inputEl) {
    const content = inputEl.value.trim();
    if (!content) return;
    try {
        await sbAddComment(postId, currentUser.user_id, content);
        inputEl.value = '';
        loadComments(postId);
        const postCard = document.querySelector(`[data-post-id="${postId}"]`);
        if (postCard) { const countEl = postCard.querySelector('.comment-count'); if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1; }
        // Notify post owner
        getPostOwnerId(postId).then(ownerId => { if (ownerId && ownerId !== currentUser.user_id) createNotification('comment', ownerId, postId); });
    } catch { }
}

async function deleteComment(commentId, postId) {
    if (!confirm('Delete this comment?')) return;
    try {
        await sbDeleteComment(commentId);
        loadComments(postId);
        const postCard = document.querySelector(`[data-post-id="${postId}"]`);
        if (postCard) { const countEl = postCard.querySelector('.comment-count'); const curr = parseInt(countEl.textContent || '1'); countEl.textContent = curr > 1 ? curr - 1 : ''; }
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  POST VIEWS (eye counter)
// ══════════════════════════════════════════════════════════
async function trackPostView(postId) {
    try {
        await supabaseClient.from('post_views').upsert(
            { post_id: postId, viewer_id: currentUser.user_id },
            { onConflict: 'post_id,viewer_id', ignoreDuplicates: true }
        );
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  REPOST
// ══════════════════════════════════════════════════════════
let pendingRepostId = null;

function openRepostModal(postId) {
    pendingRepostId = postId;
    document.getElementById('repost-modal')?.classList.remove('hidden');
    document.getElementById('repost-text')?.focus();
}

function closeRepostModal() {
    pendingRepostId = null;
    document.getElementById('repost-modal')?.classList.add('hidden');
    const textEl = document.getElementById('repost-text');
    if (textEl) textEl.value = '';
}

async function submitRepost() {
    if (!pendingRepostId || !currentUser?.user_id) return;
    const text = document.getElementById('repost-text')?.value?.trim() || '';
    const btn = document.querySelector('#repost-modal button[onclick="submitRepost()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Reposting…'; }
    try {
        // Create a new post that is a repost — pass original_post_id
        const newPost = await sbCreatePost(currentUser.user_id, text, null, null, pendingRepostId);
        // Record the repost link
        await supabaseClient.from('reposts').upsert(
            { user_id: currentUser.user_id, original_post_id: pendingRepostId, repost_text: text },
            { onConflict: 'user_id,original_post_id' }
        );
        // Notify original post owner
        getPostOwnerId(pendingRepostId).then(ownerId => { if (ownerId && ownerId !== currentUser.user_id) createNotification('repost', ownerId, pendingRepostId); });
        showToast('Reposted!', 'success');
        closeRepostModal();
        loadPosts(true);
    } catch(e) { console.error('Repost error:', e); showToast('Repost failed.', 'error'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Repost'; }
}

// ══════════════════════════════════════════════════════════
//  ONLINE STATUS
// ══════════════════════════════════════════════════════════
function updateOnlineStatus() {
    if (!currentUser?.user_id) return;
    supabaseClient.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.user_id).then(() => {});
}
// Heartbeat: update last_seen every 60 seconds
setInterval(updateOnlineStatus, 60000);

// ══════════════════════════════════════════════════════════
//  BROWSER NOTIFICATIONS
// ══════════════════════════════════════════════════════════
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/images/logo.png' });
    }
}

// Request notifications on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(requestNotificationPermission, 3000);
});

// ══════════════════════════════════════════════════════════
//  IN-APP NOTIFICATION BAR
// ══════════════════════════════════════════════════════════
function showNotificationBar(avatarUrl, name, type) {
    const bar = document.getElementById('notification-bar');
    if (!bar) return;
    const item = document.createElement('div');
    item.className = 'flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-lg animate-slideDown cursor-pointer';
    const typeText = type === 'like' ? 'liked your post' : type === 'message' ? 'new message' : type;
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=C8FF00&color=0B1D3A&size=32&bold=true&font-size=0.45`;
    item.innerHTML = `
        <img src="${avatarUrl || fallbackAvatar}" class="w-8 h-8 rounded-full object-cover shrink-0" />
        <div class="min-w-0">
            <p class="text-sm font-semibold text-navy truncate">${escHtml(name)}</p>
            <p class="text-xs text-gray-400">${typeText}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="text-gray-300 hover:text-gray-500 ml-auto shrink-0">&times;</button>
    `;
    bar.appendChild(item);
    setTimeout(() => { item.style.opacity = '0'; item.style.transform = 'translateX(100px)'; setTimeout(() => item.remove(), 300); }, 5000);
}

// ── Profile uploads (avatar + cover) ──
let profileUploadsSetup = false;
function setupProfileUploads() {
    if (profileUploadsSetup) return;
    profileUploadsSetup = true;
    document.getElementById('profile-avatar-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast('Avatar must be less than 2MB.', 'error'); e.target.value = ''; return; }
        try {
            const result = await sbUploadFile(file, 'avatars');
            await sbUpdateProfile(currentUser.user_id, { avatar_url: result.file_path });
            document.getElementById('profile-avatar-img').src = result.file_path;
            currentUser.avatar_url = result.file_path; updateNavAvatar(currentUser);
            showToast('Avatar updated!', 'success');
        } catch { showToast('Upload error.', 'error'); }
    });
    document.getElementById('cover-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast('Cover image must be less than 2MB.', 'error'); e.target.value = ''; return; }
        try {
            const result = await sbUploadFile(file, 'covers');
            await sbUpdateProfile(currentUser.user_id, { cover_url: result.file_path });
            document.getElementById('profile-cover').style.backgroundImage = `url('${result.file_path}')`;
            showToast('Cover updated!', 'success');
        } catch { showToast('Upload error.', 'error'); }
    });
}

// ── Profile post composer ──
let profilePostFiles = [];
function setupProfilePostFile() {
    document.getElementById('profile-post-file')?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        const oversized = files.filter(f => f.size > 10 * 1024 * 1024);
        if (oversized.length) { showToast('Media files must be less than 10MB each.', 'error'); e.target.value = ''; return; }
        profilePostFiles = [...profilePostFiles, ...files];
        const preview = document.getElementById('profile-file-preview');
        if (preview && profilePostFiles.length) { preview.classList.remove('hidden'); preview.innerHTML = profilePostFiles.map((f, i) => `<span class="text-xs bg-gray-100 px-2 py-1 rounded-full">${f.name} <button onclick="profilePostFiles.splice(${i},1);this.parentElement.remove();" class="text-red-400 ml-1">&times;</button></span>`).join(''); }
    });
}

async function createProfilePost() {
    const content = document.getElementById('profile-post-content')?.value?.trim();
    if (!content && !profilePostFiles.length) return;
    const btn = document.getElementById('profile-post-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
    try {
        let mediaUrls = [];
        for (const f of profilePostFiles) {
            const result = await sbUploadFile(f, 'posts');
            mediaUrls.push({ url: result.file_path, type: f.type });
        }
        // Determine if wall post
        const isWallPost = currentProfileUserId && currentProfileUserId !== currentUser.user_id;
        const wallUserId = isWallPost ? currentProfileUserId : null;
        await sbCreatePost(currentUser.user_id, content || '', mediaUrls, wallUserId);
        document.getElementById('profile-post-content').value = '';
        profilePostFiles = [];
        const preview = document.getElementById('profile-file-preview');
        if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }
        showToast('Post published!', 'success');
        loadWallPosts(currentProfileUserId || currentUser.user_id);
        loadPosts(true);
    } catch { showToast('Error posting.', 'error'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Publish'; }
}

// ══════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════
function setupSettings() {
    document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            full_name: document.getElementById('s-full-name').value.trim(),
            pronouns: document.getElementById('s-pronouns')?.value || null,
            nis_branch: document.getElementById('s-nis-branch').value,
            graduation_year: document.getElementById('s-grad-year').value ? parseInt(document.getElementById('s-grad-year').value) : null,
            university: document.getElementById('s-university').value.trim(),
            degree_major: document.getElementById('s-degree').value.trim(),
            bio: document.getElementById('s-bio').value.trim(),
            status: document.getElementById('s-status').value.trim(),
            birthday: document.getElementById('s-birthday').value || null,
            work_status: document.getElementById('s-work-status')?.value || null,
            company: document.getElementById('s-company')?.value?.trim() || null,
            workfield: document.getElementById('s-workfield')?.value?.trim() || null,
            wall_privacy: document.getElementById('s-wall-privacy')?.value || 'everyone',
            show_online: document.getElementById('s-show-online')?.checked ?? true,
            linkedin: document.getElementById('s-linkedin').value.trim(),
            instagram: document.getElementById('s-instagram').value.trim(),
            youtube: document.getElementById('s-youtube').value.trim(),
        };

        // Handle username change separately (once per week)
        const usernameInput = document.getElementById('s-username');
        const newUsername = usernameInput?.value?.trim()?.replace(/^@/, '');
        if (newUsername && newUsername !== currentUser?.username) {
            // Validate format
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
                showToast('Username must be 3-20 characters: letters, numbers, underscores only.', 'error');
                return;
            }
            // Check once-per-week restriction
            try {
                const { data: profile } = await supabaseClient.from('profiles').select('username_last_changed').eq('id', currentUser.user_id).single();
                if (profile?.username_last_changed) {
                    const lastChanged = new Date(profile.username_last_changed);
                    const daysSince = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSince < 7) {
                        const daysLeft = Math.ceil(7 - daysSince);
                        showToast(`You can change your username again in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`, 'error');
                        return;
                    }
                }
                // Check if username is taken
                const { data: existing } = await supabaseClient.from('profiles').select('id').eq('username', newUsername).neq('id', currentUser.user_id).maybeSingle();
                if (existing) {
                    showToast('This username is already taken.', 'error');
                    return;
                }
                formData.username = newUsername;
                formData.username_last_changed = new Date().toISOString();
            } catch(e) { console.error('Username check error:', e); }
        }

        try {
            await sbUpdateProfile(currentUser.user_id, formData);
            showToast('Settings saved!', 'success');
            if (formData.full_name) { currentUser.full_name = formData.full_name; updateNavAvatar(currentUser); }
            if (formData.username) { currentUser.username = formData.username; }
        } catch { showToast('Error saving.', 'error'); }
    });
}

async function loadSettings() {
    try {
        const u = await sbGetProfile(currentUser?.user_id);
        document.getElementById('s-full-name').value = u.full_name || '';
        if (document.getElementById('s-pronouns')) document.getElementById('s-pronouns').value = u.pronouns || '';
        document.getElementById('s-nis-branch').value = u.nis_branch || '';
        document.getElementById('s-grad-year').value = u.graduation_year || '';
        document.getElementById('s-university').value = u.university || '';
        document.getElementById('s-degree').value = u.degree_major || '';
        document.getElementById('s-bio').value = u.bio || '';
        document.getElementById('s-status').value = u.status || '';
        document.getElementById('s-birthday').value = u.birthday || '';
        document.getElementById('s-linkedin').value = u.linkedin || '';
        document.getElementById('s-instagram').value = u.instagram || '';
        document.getElementById('s-youtube').value = u.youtube || '';
        if (document.getElementById('s-work-status')) document.getElementById('s-work-status').value = u.work_status || '';
        if (document.getElementById('s-company')) document.getElementById('s-company').value = u.company || '';
        if (document.getElementById('s-workfield')) document.getElementById('s-workfield').value = u.workfield || '';
        if (document.getElementById('s-wall-privacy')) document.getElementById('s-wall-privacy').value = u.wall_privacy || 'everyone';
        if (document.getElementById('s-show-online')) document.getElementById('s-show-online').checked = u.show_online !== false;
        // Load username
        if (document.getElementById('s-username')) {
            document.getElementById('s-username').value = u.username || '';
            // Show when username can next be changed
            const hint = document.getElementById('s-username-hint');
            if (hint && u.username_last_changed) {
                const lastChanged = new Date(u.username_last_changed);
                const daysSince = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince < 7) {
                    const daysLeft = Math.ceil(7 - daysSince);
                    hint.textContent = `Next change available in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`;
                    hint.className = 'text-xs text-orange-500 mt-1';
                } else {
                    hint.textContent = 'You can change your username now.';
                    hint.className = 'text-xs text-green-500 mt-1';
                }
            }
        }
        // Disable university if not yet graduated (June 1st rule)
        const gradYear = u.graduation_year;
        const now = new Date();
        const hasGraduated = gradYear && (now.getFullYear() > gradYear || (now.getFullYear() === gradYear && now.getMonth() >= 5));
        const uniField = document.getElementById('s-university');
        if (uniField && gradYear && !hasGraduated) {
            uniField.disabled = true;
            uniField.placeholder = 'Available after graduation (June 1)';
            uniField.value = '';
        } else if (uniField) {
            uniField.disabled = false;
            uniField.placeholder = 'e.g. MIT';
        }
        // Also disable university for students who haven't graduated
        const uniGradField = document.getElementById('s-university');
        const degreeField = document.getElementById('s-degree');
        if (u.user_type === 'student' && !hasGraduated) {
            if (uniGradField) { uniGradField.disabled = true; uniGradField.placeholder = 'Available after graduation'; uniGradField.value = ''; }
            if (degreeField) { degreeField.disabled = true; degreeField.placeholder = 'Available after graduation'; degreeField.value = ''; }
        } else {
            if (degreeField) { degreeField.disabled = false; degreeField.placeholder = 'e.g. Computer Science'; }
        }
        const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=80&bold=true&font-size=0.4`;
        document.getElementById('settings-avatar-preview').src = avatarUrl;
        const coverPreview = document.getElementById('settings-cover-preview');
        if (coverPreview && u.cover_url) coverPreview.style.backgroundImage = `url('${u.cover_url}')`;
    } catch { }
}

// ── Password Change ──────────────────────────────────────
async function changePassword() {
    const newPw = document.getElementById('s-new-password')?.value;
    const confirmPw = document.getElementById('s-confirm-password')?.value;
    if (!newPw || !confirmPw) { showToast('Please fill in both password fields.', 'error'); return; }
    if (newPw.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
    if (newPw !== confirmPw) { showToast('Passwords do not match.', 'error'); return; }
    try {
        const { error } = await supabaseClient.auth.updateUser({ password: newPw });
        if (error) { showToast('Failed to update password: ' + error.message, 'error'); return; }
        showToast('Password updated successfully!', 'success');
        document.getElementById('s-new-password').value = '';
        document.getElementById('s-confirm-password').value = '';
    } catch(e) { showToast('Failed to update password.', 'error'); }
}

function setupAvatarUpload() {
    document.getElementById('avatar-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast('Avatar must be less than 2MB.', 'error'); e.target.value = ''; return; }
        try {
            const result = await sbUploadFile(file, 'avatars');
            await sbUpdateProfile(currentUser.user_id, { avatar_url: result.file_path });
            document.getElementById('settings-avatar-preview').src = result.file_path;
            currentUser.avatar_url = result.file_path; updateNavAvatar(currentUser);
            showToast('Avatar updated!', 'success');
        } catch { showToast('Upload error.', 'error'); }
    });
    document.getElementById('cover-upload-settings')?.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast('Cover image must be less than 2MB.', 'error'); e.target.value = ''; return; }
        try {
            const result = await sbUploadFile(file, 'covers');
            await sbUpdateProfile(currentUser.user_id, { cover_url: result.file_path });
            const preview = document.getElementById('settings-cover-preview');
            if (preview) preview.style.backgroundImage = `url('${result.file_path}')`;
            showToast('Cover updated!', 'success');
        } catch { showToast('Upload error.', 'error'); }
    });
}

// ══════════════════════════════════════════════════════════
//  GLOBAL SEARCH
// ══════════════════════════════════════════════════════════
function setupSearch() {
    const input = document.getElementById('global-search');
    let timer;
    input?.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const q = input.value.trim();
            if (q.length >= 2) { navigateTo('alumni'); document.getElementById('alumni-search').value = q; loadAlumni(true); }
        }, 400);
    });
}

// ══════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════
function escHtml(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

function formatTimeAgo(dateStr) {
    const d = new Date(dateStr); const now = new Date(); const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now'; if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`; if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showToast(msg, type = 'success') {
    const existing = document.querySelector('.toast-notification'); if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast-notification fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-lg transition-all duration-300 ${type === 'success' ? 'bg-navy text-white' : 'bg-red-500 text-white'}`;
    toast.textContent = msg; document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ══════════════════════════════════════════════════════════
//  CHAT FUNCTIONS
// ══════════════════════════════════════════════════════════
let currentChatUserId = null;
let chatPollInterval = null;
let lastRenderedMsgIds = []; // Track which messages are already rendered

async function loadConversations() {
    try {
        const conversations = await sbGetConversations(currentUser.user_id);
        const list = document.getElementById('chat-conv-list');
        if (!list) return;
        if (!conversations?.length) { list.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No conversations yet.<br><span class="text-xs">Visit a profile and click Chat to start.</span></div>'; return; }
        list.innerHTML = '';
        conversations.forEach(conv => {
            const u = conv.other_user;
            const avatarUrl = u?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.full_name || 'U')}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
            const lastMsg = conv.last_message;
            let preview = lastMsg?.content || '';
            if (lastMsg?.attachment_type && !preview) preview = `📎 ${lastMsg.attachment_type}`;
            if (preview.length > 40) preview = preview.slice(0, 40) + '…';
            const div = document.createElement('div');
            div.className = `flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition border-b border-gray-50 ${currentChatUserId === u?.id ? 'bg-accent/5' : ''}`;
            div.onclick = () => openChat(u?.id);
            div.innerHTML = `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover shrink-0" /><div class="flex-1 min-w-0"><div class="flex items-center justify-between"><span class="font-semibold text-sm text-navy truncate">${escHtml(u?.full_name || 'User')}</span><span class="text-xs text-gray-400 shrink-0">${lastMsg ? formatTimeAgo(lastMsg.created_at) : ''}</span></div><p class="text-xs text-gray-400 truncate">${escHtml(preview)}</p></div>`;
            list.appendChild(div);
        });
    } catch { }
}

async function openChat(userId) {
    currentChatUserId = userId;
    lastRenderedMsgIds = []; // Reset so full render happens
    if (chatPollInterval) clearInterval(chatPollInterval);
    document.getElementById('chat-thread-empty')?.classList.add('hidden');
    document.getElementById('chat-header')?.classList.remove('hidden');
    document.getElementById('chat-messages')?.classList.remove('hidden');
    document.getElementById('chat-input-area')?.classList.remove('hidden');
    // Mobile: show thread, hide sidebar
    if (window.innerWidth < 768) {
        document.getElementById('chat-sidebar')?.classList.add('hidden');
        document.getElementById('chat-thread')?.classList.remove('hidden');
        document.getElementById('chat-thread')?.classList.add('flex');
        document.body.classList.add('chat-open');
    }
    await loadMessages(userId);
    // Explicitly mark messages as read now that the user opened this chat
    const convId = await sbFindConversation(currentUser.user_id, userId);
    if (convId) sbMarkMessagesRead(convId, currentUser.user_id);
    fetchUnreadMessageCount();
    loadConversations();
    // Poll every 2 seconds for faster message delivery
    chatPollInterval = setInterval(() => loadMessages(userId), 2000);
    lucide.createIcons();
}

function closeMobileChat() {
    document.getElementById('chat-sidebar')?.classList.remove('hidden');
    if (window.innerWidth < 768) {
        document.getElementById('chat-thread')?.classList.add('hidden');
        document.getElementById('chat-thread')?.classList.remove('flex');
        document.body.classList.remove('chat-open');
    }
}

async function loadMessages(userId) {
    try {
        const data = await sbGetMessages(currentUser.user_id, userId);
        const u = data.other_user;
        if (u) {
            const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=36&bold=true&font-size=0.45`;
            document.getElementById('chat-other-avatar').src = avatarUrl;
            document.getElementById('chat-other-name').textContent = u.full_name;
            document.getElementById('chat-other-username').textContent = u.username ? `@${u.username}` : '';
        }
        const container = document.getElementById('chat-messages');
        const wasAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;

        // ── Incremental DOM update (prevents scroll jump) ────
        const newMsgIds = (data.messages || []).map(m => String(m.id));
        const needsFullRender = lastRenderedMsgIds.length === 0 ||
            lastRenderedMsgIds[0] !== newMsgIds[0]; // conversation changed

        if (!data.messages?.length) {
            container.innerHTML = '<div class="text-center text-gray-400 text-sm py-8">No messages yet. Say hi!</div>';
            lastRenderedMsgIds = [];
        } else if (needsFullRender) {
            // Full re-render (first load or conversation switch)
            container.innerHTML = '';
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            data.messages.forEach(msg => {
                container.appendChild(buildMsgElement(msg, oneHourAgo));
            });
            lastRenderedMsgIds = newMsgIds;
            container.scrollTop = container.scrollHeight;
        } else {
            // Incremental: only append new messages that aren't in the DOM yet
            const existingIds = new Set(lastRenderedMsgIds);
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            let addedNew = false;

            // Also remove optimistic "Sending…" messages
            container.querySelectorAll('.msg-optimistic').forEach(el => el.remove());

            data.messages.forEach(msg => {
                const msgIdStr = String(msg.id);
                if (!existingIds.has(msgIdStr)) {
                    container.appendChild(buildMsgElement(msg, oneHourAgo));
                    addedNew = true;
                } else {
                    // ── Live read receipt update on existing messages ──
                    // If this is MY message and it's now read, update the checkmark in-place
                    const isMine = msg.sender_id === currentUser?.user_id;
                    if (isMine && msg.read_at) {
                        const msgEl = container.querySelector(`[data-msg-id="${msg.id}"]`);
                        if (msgEl) {
                            const checkSpan = msgEl.querySelector('.msg-read-check');
                            if (checkSpan && checkSpan.dataset.read !== '1') {
                                checkSpan.className = 'text-blue-400 ml-1 msg-read-check read-receipt-anim';
                                checkSpan.textContent = '✓✓';
                                checkSpan.dataset.read = '1';
                            }
                        }
                    }
                }
            });
            lastRenderedMsgIds = newMsgIds;
            if (addedNew && wasAtBottom) container.scrollTop = container.scrollHeight;
        }

        lucide.createIcons();

        // Mark incoming messages as read — only because user is actively viewing this chat
        if (currentChatUserId === userId) {
            const hasUnread = (data.messages || []).some(m => m.sender_id !== currentUser.user_id && !m.read_at);
            if (hasUnread) {
                const convId = await sbFindConversation(currentUser.user_id, userId);
                if (convId) sbMarkMessagesRead(convId, currentUser.user_id);
            }
        }
    } catch { }
}

// Build a single message DOM element (extracted for reuse)
function buildMsgElement(msg, oneHourAgo) {
    const isMine = msg.sender_id === currentUser?.user_id;
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex ${isMine ? 'justify-end' : 'justify-start'} group`;
    msgDiv.dataset.msgId = msg.id;
    let contentHtml = '';
    if (msg.content) contentHtml = `<p class="text-sm whitespace-pre-wrap msg-content-text">${escHtml(msg.content)}</p>`;
    if (msg.attachment_path) {
        const type = msg.attachment_type || '';
        if (type.startsWith('image')) contentHtml += `<img src="${msg.attachment_path}" class="rounded-lg max-w-xs mt-1 cursor-pointer hover:opacity-90 transition" onclick="openMediaViewer('${msg.attachment_path}', 'image')" />`;
        else if (type.startsWith('audio')) contentHtml += `<audio controls src="${msg.attachment_path}" class="mt-1 max-w-[250px]"></audio>`;
        else if (type.startsWith('video')) contentHtml += `<video controls src="${msg.attachment_path}" class="rounded-lg max-w-xs mt-1 cursor-pointer" onclick="openMediaViewer('${msg.attachment_path}', 'video')"></video>`;
        else contentHtml += `<a href="${msg.attachment_path}" target="_blank" class="text-xs underline mt-1 block">📎 Attachment</a>`;
    }
    const isRead = !!msg.read_at;
    const readCheck = isMine ? (isRead
        ? '<span class="text-blue-400 ml-1 msg-read-check" data-read="1">✓✓</span>'
        : '<span class="text-white/40 ml-1 msg-read-check" data-read="0">✓</span>') : '';
    const editedLabel = msg.edited_at ? `<span class="text-[9px] ${isMine ? 'text-white/40' : 'text-gray-400'} ml-1">edited</span>` : '';
    const canEdit = isMine && msg.content && new Date(msg.created_at).getTime() > oneHourAgo;
    const editBtn = canEdit ? `<button onclick="startEditMsg('${msg.id}', this)" class="edit-msg-btn opacity-0 group-hover:opacity-100 text-[10px] ${isMine ? 'text-white/40 hover:text-white/80' : 'text-gray-400 hover:text-gray-600'} transition ml-1" title="Edit"><i data-lucide="pencil" class="w-3 h-3 inline"></i></button>` : '';
    msgDiv.innerHTML = `<div class="max-w-[70%] ${isMine ? 'bg-navy text-white' : 'bg-white text-navy border border-gray-200'} rounded-2xl px-4 py-2.5 shadow-sm msg-bubble">${contentHtml}<p class="text-[10px] ${isMine ? 'text-white/50' : 'text-gray-400'} mt-1 flex items-center gap-0.5">${formatTimeAgo(msg.created_at)}${editedLabel}${readCheck}${editBtn}</p></div>`;
    return msgDiv;
}

function startEditMsg(msgId, btnEl) {
    const msgDiv = btnEl.closest('[data-msg-id]');
    const bubble = msgDiv?.querySelector('.msg-bubble');
    const textEl = bubble?.querySelector('.msg-content-text');
    if (!textEl || !bubble) return;
    const oldText = textEl.textContent;
    bubble.innerHTML = `
        <textarea class="w-full text-sm bg-transparent border border-white/30 rounded-lg px-2 py-1 text-inherit resize-none outline-none" rows="2">${escHtml(oldText)}</textarea>
        <div class="flex gap-2 mt-1">
            <button onclick="saveEditMsg('${msgId}', this)" class="text-[10px] font-semibold px-2 py-0.5 rounded bg-accent text-navy">Save</button>
            <button onclick="cancelEditMsg(this)" class="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-500/30 text-inherit">Cancel</button>
        </div>
    `;
    bubble.querySelector('textarea').focus();
}

async function saveEditMsg(msgId, btnEl) {
    const bubble = btnEl.closest('.msg-bubble');
    const textarea = bubble?.querySelector('textarea');
    const newContent = textarea?.value?.trim();
    if (!newContent) return;
    try {
        const { error } = await supabaseClient.from('messages').update({ content: newContent, edited_at: new Date().toISOString() }).eq('id', msgId).eq('sender_id', currentUser.user_id);
        if (error) { console.error('Edit message error:', error); showToast('Failed to edit message', 'error'); return; }
        showToast('Message edited', 'success');
        lastRenderedMsgIds = []; // Force full re-render to show edit
        loadMessages(currentChatUserId);
    } catch(e) { showToast('Failed to edit message', 'error'); }
}

function cancelEditMsg(btnEl) {
    lastRenderedMsgIds = []; // Force full re-render to restore original
    loadMessages(currentChatUserId);
}

let pendingChatAttachment = null;

async function sendChatMessage() {
    if (!currentChatUserId) return;
    const input = document.getElementById('chat-msg-input');
    const content = input.value.trim();
    if (!content && !pendingChatAttachment) return;
    input.value = '';

    // Optimistic: show message immediately in chat
    const container = document.getElementById('chat-messages');
    if (content && container) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'flex justify-end msg-enter msg-optimistic';
        msgDiv.innerHTML = `<div class="max-w-[70%] bg-navy text-white rounded-2xl px-4 py-2.5 shadow-sm opacity-70"><p class="text-sm">${escHtml(content)}</p><p class="text-[10px] text-white/50 mt-1 flex items-center gap-0.5">Sending…</p></div>`;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }

    try {
        let attachPath = null, attachType = null;
        if (pendingChatAttachment) {
            const result = await sbUploadFileWithProgress(pendingChatAttachment.file, 'chat');
            attachPath = result.file_path;
            attachType = pendingChatAttachment.file.type;
            clearChatAttachment();
        }
        await sbSendMessage(currentUser.user_id, currentChatUserId, content || '', attachPath, attachType);
        // Force a fresh render on next poll to pick up the real message from DB
        // Don't call loadMessages here — the 2s poll will pick it up without scroll jump
        // Instead, just trigger a quick poll after a brief delay
        setTimeout(() => {
            lastRenderedMsgIds = []; // Force full re-render to get the real message
            loadMessages(currentChatUserId);
        }, 500);
        // Notify message receiver
        createNotification('message', currentChatUserId);
    } catch(e) { showToast('Failed to send message', 'error'); }
}

document.getElementById('chat-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file || !currentChatUserId) return;
    pendingChatAttachment = { file };
    const preview = document.getElementById('chat-attach-preview');
    const thumb = document.getElementById('chat-attach-thumb');
    const nameEl = document.getElementById('chat-attach-name');
    preview.classList.remove('hidden'); nameEl.textContent = file.name;
    if (file.type.startsWith('image/')) { thumb.innerHTML = `<img src="${URL.createObjectURL(file)}" />`; }
    else if (file.type.startsWith('video/')) { thumb.innerHTML = `<video src="${URL.createObjectURL(file)}" muted></video>`; }
    else { thumb.innerHTML = '<i data-lucide="file" class="w-5 h-5 text-gray-400"></i>'; lucide.createIcons(); }
    e.target.value = '';
});

function clearChatAttachment() {
    pendingChatAttachment = null;
    document.getElementById('chat-attach-preview')?.classList.add('hidden');
    const thumb = document.getElementById('chat-attach-thumb'); if (thumb) thumb.innerHTML = '';
}

// ══════════════════════════════════════════════════════════
//  MEDIA VIEWER
// ══════════════════════════════════════════════════════════
let mediaViewerItems = [];
let mediaViewerIndex = 0;

function openMediaViewer(src, type, items, index) {
    const viewer = document.getElementById('media-viewer');
    viewer.classList.remove('hidden'); document.body.style.overflow = 'hidden';
    if (items && items.length > 1) { mediaViewerItems = items; mediaViewerIndex = index || 0; document.getElementById('media-prev')?.classList.remove('hidden'); document.getElementById('media-next')?.classList.remove('hidden'); }
    else { mediaViewerItems = [{ src, type }]; mediaViewerIndex = 0; document.getElementById('media-prev')?.classList.add('hidden'); document.getElementById('media-next')?.classList.add('hidden'); }
    renderMediaContent();
}

function renderMediaContent() {
    const content = document.getElementById('media-content');
    const item = mediaViewerItems[mediaViewerIndex]; if (!item) return;
    if (item.type === 'image' || item.type?.startsWith('image')) content.innerHTML = `<img src="${item.src}" class="max-h-[85vh] max-w-full object-contain rounded-lg" />`;
    else if (item.type === 'video' || item.type?.startsWith('video')) content.innerHTML = `<video controls autoplay src="${item.src}" class="max-h-[85vh] max-w-full rounded-lg"></video>`;
    else if (item.type === 'audio' || item.type?.startsWith('audio')) content.innerHTML = `<div class="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center"><p class="text-white mb-4">Audio</p><audio controls autoplay src="${item.src}" class="mx-auto"></audio></div>`;
}

function closeMediaViewer() { document.getElementById('media-viewer')?.classList.add('hidden'); document.getElementById('media-content').innerHTML = ''; document.body.style.overflow = ''; mediaViewerItems = []; }
function mediaViewerNav(dir) { mediaViewerIndex += dir; if (mediaViewerIndex < 0) mediaViewerIndex = mediaViewerItems.length - 1; if (mediaViewerIndex >= mediaViewerItems.length) mediaViewerIndex = 0; renderMediaContent(); }

document.addEventListener('keydown', (e) => {
    const viewer = document.getElementById('media-viewer');
    if (viewer?.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeMediaViewer(); if (e.key === 'ArrowLeft') mediaViewerNav(-1); if (e.key === 'ArrowRight') mediaViewerNav(1);
});

// ══════════════════════════════════════════════════════════
//  AUDIO RECORDING
// ══════════════════════════════════════════════════════════
let audioRecorder = null;
let audioChunks = [];
let audioContext = '';

async function toggleAudioRecording(context) {
    if (audioRecorder && audioRecorder.state === 'recording') { audioRecorder.stop(); return; }
    audioContext = context; audioChunks = [];
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        audioRecorder.onstop = async () => {
            if (audioRecorder._timer) clearInterval(audioRecorder._timer);
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
            try {
                const result = await sbUploadFileWithProgress(file, 'audio');
                if (audioContext === 'chat' && currentChatUserId) {
                    await sbSendMessage(currentUser.user_id, currentChatUserId, '', result.file_path, 'audio/webm');
                    loadMessages(currentChatUserId);
                }
            } catch { }
            if (audioContext === 'chat') { document.getElementById('chat-recording-indicator')?.classList.add('hidden'); const btn = document.getElementById('chat-audio-btn'); if (btn) btn.classList.remove('text-red-500'); }
            audioRecorder = null;
        };
        audioRecorder.start();
        if (context === 'chat') {
            document.getElementById('chat-recording-indicator')?.classList.remove('hidden');
            const btn = document.getElementById('chat-audio-btn');
            if (btn) btn.classList.add('text-red-500');
            // Recording timer
            let secs = 0;
            const indicator = document.getElementById('chat-recording-indicator');
            if (indicator) indicator.textContent = '🔴 0:00';
            audioRecorder._timer = setInterval(() => {
                secs++;
                const m = Math.floor(secs / 60);
                const s = String(secs % 60).padStart(2, '0');
                if (indicator) indicator.textContent = `🔴 ${m}:${s}`;
            }, 1000);
        }
    } catch { showToast('Microphone access denied.', 'error'); }
}

// ══════════════════════════════════════════════════════════
//  FOLLOWERS / FOLLOWING LIST MODAL
// ══════════════════════════════════════════════════════════
async function showFollowList(type) {
    const modal = document.getElementById('follow-list-modal');
    const title = document.getElementById('follow-list-title');
    const body = document.getElementById('follow-list-body');
    modal.classList.remove('hidden'); title.textContent = type === 'followers' ? 'Followers' : 'Following';
    body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Loading…</div>';
    const userId = profileUserId || currentUser?.user_id;
    try {
        const users = await sbGetFollowList(userId, type);
        if (!users?.length) { body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">No ' + type + ' yet.</div>'; return; }
        body.innerHTML = '';
        users.forEach(u => {
            const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
            const div = document.createElement('div');
            div.className = 'flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition';
            div.onclick = () => { closeFollowListModal(); navigateTo('profile', u.id); };
            div.innerHTML = `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover" /><div class="flex-1 min-w-0"><p class="font-semibold text-sm text-navy truncate">${escHtml(u.full_name)}</p><p class="text-xs text-gray-400 truncate">${u.username ? '@' + u.username : (u.nis_branch || '')}</p></div>`;
            body.appendChild(div);
        });
    } catch { }
}

function closeFollowListModal() { document.getElementById('follow-list-modal')?.classList.add('hidden'); }

// ══════════════════════════════════════════════════════════
//  NEW MESSAGE PICKER
// ══════════════════════════════════════════════════════════
async function showNewMessagePicker() {
    const modal = document.getElementById('new-msg-modal');
    const body = document.getElementById('new-msg-list');
    modal.classList.remove('hidden');
    body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Loading…</div>';
    try {
        const users = await sbGetFollowList(currentUser.user_id, 'following');
        if (!users?.length) { body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">You\'re not following anyone yet.</div>'; return; }
        body.innerHTML = '';
        users.forEach(u => {
            const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
            const div = document.createElement('div');
            div.className = 'flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition';
            div.onclick = () => { closeNewMsgModal(); openChat(u.id); };
            div.innerHTML = `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover" /><div class="flex-1 min-w-0"><p class="font-semibold text-sm text-navy truncate">${escHtml(u.full_name)}</p><p class="text-xs text-gray-400 truncate">${u.username ? '@' + u.username : ''}</p></div><i data-lucide="message-square" class="w-4 h-4 text-gray-300"></i>`;
            body.appendChild(div);
        });
        lucide.createIcons();
    } catch { }
}

function closeNewMsgModal() { document.getElementById('new-msg-modal')?.classList.add('hidden'); }

// ══════════════════════════════════════════════════════════
//  OPEN CHAT FROM PROFILE
// ══════════════════════════════════════════════════════════
function openChatWithProfileUser() {
    const btn = document.getElementById('profile-follow-btn');
    const userId = btn?.dataset.userId;
    if (userId) { navigateTo('chat'); setTimeout(() => openChat(userId), 300); }
}

// ══════════════════════════════════════════════════════════
//  DARK THEME
// ══════════════════════════════════════════════════════════
function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('nis-dark', isDark ? '1' : '0');
    updateDarkIcons();
}

function updateDarkIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('.dark-icon-moon').forEach(el => el.classList.toggle('hidden', isDark));
    document.querySelectorAll('.dark-icon-sun').forEach(el => el.classList.toggle('hidden', !isDark));
}

(function initDarkMode() {
    if (localStorage.getItem('nis-dark') === '1') document.documentElement.classList.add('dark');
    updateDarkIcons();
})();

// ══════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════════════════
let notifCache = [];

async function loadNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container || !currentUser?.user_id) return;
    container.innerHTML = '<div class="text-center py-12 text-gray-400"><div class="inline-block w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin"></div></div>';
    try {
        const { data, error } = await supabaseClient
            .from('notifications')
            .select('*, actor:profiles!notifications_actor_id_fkey(full_name, avatar_url, username)')
            .eq('target_user_id', currentUser.user_id)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw error;
        notifCache = data || [];
        container.innerHTML = '';
        if (!notifCache.length) {
            container.innerHTML = '<div class="text-center py-12 text-gray-400"><p>No notifications yet</p></div>';
            return;
        }
        notifCache.forEach(n => {
            container.appendChild(createNotifCard(n));
        });
        updateNotifBadge();
        lucide.createIcons();
    } catch(e) {
        console.log('Notifications table may not exist yet:', e.message);
        container.innerHTML = '<div class="text-center py-12 text-gray-400"><p>No notifications yet</p></div>';
    }
}

function createNotifCard(n) {
    const div = document.createElement('div');
    div.className = `notif-card relative ${n.read ? '' : 'unread'}`;
    const actor = n.actor || {};
    const avatarUrl = actor.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.full_name || 'U')}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
    const timeAgo = formatTimeAgo(n.created_at);
    let icon = 'bell', text = 'notified you', color = 'text-gray-400';
    switch(n.type) {
        case 'follow': icon = 'user-plus'; text = 'started following you'; color = 'text-blue-500'; break;
        case 'like': icon = 'heart'; text = 'liked your post'; color = 'text-red-500'; break;
        case 'comment': icon = 'message-circle'; text = 'commented on your post'; color = 'text-green-500'; break;
        case 'message': icon = 'message-square'; text = 'sent you a message'; color = 'text-navy dark:text-accent'; break;
        case 'repost': icon = 'repeat-2'; text = 'reposted your post'; color = 'text-green-500'; break;
        case 'wall_post': icon = 'edit-3'; text = 'posted on your wall'; color = 'text-purple-500'; break;
    }
    div.innerHTML = `
        <img src="${avatarUrl}" loading="lazy" class="w-10 h-10 rounded-full object-cover shrink-0" />
        <div class="flex-1 min-w-0">
            <p class="text-sm"><span class="font-semibold text-navy dark:text-white">${escHtml(actor.full_name || 'Someone')}</span> <span class="text-gray-500 dark:text-gray-400">${text}</span></p>
            <span class="text-xs text-gray-400">${timeAgo}</span>
        </div>
        <i data-lucide="${icon}" class="w-4 h-4 ${color} shrink-0"></i>
    `;
    div.onclick = () => {
        markNotifRead(n.id);
        if (n.type === 'follow') {
            navigateTo('profile', n.actor_id);
        } else if (n.type === 'message') {
            navigateTo('chat');
            if (n.actor_id) setTimeout(() => openChat(n.actor_id), 500);
        } else if (n.type === 'like' || n.type === 'repost' || n.type === 'wall_post') {
            navigateTo('feed');
            // Scroll to the specific post after feed loads
            if (n.post_id) setTimeout(() => {
                const postEl = document.querySelector(`[data-post-id="${n.post_id}"]`);
                if (postEl) postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 800);
        } else if (n.type === 'comment') {
            navigateTo('feed');
            // Open the post and scroll to it
            if (n.post_id) setTimeout(() => {
                const postEl = document.querySelector(`[data-post-id="${n.post_id}"]`);
                if (postEl) {
                    postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Auto-open comments if there's a comment toggle
                    const commentBtn = postEl.querySelector('.toggle-comments');
                    if (commentBtn) commentBtn.click();
                }
            }, 800);
        } else {
            navigateTo('notifications');
        }
    };
    return div;
}

async function markNotifRead(id) {
    try { await supabaseClient.from('notifications').update({ read: true }).eq('id', id); } catch(e) {}
    const el = document.querySelector(`.notif-card[data-id="${id}"]`);
    el?.classList.remove('unread');
    updateNotifBadge();
}

async function markAllNotificationsRead() {
    try {
        await supabaseClient.from('notifications').update({ read: true }).eq('target_user_id', currentUser.user_id).eq('read', false);
        document.querySelectorAll('.notif-card.unread').forEach(el => el.classList.remove('unread'));
        updateNotifBadge();
        showToast('All notifications marked as read', 'success');
    } catch(e) { console.log('markAllRead error:', e); }
}

function updateNotifBadge() {
    const unread = notifCache.filter(n => !n.read).length;
    ['header-notif-badge', 'mobile-notif-badge'].forEach(id => {
        const badge = document.getElementById(id);
        if (!badge) return;
        if (unread > 0) {
            badge.textContent = unread > 9 ? '9+' : unread;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

// Fetch unread count on load
async function fetchUnreadNotifCount() {
    if (!currentUser?.user_id) return;
    try {
        const { count } = await supabaseClient.from('notifications').select('id', { count: 'exact', head: true }).eq('target_user_id', currentUser.user_id).eq('read', false);
        if (count > 0) {
            notifCache = Array(count).fill({ read: false }); // placeholder for badge count
            updateNotifBadge();
        }
    } catch(e) {}
}

// ══════════════════════════════════════════════════════════
//  SUPABASE REALTIME ENGINE (event-driven architecture)
// ══════════════════════════════════════════════════════════
let realtimeChannel = null;
let realtimeInteractionsChannel = null;

function subscribeToRealtime() {
    if (!currentUser?.user_id || realtimeChannel) return;
    try {
        // ── Channel 1: Messages + Notifications (user-scoped) ──
        realtimeChannel = supabaseClient.channel('user-events-' + currentUser.user_id)

            // ▸ NEW MESSAGES (INSERT)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, (payload) => {
                const msg = payload.new;
                // Only react to messages sent TO me (I'm not the sender)
                if (msg.sender_id === currentUser.user_id) return;

                // Context-aware suppression: if I'm in the chat with this sender, just refresh stream
                if (currentSection === 'chat' && currentChatUserId) {
                    // Check if this message belongs to the open conversation
                    sbFindConversation(currentUser.user_id, currentChatUserId).then(openConvId => {
                        if (openConvId && msg.conversation_id === openConvId) {
                            // Already viewing this chat — just refresh messages, NO pop-up
                            lastRenderedMsgIds = [];
                            loadMessages(currentChatUserId);
                        } else {
                            // Different conversation — show pop-up
                            showSmartNotification('message', msg.sender_id);
                        }
                    });
                } else {
                    // Not in chat section — show pop-up notification
                    showSmartNotification('message', msg.sender_id);
                }
                fetchUnreadMessageCount();
                if (currentSection === 'chat') loadConversations();
            })

            // ▸ MESSAGE UPDATES (edits + read receipts)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages'
            }, (payload) => {
                const msg = payload.new;

                // Read receipt: someone read MY message
                // Note: we don't rely on payload.old (requires REPLICA IDENTITY FULL)
                // Instead, we check if the DOM element hasn't been updated yet
                if (msg.read_at && msg.sender_id === currentUser.user_id) {
                    const msgEl = document.querySelector(`[data-msg-id="${msg.id}"]`);
                    if (msgEl) {
                        const checkSpan = msgEl.querySelector('.msg-read-check');
                        if (checkSpan && checkSpan.dataset.read !== '1') {
                            checkSpan.className = 'text-blue-400 ml-1 msg-read-check read-receipt-anim';
                            checkSpan.textContent = '✓✓';
                            checkSpan.dataset.read = '1';
                        }
                    }
                }

                // Message edit: someone edited a message in my open chat
                if (msg.edited_at) {
                    const msgEl = document.querySelector(`[data-msg-id="${msg.id}"]`);
                    if (msgEl) {
                        const textEl = msgEl.querySelector('.msg-content-text');
                        if (textEl && textEl.textContent !== msg.content) {
                            textEl.textContent = msg.content;
                            const bubble = msgEl.querySelector('.msg-bubble');
                            if (bubble) {
                                bubble.classList.add('live-edit-flash');
                                setTimeout(() => bubble.classList.remove('live-edit-flash'), 1200);
                            }
                            lastRenderedMsgIds = [];
                            if (currentChatUserId) loadMessages(currentChatUserId);
                        }
                    }
                }

                // Refresh unread badge when any read_at changes
                if (msg.read_at) fetchUnreadMessageCount();
            })

            // ▸ NEW NOTIFICATIONS
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `target_user_id=eq.${currentUser.user_id}`
            }, (payload) => {
                const n = payload.new;
                notifCache.unshift(n);
                updateNotifBadge();

                // Context-aware: suppress message notifications if already in chat
                if (n.type === 'message' && currentSection === 'chat') {
                    // Suppressed — already handled by messages INSERT listener
                } else {
                    showNotificationToast(n);
                    sendBrowserNotification(n);
                }

                if (currentSection === 'notifications') loadNotifications();
            })
            .subscribe();

        // ── Channel 2: Feed interactions (broadcast to all) ────
        realtimeInteractionsChannel = supabaseClient.channel('feed-events')

            // ▸ POST EDITS (live update for all feed viewers)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'posts'
            }, (payload) => {
                const post = payload.new;
                const old = payload.old;
                if (post.content !== old.content || (post.edited_at && post.edited_at !== old.edited_at)) {
                    // Live post edit: update in DOM for all viewers
                    const postCard = document.querySelector(`[data-post-id="${post.id}"]`);
                    if (postCard) {
                        const contentEl = postCard.querySelector('.post-content-text');
                        if (contentEl) {
                            contentEl.textContent = post.content;
                            postCard.classList.add('live-edit-flash');
                            setTimeout(() => postCard.classList.remove('live-edit-flash'), 1200);
                        }
                        // Show "edited" label
                        if (!postCard.querySelector('.post-edited-label')) {
                            const timeEl = postCard.querySelector('.text-gray-400.text-xs');
                            if (timeEl && !timeEl.textContent.includes('edited')) {
                                timeEl.textContent += ' · edited';
                            }
                        }
                    }
                }
            })

            // ▸ NEW POSTS (live insert at top of feed)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'posts'
            }, (payload) => {
                const post = payload.new;
                // Don't duplicate my own optimistic posts
                if (post.user_id === currentUser?.user_id) return;
                // If on feed, reload to show new post with animation
                if (currentSection === 'feed') {
                    loadPosts(true); // true = force refresh
                }
            })

            // ▸ LIKES (live count update)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'post_likes'
            }, (payload) => {
                const like = payload.new || payload.old;
                if (!like?.post_id) return;
                const postCard = document.querySelector(`[data-post-id="${like.post_id}"]`);
                if (postCard) {
                    const likeCountEl = postCard.querySelector('.like-count');
                    if (likeCountEl) {
                        const current = parseInt(likeCountEl.textContent) || 0;
                        const newCount = payload.eventType === 'INSERT' ? current + 1 : Math.max(0, current - 1);
                        likeCountEl.textContent = newCount;
                        likeCountEl.classList.add('like-count-bounce');
                        setTimeout(() => likeCountEl.classList.remove('like-count-bounce'), 350);
                    }
                    // Update like button state if it's my like
                    if ((payload.new?.user_id || payload.old?.user_id) === currentUser?.user_id) {
                        const likeBtn = postCard.querySelector('.like-btn');
                        if (likeBtn) {
                            if (payload.eventType === 'INSERT') {
                                likeBtn.classList.add('text-red-500');
                            } else {
                                likeBtn.classList.remove('text-red-500');
                            }
                        }
                    }
                }
            })

            // ▸ COMMENTS (live count update)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'post_comments'
            }, (payload) => {
                const comment = payload.new;
                if (!comment?.post_id) return;
                const postCard = document.querySelector(`[data-post-id="${comment.post_id}"]`);
                if (postCard) {
                    const commentCountEl = postCard.querySelector('.comment-count');
                    if (commentCountEl) {
                        const current = parseInt(commentCountEl.textContent) || 0;
                        commentCountEl.textContent = current + 1;
                    }
                }
            })
            .subscribe();

    } catch(e) { console.log('Realtime subscription error:', e); }
}

// Smart notification: context-aware pop-up or silent refresh
async function showSmartNotification(type, actorId) {
    showNotificationToast({ type, actor_id: actorId, created_at: new Date().toISOString() });
    sendBrowserNotification({ type });
}

async function showNotificationToast(n) {
    // Fetch actor profile for avatar + name
    let actorName = 'Someone', actorAvatar = '';
    try {
        const { data } = await supabaseClient.from('profiles').select('full_name, avatar_url').eq('id', n.actor_id).single();
        if (data) {
            actorName = data.full_name || 'Someone';
            actorAvatar = data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
        }
    } catch(e) {}
    const texts = {
        follow: 'started following you',
        like: 'liked your post',
        comment: 'commented on your post',
        message: 'new message',
        repost: 'reposted your post'
    };
    const text = texts[n.type] || 'sent you a notification';
    const icons = { follow: '👤', like: '❤️', comment: '💬', message: '✉️', repost: '🔄' };
    const icon = icons[n.type] || '🔔';
    // Show rich notification bar toast with spring animation
    const bar = document.getElementById('notification-bar');
    if (bar) {
        const toast = document.createElement('div');
        toast.className = 'flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-lg notif-toast-enter cursor-pointer';
        toast.innerHTML = `
            ${actorAvatar ? `<img src="${actorAvatar}" class="w-8 h-8 rounded-full object-cover shrink-0" />` : `<span class="text-lg">${icon}</span>`}
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-navy dark:text-white truncate">${escHtml(actorName)}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${text}</p>
            </div>
            <button class="text-gray-300 hover:text-gray-500 text-xs" onclick="event.stopPropagation();this.parentElement.remove();">✕</button>
        `;
        toast.onclick = () => { 
            toast.remove();
            if (n.type === 'follow') navigateTo('profile', n.actor_id);
            else if (n.type === 'message') {
                navigateTo('chat');
                if (n.actor_id) setTimeout(() => openChat(n.actor_id), 500);
            }
            else if (n.post_id) navigateTo('feed');
            else navigateTo('notifications');
        };
        bar.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-10px)'; setTimeout(() => toast.remove(), 300); }, 5000);
    }
}

function sendBrowserNotification(n) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const texts = {
        follow: 'started following you',
        like: 'liked your post',
        comment: 'commented on your post',
        message: 'new message',
        repost: 'reposted your post'
    };
    try {
        new Notification('NISLink', {
            body: texts[n.type] || 'New notification',
            icon: '/assets/icon-192.png',
            badge: '/assets/icon-192.png'
        });
    } catch(e) {}
}

function requestBrowserNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ══════════════════════════════════════════════════════════
//  CREATE NOTIFICATION (insert into notifications table)
// ══════════════════════════════════════════════════════════
async function createNotification(type, targetUserId, postId) {
    if (!currentUser?.user_id || targetUserId === currentUser.user_id) return;
    try {
        const row = { type, actor_id: currentUser.user_id, target_user_id: targetUserId };
        if (postId) row.post_id = postId;
        await supabaseClient.from('notifications').insert(row);
    } catch(e) { console.log('createNotification error:', e.message); }
}

// Get post owner ID for notification routing
async function getPostOwnerId(postId) {
    try {
        const { data } = await supabaseClient.from('posts').select('user_id').eq('id', postId).single();
        return data?.user_id;
    } catch { return null; }
}

// ══════════════════════════════════════════════════════════
//  UNREAD MESSAGE COUNT (with one-time historical fix)
// ══════════════════════════════════════════════════════════
let _historicalMigrationDone = false;

async function fetchUnreadMessageCount() {
    if (!currentUser?.user_id) return;
    try {
        // ── One-time fix: historical messages have NULL read_at ──
        // Messages created before the read_at column was added all have
        // read_at = NULL, which makes them look "unread". Fix by setting
        // read_at = created_at for MY received messages that have no read_at.
        if (!_historicalMigrationDone) {
            _historicalMigrationDone = true;
            try {
                // Get my conversations
                const { data: myConvs } = await supabaseClient.from('conversations')
                    .select('id')
                    .or(`user_a.eq.${currentUser.user_id},user_b.eq.${currentUser.user_id}`);
                if (myConvs?.length) {
                    const myConvIds = myConvs.map(c => c.id);
                    // Find all old unread messages sent TO me (not by me)
                    const { data: oldMsgs } = await supabaseClient.from('messages')
                        .select('id, created_at')
                        .in('conversation_id', myConvIds)
                        .neq('sender_id', currentUser.user_id)
                        .is('read_at', null)
                        .order('created_at', { ascending: true })
                        .limit(500);
                    // If there are "old" unread messages (more than what's reasonably new),
                    // mark them all as read using their created_at as the read timestamp
                    if (oldMsgs?.length > 0) {
                        // Mark all as read NOW — these are phantom unreads
                        const ids = oldMsgs.map(m => m.id);
                        await supabaseClient.from('messages')
                            .update({ read_at: new Date().toISOString() })
                            .in('id', ids);
                        console.log('[NIS] Migrated', ids.length, 'historical messages to read');
                    }
                }
            } catch(migErr) { console.log('[NIS] Migration skipped:', migErr.message); }
        }

        // ── Now count genuinely unread messages ──────────────────
        const { data: convs, error: convErr } = await supabaseClient.from('conversations')
            .select('id')
            .or(`user_a.eq.${currentUser.user_id},user_b.eq.${currentUser.user_id}`);
        if (convErr || !convs?.length) { updateChatBadge(0); return; }
        const convIds = convs.map(c => c.id);

        let count = 0;
        try {
            const result = await supabaseClient.from('messages')
                .select('id', { count: 'exact', head: true })
                .in('conversation_id', convIds)
                .neq('sender_id', currentUser.user_id)
                .is('read_at', null);

            if (result.error) {
                console.log('Unread count query error:', result.error.message);
                updateChatBadge(0);
                return;
            }
            count = result.count || 0;
        } catch(qe) {
            updateChatBadge(0);
            return;
        }

        // If I'm currently viewing a chat, those messages are being read now,
        // so subtract them (they'll be marked read on next poll)
        if (currentChatUserId && currentSection === 'chat') {
            const openConvId = await sbFindConversation(currentUser.user_id, currentChatUserId);
            if (openConvId && convIds.includes(openConvId)) {
                const { count: openCount } = await supabaseClient.from('messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('conversation_id', openConvId)
                    .neq('sender_id', currentUser.user_id)
                    .is('read_at', null);
                count = Math.max(0, count - (openCount || 0));
            }
        }

        updateChatBadge(count);
    } catch(e) { console.log('fetchUnreadMessageCount error:', e); updateChatBadge(0); }
}

function updateChatBadge(count) {
    // Mobile bottom nav chat badge
    document.querySelectorAll('[data-nav="chat"]').forEach(btn => {
        let badge = btn.querySelector('.chat-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'chat-badge';
                btn.style.position = 'relative';
                btn.appendChild(badge);
            }
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.cssText = `
                position:absolute; top:-2px; right:2px;
                min-width:18px; height:18px; padding:0 5px;
                background:linear-gradient(135deg,#ef4444,#dc2626);
                color:#fff; font-size:10px; font-weight:700;
                border-radius:9px; display:flex; align-items:center;
                justify-content:center; box-shadow:0 2px 6px rgba(239,68,68,.4);
                border:2px solid var(--bg,#f3f4f6);
                animation: badgePop .3s ease;
            `;
        } else if (badge) {
            badge.remove();
        }
    });
    // Desktop sidebar chat link badge
    const desktopChat = document.querySelector('[data-nav="chat"].nav-item');
    if (desktopChat) {
        let badge = desktopChat.querySelector('.chat-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'chat-badge';
                desktopChat.appendChild(badge);
            }
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.cssText = `
                margin-left:auto; min-width:20px; height:20px; padding:0 6px;
                background:linear-gradient(135deg,#ef4444,#dc2626);
                color:#fff; font-size:11px; font-weight:700;
                border-radius:10px; display:flex; align-items:center;
                justify-content:center; box-shadow:0 2px 6px rgba(239,68,68,.3);
            `;
        } else if (badge) {
            badge.remove();
        }
    }
}

// ══════════════════════════════════════════════════════════
//  QUICK POST MODAL (mobile + button)
// ══════════════════════════════════════════════════════════
function openQuickPostModal() {
    document.getElementById('quick-post-modal')?.classList.remove('hidden');
    document.getElementById('quick-post-content')?.focus();
    lucide.createIcons();
}

function closeQuickPostModal() {
    document.getElementById('quick-post-modal')?.classList.add('hidden');
    const c = document.getElementById('quick-post-content');
    if (c) c.value = '';
}

async function submitQuickPost() {
    const content = document.getElementById('quick-post-content')?.value?.trim();
    if (!content) return;
    try {
        await sbCreatePost(currentUser.user_id, content);
        closeQuickPostModal();
        showToast('Post published!', 'success');
        if (currentSection === 'feed') loadPosts(true);
    } catch(e) { showToast('Failed to post.', 'error'); }
}

// Init realtime + notifications on DOMContentLoaded  
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        subscribeToRealtime();
        fetchUnreadNotifCount();
        fetchUnreadMessageCount();
        requestBrowserNotifPermission();
    }, 1500); // Reduced from 2000ms for faster init
});

// Cleanup realtime channels on page unload
window.addEventListener('beforeunload', () => {
    if (realtimeChannel) { supabaseClient.removeChannel(realtimeChannel); realtimeChannel = null; }
    if (realtimeInteractionsChannel) { supabaseClient.removeChannel(realtimeInteractionsChannel); realtimeInteractionsChannel = null; }
});

// ══════════════════════════════════════════════════════════
//  OPPORTUNITY ENGINE
// ══════════════════════════════════════════════════════════
let currentOppCategory = 'all';
let currentOpps = [];
let editingOppId = null;

const OPP_CATEGORY_META = {
    internship:  { label: 'Internship',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    research:    { label: 'Research',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
    startup:     { label: 'Startup',     color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
    competition: { label: 'Competition', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
    scholarship: { label: 'Scholarship', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    hackathon:   { label: 'Hackathon',   color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
};

function setOppCategory(cat) {
    currentOppCategory = cat;
    document.querySelectorAll('.opp-cat-btn').forEach(btn => {
        if (btn.dataset.oppCat === cat) {
            btn.className = 'opp-cat-btn px-4 py-2 rounded-full text-sm font-semibold transition bg-navy text-white whitespace-nowrap';
        } else {
            btn.className = 'opp-cat-btn px-4 py-2 rounded-full text-sm font-semibold transition bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 whitespace-nowrap';
        }
    });
    loadOpportunities();
}

async function loadOpportunities() {
    const grid = document.getElementById('opp-grid');
    const search = document.getElementById('opp-search')?.value?.trim() || '';
    grid.innerHTML = '<div class="text-center py-12 text-gray-400 col-span-full"><div class="inline-block w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin"></div></div>';
    try {
        const opps = await sbGetOpportunities(currentOppCategory, search);
        currentOpps = opps;
        grid.innerHTML = '';
        if (!opps.length) {
            grid.innerHTML = `
                <div class="text-center py-12 text-gray-400 col-span-full">
                    <div class="text-4xl mb-3">🔍</div>
                    <p class="font-medium">No opportunities found</p>
                    <p class="text-sm mt-1">Be the first to post one!</p>
                </div>`;
            return;
        }
        opps.forEach(opp => grid.appendChild(createOpportunityCard(opp)));
        lucide.createIcons();
    } catch(e) {
        console.error('loadOpportunities error:', e);
        // Show exact error in UI for debugging
        const errMsg = e.message || String(e);
        grid.innerHTML = `<div class="text-center py-12 text-red-500 col-span-full break-words"><p>Failed to load opportunities.</p><p class="text-xs mt-2 font-mono bg-red-50 p-2 rounded">${escHtml(errMsg)}</p></div>`;
    }
}

function createOpportunityCard(opp) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700';
    const p = opp.profiles || {};
    const avatarUrl = p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'U')}&background=C8FF00&color=0B1D3A&size=36&bold=true&font-size=0.45`;
    const meta = OPP_CATEGORY_META[opp.category] || { label: opp.category, color: 'bg-gray-100 text-gray-600' };
    const timeAgo = formatTimeAgo(opp.created_at);
    const isMyOpp = opp.user_id === currentUser?.user_id;
    const gradLabel = p.graduation_year ? `'${String(p.graduation_year).slice(2)}` : '';
    const branchLabel = p.nis_branch ? `${p.nis_branch} ${gradLabel}` : '';

    const deleteBtn = isMyOpp ? `<button onclick="event.stopPropagation();deleteOpportunity(${opp.id})" class="text-gray-300 hover:text-red-500 transition" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : '';
    const editBtn = isMyOpp ? `<button onclick="event.stopPropagation();openEditOpportunityModal(${opp.id})" class="text-gray-300 hover:text-blue-500 transition" title="Edit"><i data-lucide="pencil" class="w-4 h-4"></i></button>` : '';

    let tagsHtml = '';
    if (opp.location) tagsHtml += `<span class="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full"><i data-lucide="map-pin" class="w-3 h-3"></i>${escHtml(opp.location)}</span>`;
    if (opp.stack) tagsHtml += `<span class="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full"><i data-lucide="code" class="w-3 h-3"></i>${escHtml(opp.stack)}</span>`;

    let actionsHtml = '';
    if (opp.link) {
        actionsHtml += `<a href="${escHtml(opp.link)}" target="_blank" onclick="event.stopPropagation()" class="flex-1 py-2 bg-navy text-white text-xs font-semibold rounded-full text-center hover:bg-navy-light transition">Apply</a>`;
    } else {
        actionsHtml += `<button onclick="event.stopPropagation();showToast('Contact the poster via Message','info')" class="flex-1 py-2 bg-navy text-white text-xs font-semibold rounded-full hover:bg-navy-light transition">Apply</button>`;
    }
    if (!isMyOpp) {
        actionsHtml += `<button onclick="event.stopPropagation();openChatWithUser('${opp.user_id}')" class="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-200 transition dark:bg-gray-700 dark:text-gray-300">Message</button>`;
        actionsHtml += `<button onclick="event.stopPropagation();showToast('Interest sent! The poster will be notified.','success')" class="flex-1 py-2 bg-accent/20 text-navy text-xs font-semibold rounded-full hover:bg-accent/30 transition">Join</button>`;
    }

    div.innerHTML = `
        <div class="flex items-start justify-between gap-2 mb-3">
            <span class="${meta.color} text-xs font-semibold px-3 py-1 rounded-full">${meta.label}</span>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">${timeAgo}</span>
                ${editBtn}
                ${deleteBtn}
            </div>
        </div>
        <h3 class="font-display font-bold text-navy dark:text-white text-base mb-2 leading-snug">${escHtml(opp.title)}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-3 leading-relaxed">${escHtml(opp.description || '')}</p>
        ${tagsHtml ? `<div class="flex flex-wrap gap-1.5 mb-3">${tagsHtml}</div>` : ''}
        <div class="flex items-center gap-2 mb-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <img src="${avatarUrl}" class="w-7 h-7 rounded-full object-cover cursor-pointer" onclick="event.stopPropagation();navigateTo('profile','${opp.user_id}')" />
            <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-navy dark:text-white truncate cursor-pointer" onclick="event.stopPropagation();navigateTo('profile','${opp.user_id}')">${escHtml(p.full_name || 'Unknown')}</p>
                <p class="text-[10px] text-gray-400 truncate">${branchLabel}</p>
            </div>
        </div>
        <div class="flex items-center gap-2">
            ${actionsHtml}
        </div>`;
    return div;
}

// Open chat with a user from opportunity card
function openChatWithUser(userId) {
    navigateTo('chat');
    setTimeout(() => { if (typeof openConversation === 'function') openConversation(userId); }, 500);
}

function openPostOpportunityModal() {
    editingOppId = null;
    document.getElementById('post-opp-modal')?.classList.remove('hidden');
    document.getElementById('opp-form')?.reset();
    document.querySelector('#post-opp-modal h3').textContent = '🚀 Post Opportunity';
    document.getElementById('opp-submit-btn').textContent = 'Publish';
    lucide.createIcons();
}

function openEditOpportunityModal(id) {
    const opp = currentOpps.find(o => o.id === id);
    if (!opp) return;
    editingOppId = id;
    document.getElementById('post-opp-modal')?.classList.remove('hidden');
    document.getElementById('opp-form')?.reset();
    document.getElementById('opp-title').value = opp.title || '';
    document.getElementById('opp-category').value = opp.category || '';
    document.getElementById('opp-description').value = opp.description || '';
    document.getElementById('opp-location').value = opp.location || '';
    document.getElementById('opp-stack').value = opp.stack || '';
    document.getElementById('opp-link').value = opp.link || '';
    
    document.querySelector('#post-opp-modal h3').textContent = '✏️ Edit Opportunity';
    document.getElementById('opp-submit-btn').textContent = 'Save Changes';
    lucide.createIcons();
}

function closePostOpportunityModal() {
    document.getElementById('post-opp-modal')?.classList.add('hidden');
    editingOppId = null;
}

async function submitOpportunity() {
    const btn = document.getElementById('opp-submit-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        const data = {
            title: document.getElementById('opp-title').value.trim(),
            category: document.getElementById('opp-category').value,
            description: document.getElementById('opp-description').value.trim(),
            location: document.getElementById('opp-location').value.trim() || null,
            stack: document.getElementById('opp-stack').value.trim() || null,
            link: document.getElementById('opp-link').value.trim() || null,
        };
        if (!data.title || !data.category || !data.description) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }
        
        if (editingOppId) {
            await sbUpdateOpportunity(editingOppId, data);
            showToast('Opportunity updated!', 'success');
        } else {
            data.user_id = currentUser.user_id;
            await sbCreateOpportunity(data);
            showToast('Opportunity posted! 🚀', 'success');
        }
        
        closePostOpportunityModal();
        loadOpportunities();
    } catch(e) {
        console.error('submitOpportunity error:', e);
        const errMsg = e.message || String(e);
        alert('Failed to save opportunity:\n' + errMsg);
    } finally {
        btn.disabled = false; btn.textContent = editingOppId ? 'Save Changes' : 'Publish';
    }
}

async function deleteOpportunity(id) {
    if (!confirm('Delete this opportunity?')) return;
    try {
        await sbDeleteOpportunity(id);
        showToast('Opportunity deleted.', 'success');
        loadOpportunities();
    } catch(e) { showToast('Failed to delete.', 'error'); }
}

// Opportunity search debounce
document.getElementById('opp-search')?.addEventListener('input', (() => {
    let timer;
    return () => { clearTimeout(timer); timer = setTimeout(() => loadOpportunities(), 300); };
})());
