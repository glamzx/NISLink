/**
 * NIS Alumni — Dashboard JavaScript
 * Powers: navigation, feed, alumni directory, map, profile, settings.
 */

// ── State ──────────────────────────────────────────────────
let currentSection = 'feed';
let currentUser = null;
let profileUserId = null;   // whose profile we're viewing
let feedPage = 1;
let alumniPage = 1;
let feedHasMore = false;
let alumniHasMore = false;
let map = null;
let mapMarkers = [];
let pendingFiles = [];

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    setupAvatarDropdown();
    setupPostComposer();
    setupAlumniControls();
    setupSettings();
    setupAvatarUpload();
    setupSearch();

    // Navigate to section from URL hash or default to feed
    const hash = location.hash.replace('#', '') || 'feed';
    navigateTo(hash);
});

// ── Session Check ──────────────────────────────────────────
async function checkSession() {
    try {
        const res = await fetch('api/session.php');
        const data = await res.json();
        if (!data.logged_in) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = data;
        updateNavAvatar(data);
    } catch {
        // If API fails (e.g. file:// protocol), use placeholder
        currentUser = { user_id: 1, full_name: 'Guest', avatar_url: null, logged_in: true };
    }
}

function updateNavAvatar(user) {
    const avatarUrl = user.avatar_url
        ? user.avatar_url
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=C8FF00&color=0B1D3A&size=36&bold=true&font-size=0.45`;

    document.getElementById('nav-avatar').src = avatarUrl;
    document.getElementById('composer-avatar').src = avatarUrl;
    document.getElementById('dropdown-name').textContent = user.full_name;
}

// ── Avatar Dropdown ────────────────────────────────────────
function setupAvatarDropdown() {
    const btn = document.getElementById('avatar-btn');
    const dropdown = document.getElementById('avatar-dropdown');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => dropdown.classList.add('hidden'));
}

// ── Navigation ─────────────────────────────────────────────
function navigateTo(section, userId) {
    const currentEl = document.querySelector('.page-section:not(.hidden)');
    const targetEl = document.getElementById(`section-${section}`);

    // Update active nav
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

    // Smooth transition: fade out current, fade in target
    if (currentEl && targetEl && currentEl !== targetEl) {
        currentEl.classList.add('section-exit');
        setTimeout(() => {
            document.querySelectorAll('.page-section').forEach(s => {
                s.classList.add('hidden');
                s.classList.remove('section-exit', 'section-enter');
            });
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
        case 'feed':
            feedPage = 1;
            loadPosts(true);
            break;
        case 'alumni':
            alumniPage = 1;
            loadAlumni(true);
            break;
        case 'map':
            loadGoogleMaps();
            break;
        case 'profile':
            profileUserId = userId || currentUser?.user_id;
            loadProfile(profileUserId);
            break;
        case 'chat':
            loadConversations();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// ══════════════════════════════════════════════════════════
//  FEED — Posts
// ══════════════════════════════════════════════════════════
function setupPostComposer() {
    const submitBtn = document.getElementById('post-submit');
    const fileInput = document.getElementById('post-file');
    const attachInput = document.getElementById('post-attachment');
    const preview = document.getElementById('file-preview');

    submitBtn?.addEventListener('click', createPost);

    // File preview
    [fileInput, attachInput].forEach(input => {
        input?.addEventListener('change', () => {
            const files = Array.from(input.files);
            pendingFiles = [...pendingFiles, ...files];
            renderFilePreview();
        });
    });
}

function renderFilePreview() {
    const preview = document.getElementById('file-preview');
    if (!pendingFiles.length) {
        preview.classList.add('hidden');
        preview.innerHTML = '';
        return;
    }
    preview.classList.remove('hidden');
    preview.innerHTML = pendingFiles.map((f, i) => {
        if (f.type.startsWith('image/')) {
            return `<div class="relative group">
        <img src="${URL.createObjectURL(f)}" class="w-16 h-16 rounded-lg object-cover border border-gray-200" />
        <button onclick="removeFile(${i})" class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
      </div>`;
        }
        return `<div class="relative group flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600">
      📎 ${f.name}
      <button onclick="removeFile(${i})" class="text-red-500 ml-1">×</button>
    </div>`;
    }).join('');
}

function removeFile(index) {
    pendingFiles.splice(index, 1);
    renderFilePreview();
}

async function createPost() {
    const content = document.getElementById('post-content').value.trim();
    if (!content && !pendingFiles.length) return;

    const submitBtn = document.getElementById('post-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing…';

    try {
        // Upload attachments first
        const uploadedFiles = [];
        for (const file of pendingFiles) {
            const fd = new FormData();
            fd.append('file', file);
            const uploadRes = await fetch('api/upload.php?type=attachment', { method: 'POST', body: fd });
            const uploadData = await uploadRes.json();
            if (uploadData.success) {
                uploadedFiles.push({
                    file_path: uploadData.file_path,
                    file_type: uploadData.file_type,
                    original_name: uploadData.original_name,
                });
            }
        }

        // Create post
        const res = await fetch('api/posts.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, attachments: uploadedFiles }),
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('post-content').value = '';
            pendingFiles = [];
            renderFilePreview();
            feedPage = 1;
            loadPosts(true);
            showToast('Post published!', 'success');
        } else {
            showToast(data.message || 'Failed to post.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish';
    }
}

async function loadPosts(reset = false) {
    if (reset) feedPage = 1;
    try {
        const res = await fetch(`api/posts.php?page=${feedPage}`);
        const data = await res.json();
        if (!data.success) return;

        const container = document.getElementById('posts-list');
        if (reset) container.innerHTML = '';

        if (data.posts.length === 0 && reset) {
            container.innerHTML = `<div class="text-center py-12 text-gray-400">
        <p>No posts yet. Be the first to share!</p>
      </div>`;
        }

        data.posts.forEach(post => container.appendChild(createPostCard(post)));

        feedHasMore = feedPage < data.pages;
        document.getElementById('feed-load-more').classList.toggle('hidden', !feedHasMore);
        feedPage++;

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
                    return `<img src="${att.file_path}" class="rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition" onclick="openMediaViewer('${att.file_path}', 'image')" />`;
                }
                if (att.file_type === 'video') {
                    return `<div class="video-preview rounded-lg max-h-64 overflow-hidden" onclick="openMediaViewer('${att.file_path}', 'video')">
                        <video src="${att.file_path}" class="rounded-lg max-h-64 object-cover" muted preload="metadata"></video>
                        <div class="play-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="#0B1D3A"><polygon points="5 3 19 12 5 21"></polygon></svg></div>
                    </div>`;
                }
                if (att.file_type === 'audio' || att.original_name?.match(/\.(mp3|wav|ogg|webm)$/i)) {
                    return `<div class="bg-gray-100 rounded-lg px-3 py-2"><audio controls src="${att.file_path}" class="max-w-[250px]"></audio></div>`;
                }
                return `<a href="${att.file_path}" target="_blank" class="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-200 transition">📎 ${att.original_name || 'File'}</a>`;
            }).join('') + '</div>';
    }

    const deleteBtn = (post.user_id == currentUser?.user_id)
        ? `<button onclick="deletePost(${post.id}, this)" class="text-gray-300 hover:text-red-500 transition ml-auto"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
        : '';

    div.innerHTML = `
    <div class="flex items-start gap-3">
      <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer" onclick="navigateTo('profile',${post.user_id})" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <a onclick="navigateTo('profile',${post.user_id})" class="user-name-link font-semibold text-sm text-navy cursor-pointer">${escHtml(post.full_name)}</a>
          <span class="text-xs text-gray-400">${post.nis_branch || ''}</span>
          <span class="text-xs text-gray-300">·</span>
          <span class="text-xs text-gray-400">${timeAgo}</span>
          ${deleteBtn}
        </div>
        <p class="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">${escHtml(post.content)}</p>
        ${attachHtml}
        
        <!-- Like / Comment action bar -->
        <div class="flex items-center gap-5 mt-3 pt-3 border-t border-gray-100">
          <button onclick="toggleLike(${post.id}, this)" class="post-like-btn flex items-center gap-1.5 text-sm transition ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}" data-liked="${isLiked ? '1' : '0'}">
            <i data-lucide="${isLiked ? 'heart' : 'heart'}" class="w-4 h-4 ${isLiked ? 'fill-red-500' : ''}"></i>
            <span class="like-count">${likeCount || ''}</span>
          </button>
          <button onclick="toggleCommentSection(${post.id}, this)" class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy transition">
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

async function deletePost(postId, btn) {
    if (!confirm('Delete this post?')) return;
    try {
        const res = await fetch(`api/posts.php?id=${postId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            btn.closest('.bg-white').remove();
            showToast('Post deleted.', 'success');
        }
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  ALUMNI DIRECTORY
// ══════════════════════════════════════════════════════════
function setupAlumniControls() {
    let debouncedTimer;

    document.getElementById('alumni-search')?.addEventListener('input', () => {
        clearTimeout(debouncedTimer);
        debouncedTimer = setTimeout(() => { alumniPage = 1; loadAlumni(true); }, 300);
    });

    document.getElementById('alumni-sort')?.addEventListener('change', () => {
        alumniPage = 1;
        loadAlumni(true);
    });
}

async function loadAlumni(reset = false) {
    if (reset) alumniPage = 1;

    const search = document.getElementById('alumni-search')?.value || '';
    const sort = document.getElementById('alumni-sort')?.value || 'name';

    try {
        const res = await fetch(`api/users.php?sort=${sort}&q=${encodeURIComponent(search)}&page=${alumniPage}`);
        const data = await res.json();
        if (!data.success) return;

        const grid = document.getElementById('alumni-grid');
        if (reset) grid.innerHTML = '';

        if (data.users.length === 0 && reset) {
            grid.innerHTML = `<div class="text-center py-12 text-gray-400 col-span-full">
        <p>No alumni found.</p>
      </div>`;
        }

        data.users.forEach(user => grid.appendChild(createAlumniCard(user)));

        alumniHasMore = alumniPage < data.pages;
        document.getElementById('alumni-load-more').classList.toggle('hidden', !alumniHasMore);
        alumniPage++;

        lucide.createIcons();
    } catch { }
}

function createAlumniCard(user) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer';

    const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=C8FF00&color=0B1D3A&size=48&bold=true&font-size=0.45`;
    const isFollowing = user.is_following > 0;
    const isMe = user.id == currentUser?.user_id;

    const followBtn = isMe ? '' :
        `<button onclick="event.stopPropagation(); toggleFollowUser(${user.id}, this)"
       class="mt-3 w-full py-2 rounded-full text-xs font-semibold transition ${isFollowing
            ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'
            : 'bg-navy text-white hover:bg-navy-light'}"
       data-following="${isFollowing ? '1' : '0'}">
       ${isFollowing ? 'Following' : 'Follow'}
     </button>`;

    div.setAttribute('onclick', `navigateTo('profile', ${user.id})`);

    div.innerHTML = `
    <div class="flex items-center gap-3">
      <img src="${avatarUrl}" class="w-12 h-12 rounded-full object-cover shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-sm text-navy truncate">${escHtml(user.full_name)}</p>
        <p class="text-xs text-gray-400 truncate">${user.nis_branch || ''} ${user.graduation_year ? `'${String(user.graduation_year).slice(2)}` : ''}</p>
        ${user.university ? `<p class="text-xs text-gray-400 truncate mt-0.5">${escHtml(user.university)}</p>` : ''}
      </div>
    </div>
    ${followBtn}
  `;
    return div;
}

async function toggleFollowUser(userId, btn) {
    const isFollowing = btn.dataset.following === '1';

    try {
        if (isFollowing) {
            await fetch('api/subscriptions.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: userId }),
            });
            btn.dataset.following = '0';
            btn.textContent = 'Follow';
            btn.className = 'mt-3 w-full py-2 rounded-full text-xs font-semibold transition bg-navy text-white hover:bg-navy-light';
        } else {
            await fetch('api/subscriptions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: userId }),
            });
            btn.dataset.following = '1';
            btn.textContent = 'Following';
            btn.className = 'mt-3 w-full py-2 rounded-full text-xs font-semibold transition bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500';
        }
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  MAP (Google Maps — mutual only)
// ══════════════════════════════════════════════════════════
function initDashboardMap() {
    const mapEl = document.getElementById('google-map');
    if (!mapEl) return;

    map = new google.maps.Map(mapEl, {
        center: { lat: 51.1694, lng: 71.4491 }, // Astana
        zoom: 5,
        styles: [
            { elementType: 'geometry', stylers: [{ color: '#0B1D3A' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#0B1D3A' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#071428' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#15325E' }] },
        ],
        disableDefaultUI: true,
        zoomControl: true,
    });

    loadMapMarkers();

    // Share own location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            fetch('api/location.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            }).then(() => loadMapMarkers());
        });
    }
}

async function loadMapMarkers() {
    try {
        const res = await fetch('api/location.php');
        const data = await res.json();
        if (!data.success) return;

        // Clear old markers
        mapMarkers.forEach(m => m.setMap(null));
        mapMarkers = [];

        document.getElementById('map-alumni-count').textContent = data.locations.length;

        data.locations.forEach(loc => {
            const marker = new google.maps.Marker({
                position: { lat: parseFloat(loc.latitude), lng: parseFloat(loc.longitude) },
                map: map,
                title: loc.full_name,
                icon: {
                    url: 'assets/marker.svg',
                    scaledSize: new google.maps.Size(36, 36),
                },
            });

            const avatarUrl = loc.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(loc.full_name)}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
            const infoWindow = new google.maps.InfoWindow({
                content: `<div style="font-family:Inter,sans-serif;padding:4px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${avatarUrl}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" />
            <div>
              <strong style="font-size:13px;color:#0B1D3A;">${escHtml(loc.full_name)}</strong>
              <p style="font-size:11px;color:#9CA3AF;margin:0;">${loc.nis_branch || ''} ${loc.graduation_year || ''}</p>
            </div>
          </div>
        </div>`,
            });

            marker.addListener('click', () => infoWindow.open(map, marker));
            mapMarkers.push(marker);
        });
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  PROFILE / WALL
// ══════════════════════════════════════════════════════════
async function loadProfile(userId) {
    if (!userId) return;

    try {
        // Load profile data
        const res = await fetch(`api/profile.php?id=${userId}`);
        const data = await res.json();
        if (!data.success) return;

        const u = data.profile;
        const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=96&bold=true&font-size=0.4`;

        document.getElementById('profile-avatar-img').src = avatarUrl;
        document.getElementById('profile-display-name').textContent = u.full_name || '—';
        document.getElementById('profile-display-branch').textContent = u.nis_branch || '';
        document.getElementById('profile-display-year').textContent = u.graduation_year ? `'${String(u.graduation_year).slice(2)}` : '';
        document.getElementById('profile-display-bio').textContent = u.bio || '—';
        document.getElementById('profile-display-uni').textContent = u.university || '—';
        document.getElementById('profile-display-degree').textContent = u.degree_major || '—';
        document.getElementById('profile-display-email').textContent = u.email || '—';

        // Status text
        const statusEl = document.getElementById('profile-display-status');
        if (statusEl) {
            if (u.status) {
                statusEl.textContent = u.status;
                statusEl.classList.remove('hidden');
            } else {
                statusEl.classList.add('hidden');
            }
        }

        // Cover image
        const coverEl = document.getElementById('profile-cover');
        if (u.cover_url) {
            coverEl.style.backgroundImage = `url('${u.cover_url}')`;
        } else {
            coverEl.style.backgroundImage = 'none';
            coverEl.style.backgroundColor = '#0B1D3A';
        }

        // Social links
        toggleSocialLink('prof-linkedin', u.linkedin);
        toggleSocialLink('prof-instagram', u.instagram);
        toggleSocialLink('prof-youtube', u.youtube);

        // Own profile: show upload overlays
        const isOwnProfile = (userId == currentUser?.user_id);
        const coverLabel = document.getElementById('cover-upload-label');
        const avatarLabel = document.getElementById('profile-avatar-upload-label');
        if (isOwnProfile) {
            coverLabel?.classList.remove('hidden');
            avatarLabel?.classList.remove('hidden');
            setupProfileUploads();
        } else {
            coverLabel?.classList.add('hidden');
            avatarLabel?.classList.add('hidden');
        }

        // Follow button (hide for own profile)
        const followWrap = document.getElementById('profile-follow-wrap');
        if (!isOwnProfile) {
            followWrap.classList.remove('hidden');
            loadFollowStatus(userId);
        } else {
            followWrap.classList.add('hidden');
        }

        // Follower/following counts
        const subRes = await fetch(`api/subscriptions.php?user_id=${userId}`);
        const subData = await subRes.json();
        if (subData.success) {
            document.getElementById('profile-follower-count').textContent = subData.follower_count;
            document.getElementById('profile-following-count').textContent = subData.following_count;
        }

        // Load wall posts + post count
        loadWallPosts(userId);

        lucide.createIcons();
    } catch { }
}

function toggleSocialLink(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    if (url) {
        el.href = url;
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

async function loadFollowStatus(userId) {
    try {
        const res = await fetch(`api/subscriptions.php?user_id=${userId}`);
        const data = await res.json();
        const btn = document.getElementById('profile-follow-btn');
        const msgBtn = document.getElementById('profile-msg-btn');
        btn.dataset.userId = userId;

        if (data.i_follow) {
            btn.textContent = data.is_mutual ? '✓ Mutual' : 'Following';
            btn.className = 'follow-btn following px-5 py-2 rounded-full text-sm font-semibold transition bg-gray-100 text-gray-600';
            btn.dataset.following = '1';
            btn.dataset.label = data.is_mutual ? '✓ Mutual' : 'Following';
            // Show message button
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

async function toggleFollow() {
    const btn = document.getElementById('profile-follow-btn');
    const userId = btn.dataset.userId;
    const isFollowing = btn.dataset.following === '1';

    try {
        if (isFollowing) {
            await fetch('api/subscriptions.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: parseInt(userId) }),
            });
        } else {
            await fetch('api/subscriptions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: parseInt(userId) }),
            });
        }

        loadFollowStatus(userId);
        // Reload follower count
        const subRes = await fetch(`api/subscriptions.php?user_id=${userId}`);
        const subData = await subRes.json();
        if (subData.success) {
            document.getElementById('profile-follower-count').textContent = subData.follower_count;
        }
    } catch { }
}

async function loadWallPosts(userId) {
    try {
        const res = await fetch(`api/posts.php?user_id=${userId}`);
        const data = await res.json();
        const container = document.getElementById('wall-posts');
        container.innerHTML = '';

        // Update post count on profile
        const postCountEl = document.getElementById('profile-post-count');
        if (postCountEl) postCountEl.textContent = data.total || 0;

        if (!data.posts?.length) {
            container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No posts yet.</div>';
            return;
        }

        data.posts.forEach(post => container.appendChild(createPostCard(post)));
        lucide.createIcons();
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  LIKE & COMMENT FUNCTIONS
// ══════════════════════════════════════════════════════════
async function toggleLike(postId, btn) {
    try {
        const res = await fetch('api/likes.php', {
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
            btn.dataset.liked = '1';
            iconEl.classList.add('fill-red-500');
        } else {
            btn.classList.add('text-gray-400');
            btn.classList.remove('text-red-500');
            btn.dataset.liked = '0';
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
        const res = await fetch(`api/comments.php?post_id=${postId}`);
        const data = await res.json();
        if (!data.success) return;

        list.innerHTML = '';
        if (data.comments.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-400 py-2">No comments yet.</p>';
            return;
        }

        data.comments.forEach(c => {
            const cAvatarUrl = c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.full_name)}&background=C8FF00&color=0B1D3A&size=28&bold=true&font-size=0.45`;
            const deleteHtml = (c.user_id == currentUser?.user_id)
                ? `<button onclick="deleteComment(${c.id}, ${postId}, this)" class="text-gray-300 hover:text-red-500 transition ml-auto shrink-0"><i data-lucide="x" class="w-3 h-3"></i></button>`
                : '';

            const commentDiv = document.createElement('div');
            commentDiv.className = 'flex items-start gap-2 p-2 rounded-lg bg-gray-50';
            commentDiv.innerHTML = `
                <img src="${cAvatarUrl}" class="w-7 h-7 rounded-full object-cover shrink-0 cursor-pointer" onclick="navigateTo('profile',${c.user_id})" />
                <div class="flex-1 min-w-0">
                    <span class="font-semibold text-xs text-navy cursor-pointer hover:underline" onclick="navigateTo('profile',${c.user_id})">${escHtml(c.full_name)}</span>
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
    const content = inputEl.value.trim();
    if (!content) return;

    try {
        const res = await fetch('api/comments.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId, content }),
        });
        const data = await res.json();
        if (data.success) {
            inputEl.value = '';
            loadComments(postId);
            // Update comment count on the post card
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
        const res = await fetch(`api/comments.php?id=${commentId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            loadComments(postId);
            // Update comment count
            const postCard = document.querySelector(`[data-post-id="${postId}"]`);
            if (postCard) {
                const countEl = postCard.querySelector('.comment-count');
                const curr = parseInt(countEl.textContent || '1');
                countEl.textContent = curr > 1 ? curr - 1 : '';
            }
        }
    } catch { }
}

// ── Profile uploads (avatar + cover from profile section) ─
let profileUploadsSetup = false;
function setupProfileUploads() {
    if (profileUploadsSetup) return;
    profileUploadsSetup = true;

    // Avatar upload from profile
    document.getElementById('profile-avatar-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await fetch('api/upload.php?type=avatar', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                document.getElementById('profile-avatar-img').src = data.file_path;
                currentUser.avatar_url = data.file_path;
                updateNavAvatar(currentUser);
                showToast('Avatar updated!', 'success');
            } else {
                showToast(data.message || 'Upload failed.', 'error');
            }
        } catch {
            showToast('Upload error.', 'error');
        }
    });

    // Cover upload from profile
    document.getElementById('cover-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await fetch('api/upload.php?type=cover', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                document.getElementById('profile-cover').style.backgroundImage = `url('${data.file_path}')`;
                showToast('Cover updated!', 'success');
            } else {
                showToast(data.message || 'Upload failed.', 'error');
            }
        } catch {
            showToast('Upload error.', 'error');
        }
    });
}

// ══════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════
function setupSettings() {
    document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            full_name: document.getElementById('s-full-name').value.trim(),
            nis_branch: document.getElementById('s-nis-branch').value,
            graduation_year: document.getElementById('s-grad-year').value || null,
            university: document.getElementById('s-university').value.trim(),
            degree_major: document.getElementById('s-degree').value.trim(),
            bio: document.getElementById('s-bio').value.trim(),
            status: document.getElementById('s-status').value.trim(),
            linkedin: document.getElementById('s-linkedin').value.trim(),
            instagram: document.getElementById('s-instagram').value.trim(),
            youtube: document.getElementById('s-youtube').value.trim(),
        };

        try {
            const res = await fetch('api/profile.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Settings saved!', 'success');
                // Update nav avatar name
                if (formData.full_name) {
                    currentUser.full_name = formData.full_name;
                    updateNavAvatar(currentUser);
                }
            } else {
                showToast(data.message || 'Error saving.', 'error');
            }
        } catch {
            showToast('Network error.', 'error');
        }
    });
}

async function loadSettings() {
    try {
        const res = await fetch(`api/profile.php?id=${currentUser?.user_id}`);
        const data = await res.json();
        if (!data.success) return;

        const u = data.profile;
        document.getElementById('s-full-name').value = u.full_name || '';
        document.getElementById('s-nis-branch').value = u.nis_branch || '';
        document.getElementById('s-grad-year').value = u.graduation_year || '';
        document.getElementById('s-university').value = u.university || '';
        document.getElementById('s-degree').value = u.degree_major || '';
        document.getElementById('s-bio').value = u.bio || '';
        document.getElementById('s-status').value = u.status || '';
        document.getElementById('s-linkedin').value = u.linkedin || '';
        document.getElementById('s-instagram').value = u.instagram || '';
        document.getElementById('s-youtube').value = u.youtube || '';

        const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=80&bold=true&font-size=0.4`;
        document.getElementById('settings-avatar-preview').src = avatarUrl;

        // Cover preview in settings
        const coverPreview = document.getElementById('settings-cover-preview');
        if (coverPreview && u.cover_url) {
            coverPreview.style.backgroundImage = `url('${u.cover_url}')`;
        }
    } catch { }
}

function setupAvatarUpload() {
    document.getElementById('avatar-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fd = new FormData();
        fd.append('file', file);

        try {
            const res = await fetch('api/upload.php?type=avatar', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                document.getElementById('settings-avatar-preview').src = data.file_path;
                currentUser.avatar_url = data.file_path;
                updateNavAvatar(currentUser);
                showToast('Avatar updated!', 'success');
            } else {
                showToast(data.message || 'Upload failed.', 'error');
            }
        } catch {
            showToast('Upload error.', 'error');
        }
    });

    // Cover upload in settings
    document.getElementById('cover-upload-settings')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fd = new FormData();
        fd.append('file', file);

        try {
            const res = await fetch('api/upload.php?type=cover', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                const preview = document.getElementById('settings-cover-preview');
                if (preview) preview.style.backgroundImage = `url('${data.file_path}')`;
                showToast('Cover updated!', 'success');
            } else {
                showToast(data.message || 'Upload failed.', 'error');
            }
        } catch {
            showToast('Upload error.', 'error');
        }
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
            if (q.length >= 2) {
                navigateTo('alumni');
                document.getElementById('alumni-search').value = q;
                alumniPage = 1;
                loadAlumni(true);
            }
        }, 400);
    });
}

// ══════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════
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

function showToast(msg, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-lg transition-all duration-300 ${type === 'success' ? 'bg-navy text-white' : 'bg-red-500 text-white'
        }`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
// ══════════════════════════════════════════════════════════
//  CHAT FUNCTIONS
// ══════════════════════════════════════════════════════════
let currentChatUserId = null;
let chatPollInterval = null;

async function loadConversations() {
    try {
        const res = await fetch('api/chat.php');
        const data = await res.json();
        const list = document.getElementById('chat-conv-list');
        if (!list) return;

        if (!data.conversations?.length) {
            list.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No conversations yet.<br><span class="text-xs">Visit a profile and click Chat to start.</span></div>';
            return;
        }

        list.innerHTML = '';
        data.conversations.forEach(conv => {
            const u = conv.other_user;
            const avatarUrl = u?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.full_name || 'U')}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
            const lastMsg = conv.last_message;
            let preview = lastMsg?.content || '';
            if (lastMsg?.attachment_type && !preview) preview = `📎 ${lastMsg.attachment_type}`;
            if (preview.length > 40) preview = preview.slice(0, 40) + '…';

            const div = document.createElement('div');
            div.className = `flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition border-b border-gray-50 ${currentChatUserId == u?.id ? 'bg-accent/5' : ''}`;
            div.onclick = () => openChat(u?.id);
            div.innerHTML = `
                <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover shrink-0" />
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <span class="font-semibold text-sm text-navy truncate">${escHtml(u?.full_name || 'User')}</span>
                        <span class="text-xs text-gray-400 shrink-0">${lastMsg ? formatTimeAgo(lastMsg.created_at) : ''}</span>
                    </div>
                    <p class="text-xs text-gray-400 truncate">${escHtml(preview)}</p>
                </div>
            `;
            list.appendChild(div);
        });
    } catch { }
}

async function openChat(userId) {
    currentChatUserId = userId;
    // Clear poll
    if (chatPollInterval) clearInterval(chatPollInterval);

    // Show chat UI elements
    document.getElementById('chat-thread-empty')?.classList.add('hidden');
    document.getElementById('chat-header')?.classList.remove('hidden');
    document.getElementById('chat-messages')?.classList.remove('hidden');
    document.getElementById('chat-input-area')?.classList.remove('hidden');

    await loadMessages(userId);
    // Highlight in conversation list
    loadConversations();

    // Poll for new messages every 5s
    chatPollInterval = setInterval(() => loadMessages(userId), 5000);

    lucide.createIcons();
}

async function loadMessages(userId) {
    try {
        const res = await fetch(`api/chat.php?with=${userId}`);
        const data = await res.json();
        if (!data.success) return;

        // Update header
        const u = data.other_user;
        if (u) {
            const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=36&bold=true&font-size=0.45`;
            document.getElementById('chat-other-avatar').src = avatarUrl;
            document.getElementById('chat-other-name').textContent = u.full_name;
            document.getElementById('chat-other-username').textContent = u.username ? `@${u.username}` : '';
        }

        // Render messages
        const container = document.getElementById('chat-messages');
        const wasAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;
        container.innerHTML = '';

        if (!data.messages?.length) {
            container.innerHTML = '<div class="text-center text-gray-400 text-sm py-8">No messages yet. Say hi!</div>';
        } else {
            data.messages.forEach(msg => {
                const isMine = msg.sender_id == currentUser?.user_id;
                const msgDiv = document.createElement('div');
                msgDiv.className = `flex ${isMine ? 'justify-end' : 'justify-start'}`;

                let contentHtml = '';
                if (msg.content) {
                    contentHtml = `<p class="text-sm whitespace-pre-wrap">${escHtml(msg.content)}</p>`;
                }
                if (msg.attachment_path) {
                    const type = msg.attachment_type || '';
                    if (type.startsWith('image')) {
                        contentHtml += `<img src="${msg.attachment_path}" class="rounded-lg max-w-xs mt-1 cursor-pointer hover:opacity-90 transition" onclick="openMediaViewer('${msg.attachment_path}', 'image')" />`;
                    } else if (type.startsWith('audio')) {
                        contentHtml += `<audio controls src="${msg.attachment_path}" class="mt-1 max-w-[250px]"></audio>`;
                    } else if (type.startsWith('video')) {
                        contentHtml += `<video controls src="${msg.attachment_path}" class="rounded-lg max-w-xs mt-1 cursor-pointer" onclick="openMediaViewer('${msg.attachment_path}', 'video')"></video>`;
                    } else {
                        contentHtml += `<a href="${msg.attachment_path}" target="_blank" class="text-xs underline mt-1 block">📎 Attachment</a>`;
                    }
                }

                msgDiv.innerHTML = `
                    <div class="max-w-[70%] ${isMine ? 'bg-navy text-white' : 'bg-white text-navy border border-gray-200'} rounded-2xl px-4 py-2.5 shadow-sm">
                        ${contentHtml}
                        <p class="text-[10px] ${isMine ? 'text-white/50' : 'text-gray-400'} mt-1">${formatTimeAgo(msg.created_at)}</p>
                    </div>
                `;
                container.appendChild(msgDiv);
            });
        }

        // Scroll to bottom
        if (wasAtBottom || container.children.length <= 1) {
            container.scrollTop = container.scrollHeight;
        }

        lucide.createIcons();
    } catch { }
}

let pendingChatAttachment = null;

async function sendChatMessage() {
    if (!currentChatUserId) return;
    const input = document.getElementById('chat-msg-input');
    const content = input.value.trim();
    if (!content && !pendingChatAttachment) return;

    input.value = '';

    try {
        let attachPath = null;
        let attachType = null;

        // Upload pending attachment first
        if (pendingChatAttachment) {
            const fd = new FormData();
            fd.append('file', pendingChatAttachment.file);
            const data = await uploadWithProgress(fd, 'api/upload.php?type=attachment');
            if (data.success) {
                attachPath = data.file_path;
                attachType = pendingChatAttachment.file.type;
            }
            clearChatAttachment();
        }

        await fetch('api/chat.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient_id: currentChatUserId,
                content: content || '',
                attachment_path: attachPath,
                attachment_type: attachType,
            }),
        });
        loadMessages(currentChatUserId);
    } catch { }
}

// Chat file: show preview instead of immediate send
document.getElementById('chat-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !currentChatUserId) return;

    pendingChatAttachment = { file };

    const preview = document.getElementById('chat-attach-preview');
    const thumb = document.getElementById('chat-attach-thumb');
    const nameEl = document.getElementById('chat-attach-name');

    preview.classList.remove('hidden');
    nameEl.textContent = file.name;

    // Show thumbnail
    if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        thumb.innerHTML = `<img src="${url}" />`;
    } else if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        thumb.innerHTML = `<video src="${url}" muted></video>`;
    } else if (file.type.startsWith('audio/')) {
        thumb.innerHTML = '<i data-lucide="music" class="w-5 h-5 text-gray-400"></i>';
        lucide.createIcons();
    } else {
        thumb.innerHTML = '<i data-lucide="file" class="w-5 h-5 text-gray-400"></i>';
        lucide.createIcons();
    }

    e.target.value = '';
});

function clearChatAttachment() {
    pendingChatAttachment = null;
    const preview = document.getElementById('chat-attach-preview');
    if (preview) preview.classList.add('hidden');
    const thumb = document.getElementById('chat-attach-thumb');
    if (thumb) thumb.innerHTML = '';
}

// ══════════════════════════════════════════════════════════
//  MEDIA VIEWER
// ══════════════════════════════════════════════════════════
let mediaViewerItems = [];
let mediaViewerIndex = 0;

function openMediaViewer(src, type, items, index) {
    const viewer = document.getElementById('media-viewer');
    const content = document.getElementById('media-content');
    viewer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (items && items.length > 1) {
        mediaViewerItems = items;
        mediaViewerIndex = index || 0;
        document.getElementById('media-prev')?.classList.remove('hidden');
        document.getElementById('media-next')?.classList.remove('hidden');
    } else {
        mediaViewerItems = [{ src, type }];
        mediaViewerIndex = 0;
        document.getElementById('media-prev')?.classList.add('hidden');
        document.getElementById('media-next')?.classList.add('hidden');
    }

    renderMediaContent();
}

function renderMediaContent() {
    const content = document.getElementById('media-content');
    const item = mediaViewerItems[mediaViewerIndex];
    if (!item) return;

    if (item.type === 'image' || item.type?.startsWith('image')) {
        content.innerHTML = `<img src="${item.src}" class="max-h-[85vh] max-w-full object-contain rounded-lg" />`;
    } else if (item.type === 'video' || item.type?.startsWith('video')) {
        content.innerHTML = `<video controls autoplay src="${item.src}" class="max-h-[85vh] max-w-full rounded-lg"></video>`;
    } else if (item.type === 'audio' || item.type?.startsWith('audio')) {
        content.innerHTML = `<div class="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center"><p class="text-white mb-4">Audio</p><audio controls autoplay src="${item.src}" class="mx-auto"></audio></div>`;
    }
}

function closeMediaViewer() {
    document.getElementById('media-viewer')?.classList.add('hidden');
    document.getElementById('media-content').innerHTML = '';
    document.body.style.overflow = '';
    mediaViewerItems = [];
}

function mediaViewerNav(dir) {
    mediaViewerIndex += dir;
    if (mediaViewerIndex < 0) mediaViewerIndex = mediaViewerItems.length - 1;
    if (mediaViewerIndex >= mediaViewerItems.length) mediaViewerIndex = 0;
    renderMediaContent();
}

// Keyboard navigation for media viewer
document.addEventListener('keydown', (e) => {
    const viewer = document.getElementById('media-viewer');
    if (viewer?.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeMediaViewer();
    if (e.key === 'ArrowLeft') mediaViewerNav(-1);
    if (e.key === 'ArrowRight') mediaViewerNav(1);
});

// ══════════════════════════════════════════════════════════
//  AUDIO RECORDING
// ══════════════════════════════════════════════════════════
let audioRecorder = null;
let audioChunks = [];
let audioContext = ''; // 'chat' or 'comment-{postId}'

async function toggleAudioRecording(context) {
    if (audioRecorder && audioRecorder.state === 'recording') {
        // Stop recording
        audioRecorder.stop();
        return;
    }

    audioContext = context;
    audioChunks = [];

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        audioRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        audioRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(audioChunks, { type: 'audio/webm' });

            // Upload the audio
            const fd = new FormData();
            fd.append('file', blob, `audio_${Date.now()}.webm`);

            try {
                const data = await uploadWithProgress(fd, 'api/upload.php?type=attachment');
                if (data.success) {
                    if (audioContext === 'chat' && currentChatUserId) {
                        await fetch('api/chat.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                recipient_id: currentChatUserId,
                                content: '',
                                attachment_path: data.file_path,
                                attachment_type: 'audio/webm',
                            }),
                        });
                        loadMessages(currentChatUserId);
                    }
                    // For comment audio: audioContext = 'comment-{postId}'
                    if (audioContext.startsWith('comment-')) {
                        const postId = audioContext.split('-')[1];
                        await fetch('api/comments.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                post_id: parseInt(postId),
                                content: `🎤 [Audio] ${data.file_path}`,
                            }),
                        });
                        loadComments(parseInt(postId));
                    }
                }
            } catch { }

            // Hide recording indicator
            if (audioContext === 'chat') {
                document.getElementById('chat-recording-indicator')?.classList.add('hidden');
                const btn = document.getElementById('chat-audio-btn');
                if (btn) btn.classList.remove('text-red-500');
            }
            audioRecorder = null;
        };

        audioRecorder.start();

        // Show recording indicator
        if (context === 'chat') {
            document.getElementById('chat-recording-indicator')?.classList.remove('hidden');
            const btn = document.getElementById('chat-audio-btn');
            if (btn) btn.classList.add('text-red-500');
        }
    } catch (err) {
        showToast('Microphone access denied.', 'error');
    }
}

// ══════════════════════════════════════════════════════════
//  UPLOAD WITH PROGRESS
// ══════════════════════════════════════════════════════════
function uploadWithProgress(formData, url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const bar = document.getElementById('upload-progress-bar');
        const fill = document.getElementById('upload-progress-fill');
        const pct = document.getElementById('upload-progress-pct');

        // Show bar
        bar?.classList.remove('hidden');
        if (fill) fill.style.width = '0%';
        if (pct) pct.textContent = '0%';

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                if (fill) fill.style.width = `${percent}%`;
                if (pct) pct.textContent = `${percent}%`;
            }
        });

        xhr.addEventListener('load', () => {
            // Complete
            if (fill) fill.style.width = '100%';
            if (pct) pct.textContent = '100%';
            setTimeout(() => bar?.classList.add('hidden'), 1500);

            try {
                resolve(JSON.parse(xhr.responseText));
            } catch {
                reject(new Error('Invalid response'));
            }
        });

        xhr.addEventListener('error', () => {
            bar?.classList.add('hidden');
            reject(new Error('Upload failed'));
        });

        xhr.open('POST', url);
        xhr.send(formData);
    });
}
// ══════════════════════════════════════════════════════════
//  FOLLOWERS / FOLLOWING LIST MODAL
// ══════════════════════════════════════════════════════════
async function showFollowList(type) {
    const modal = document.getElementById('follow-list-modal');
    const title = document.getElementById('follow-list-title');
    const body = document.getElementById('follow-list-body');
    modal.classList.remove('hidden');
    title.textContent = type === 'followers' ? 'Followers' : 'Following';
    body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Loading…</div>';

    const userId = profileUserId || currentUser?.user_id;
    try {
        const res = await fetch(`api/subscriptions.php?list=${type}&user_id=${userId}`);
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
            div.onclick = () => { closeFollowListModal(); navigateTo('profile', u.id); };
            div.innerHTML = `
                <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover" />
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-sm text-navy truncate">${escHtml(u.full_name)}</p>
                    <p class="text-xs text-gray-400 truncate">${u.username ? '@' + u.username : (u.nis_branch || '')}</p>
                </div>
            `;
            body.appendChild(div);
        });
        lucide.createIcons();
    } catch { }
}

function closeFollowListModal() {
    document.getElementById('follow-list-modal')?.classList.add('hidden');
}

// ══════════════════════════════════════════════════════════
//  NEW MESSAGE PICKER (from following list)
// ══════════════════════════════════════════════════════════
async function showNewMessagePicker() {
    const modal = document.getElementById('new-msg-modal');
    const body = document.getElementById('new-msg-list');
    modal.classList.remove('hidden');
    body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Loading…</div>';

    try {
        const res = await fetch('api/subscriptions.php?list=following');
        const data = await res.json();
        if (!data.users?.length) {
            body.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">You\'re not following anyone yet.<br><span class="text-xs">Follow people to message them.</span></div>';
            return;
        }
        body.innerHTML = '';
        data.users.forEach(u => {
            const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
            const div = document.createElement('div');
            div.className = 'flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition';
            div.onclick = () => { closeNewMsgModal(); openChat(u.id); };
            div.innerHTML = `
                <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover" />
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-sm text-navy truncate">${escHtml(u.full_name)}</p>
                    <p class="text-xs text-gray-400 truncate">${u.username ? '@' + u.username : (u.nis_branch || '')}</p>
                </div>
                <i data-lucide="message-square" class="w-4 h-4 text-gray-300"></i>
            `;
            body.appendChild(div);
        });
        lucide.createIcons();
    } catch { }
}

function closeNewMsgModal() {
    document.getElementById('new-msg-modal')?.classList.add('hidden');
}

// ══════════════════════════════════════════════════════════
//  OPEN CHAT FROM PROFILE
// ══════════════════════════════════════════════════════════
function openChatWithProfileUser() {
    const btn = document.getElementById('profile-follow-btn');
    const userId = btn?.dataset.userId;
    if (userId) {
        navigateTo('chat');
        setTimeout(() => openChat(parseInt(userId)), 300);
    }
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

// Initialize dark mode from localStorage
(function initDarkMode() {
    if (localStorage.getItem('nis-dark') === '1') {
        document.documentElement.classList.add('dark');
    }
    updateDarkIcons();
})();
