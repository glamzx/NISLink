Project Report
Website Project: NIS Alumni
Student: Alissultan Otan
Grade/Class: 11E
School: NIS PHMD ABAY SHYMKENT
Subject: Informatics
Teacher: Fariza Temirbekova
Date: 24.02.2026


TABLE OF CONTENTS

1. Introduction
2. Website Structure Description
3. Database Description
4. Code Analysis
   4.1 HTML Fragment
   4.2 CSS Fragment
   4.3 JavaScript Fragment
   4.4 PHP Fragment
5. Conclusion
6. Screenshots


═══════════════════════════════════════════════════════════════

1. INTRODUCTION

The NIS Alumni website is a full-stack social networking platform designed for graduates of Nazarbayev Intellectual Schools across Kazakhstan. The purpose of this project is to create a web application that allows NIS alumni to stay connected after graduation — find each other, share news, communicate through private messages, and maintain a professional network.

The website addresses the problem of scattered alumni communities by providing a centralized platform where graduates from all 20 NIS branches can create profiles, publish posts, follow each other, exchange messages, and discover fellow alumni on an interactive map.

The project is built using modern web technologies:
• Frontend: HTML5, CSS3, JavaScript (ES6+), Tailwind CSS
• Backend: PHP 8 with PDO
• Database: MySQL (via phpMyAdmin / MAMP)
• Libraries: Lucide Icons, Google Fonts (Inter, Outfit), Google Maps API
• Architecture: Single-Page Application (SPA) with REST API

Key features of the platform include:
• User registration and authentication with unique @username system
• A social feed with posts, likes, and comments
• Profile pages with cover images, avatars, and social links
• Private messaging (chat) with file and audio message support
• Alumni directory with search functionality
• Interactive alumni map showing graduate locations worldwide
• Media viewer for photos, videos, and audio content
• Audio recording for voice messages and comments
• Real-time upload progress tracking


═══════════════════════════════════════════════════════════════

2. WEBSITE STRUCTURE DESCRIPTION

The project follows a modular file structure separating HTML pages, CSS styles, JavaScript logic, PHP API endpoints, configuration, and database schema.

Project File Structure:

NIS Alumni/
├── index.html              — Landing page (public homepage)
├── login.html              — User login page
├── register.html           — User registration page
├── dashboard.html          — Main application (SPA with sidebar navigation)
├── profile.html            — Standalone public profile page
├── map.html                — Standalone alumni map page
├── settings.html           — Standalone settings page
│
├── css/
│   └── custom.css          — Custom CSS styles (animations, components)
│
├── js/
│   ├── app.js              — Landing page JavaScript
│   ├── auth.js             — Login & registration form handlers
│   ├── dashboard.js        — Main application logic (59KB, 1400+ lines)
│   ├── profile.js          — Standalone profile page logic
│   └── map.js              — Map page logic
│
├── api/
│   ├── register.php        — User registration endpoint
│   ├── login.php           — User authentication endpoint
│   ├── logout.php          — Session termination
│   ├── session.php         — Current session status check
│   ├── profile.php         — User profile data (GET/PUT)
│   ├── posts.php           — Feed posts (CRUD)
│   ├── likes.php           — Post like/unlike toggle
│   ├── comments.php        — Post comments (CRUD)
│   ├── subscriptions.php   — Follow/unfollow system
│   ├── chat.php            — Private messaging system
│   ├── upload.php          — File upload handler (avatar, cover, attachments)
│   ├── check-username.php  — Username availability check
│   ├── users.php           — Alumni directory listing
│   └── location.php        — User location for map
│
├── config/
│   └── database.php        — Database connection + helper functions
│
├── database/
│   └── schema.sql          — Full database schema (195 lines)
│
├── uploads/                — User-uploaded files directory
│   ├── avatars/            — Profile pictures
│   ├── covers/             — Profile cover/background images
│   └── attachments/        — Post and chat file attachments
│
└── assets/
    └── (static assets)

Page Descriptions:

• index.html — The public landing page. Introduces the platform to visitors with a hero section, feature highlights, alumni statistics, and call-to-action buttons for registration and login. Uses a modern animated gradient background.

• register.html — Registration form collecting full name, @username (with live availability check), email, NIS branch, graduation year, and password. Split-screen layout with branding panel on the left.

• login.html — Login form with email and password fields. Same split-screen design as registration.

• dashboard.html — The core of the application. Functions as a Single-Page Application (SPA) with 6 sections accessible via sidebar navigation:
  ◦ Feed — Social post timeline with composer, likes, and comments
  ◦ Alumni — Searchable directory of registered NIS graduates
  ◦ Map — Interactive Google Maps showing alumni locations
  ◦ Profile — User profile with cover image, stats, about section, social links, and wall posts
  ◦ Chat — Private messaging with conversation list and message thread
  ◦ Settings — Account settings, avatar/cover upload, profile editing

• profile.html — Standalone public profile page (accessible via URL with ?id= parameter). Shows cover image, avatar, bio, university info, social links, follower/following counts, and user's posts.

• map.html — Standalone map page for viewing alumni locations on Google Maps.


═══════════════════════════════════════════════════════════════

3. DATABASE DESCRIPTION

The database is named "nis_alumni" and uses MySQL with the InnoDB engine and utf8mb4 character encoding for full Unicode support. The database consists of 8 tables.

Table Descriptions:

3.1 users
The core table storing all user account information.

Fields:
• id (INT, PRIMARY KEY, AUTO_INCREMENT) — Unique user identifier
• username (VARCHAR 30, UNIQUE) — Unique @handle chosen during registration
• email (VARCHAR 255, UNIQUE) — User's email address
• password_hash (VARCHAR 255) — Bcrypt-hashed password
• full_name (VARCHAR 150) — Display name
• nis_branch (VARCHAR 100) — NIS school city (e.g., "Shymkent", "Astana")
• graduation_year (YEAR) — Year of graduation
• university (VARCHAR 200) — Current/attended university
• degree_major (VARCHAR 200) — Field of study
• bio (TEXT) — Personal biography
• linkedin, instagram, youtube (VARCHAR 255) — Social media links
• avatar_url (VARCHAR 500) — Profile picture file path
• cover_url (VARCHAR 500) — Profile background/cover image path
• created_at, updated_at (TIMESTAMP) — Timestamps

SQL for users table:

CREATE TABLE IF NOT EXISTS `users` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `email`           VARCHAR(255)    NOT NULL,
  `password_hash`   VARCHAR(255)    NOT NULL,
  `full_name`       VARCHAR(150)    NOT NULL DEFAULT '',
  `nis_branch`      VARCHAR(100)    DEFAULT NULL,
  `graduation_year` YEAR            DEFAULT NULL,
  `university`      VARCHAR(200)    DEFAULT NULL,
  `degree_major`    VARCHAR(200)    DEFAULT NULL,
  `bio`             TEXT            DEFAULT NULL,
  `linkedin`        VARCHAR(255)    DEFAULT NULL,
  `instagram`       VARCHAR(255)    DEFAULT NULL,
  `youtube`         VARCHAR(255)    DEFAULT NULL,
  `avatar_url`      VARCHAR(500)    DEFAULT NULL,
  `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email` (`email`)
) ENGINE=InnoDB;


3.2 posts
Stores user-created posts for the social feed.

Fields:
• id (INT, PRIMARY KEY) — Unique post identifier
• user_id (INT, FOREIGN KEY → users.id) — Author of the post
• content (TEXT) — Post text content
• created_at, updated_at (TIMESTAMP) — Timestamps
• ON DELETE CASCADE — When a user is deleted, their posts are automatically removed


3.3 post_attachments
Stores file attachments (images, documents) linked to posts.

Fields:
• id (INT, PRIMARY KEY)
• post_id (INT, FOREIGN KEY → posts.id)
• file_path (VARCHAR 500) — Path to uploaded file
• file_type (VARCHAR 50) — MIME type category (image, video, etc.)
• original_name (VARCHAR 255) — Original filename


3.4 subscriptions (Follow System)
Tracks follower/following relationships between users. Uses a composite unique key to prevent duplicate follows.

Fields:
• id (INT, PRIMARY KEY)
• follower_id (INT, FOREIGN KEY → users.id) — The user who follows
• following_id (INT, FOREIGN KEY → users.id) — The user being followed
• created_at (TIMESTAMP)
• UNIQUE KEY on (follower_id, following_id) — Prevents duplicate follows


3.5 post_likes
Tracks which users liked which posts. Uses a unique constraint to ensure one like per user per post.

Fields:
• id (INT, PRIMARY KEY)
• post_id (INT, FOREIGN KEY → posts.id)
• user_id (INT, FOREIGN KEY → users.id)
• created_at (TIMESTAMP)
• UNIQUE KEY on (post_id, user_id) — One like per user per post


3.6 post_comments
Stores comments on posts with user attribution.

Fields:
• id (INT, PRIMARY KEY)
• post_id (INT, FOREIGN KEY → posts.id)
• user_id (INT, FOREIGN KEY → users.id)
• content (TEXT) — Comment text
• created_at (TIMESTAMP)


3.7 conversations
Tracks private chat threads between two users. The unique key ensures only one conversation exists between any two users.

Fields:
• id (INT, PRIMARY KEY)
• user_a (INT, FOREIGN KEY → users.id) — First user (always the lower ID)
• user_b (INT, FOREIGN KEY → users.id) — Second user (always the higher ID)
• updated_at (TIMESTAMP) — Updated on every new message
• UNIQUE KEY on (user_a, user_b)


3.8 messages
Stores individual chat messages with optional file attachments.

Fields:
• id (INT, PRIMARY KEY)
• conversation_id (INT, FOREIGN KEY → conversations.id)
• sender_id (INT, FOREIGN KEY → users.id)
• content (TEXT) — Message text (nullable if attachment-only)
• attachment_path (VARCHAR 500) — File path for attachments
• attachment_type (VARCHAR 50) — MIME type of attachment
• created_at (TIMESTAMP)


Entity Relationship Summary:
• users (1) → (many) posts
• users (1) → (many) post_likes
• users (1) → (many) post_comments
• users (1) → (many) subscriptions (as follower and as following)
• users (1) → (many) conversations (as user_a or user_b)
• users (1) → (many) messages (as sender)
• posts (1) → (many) post_attachments
• posts (1) → (many) post_likes
• posts (1) → (many) post_comments
• conversations (1) → (many) messages

All foreign keys use ON DELETE CASCADE, meaning when a parent record is deleted (e.g., a user or post), all related child records are automatically removed to maintain data integrity.


═══════════════════════════════════════════════════════════════

4. CODE ANALYSIS


4.1 HTML FRAGMENT

The following code fragment shows the navigation bar and sidebar structure from dashboard.html. The dashboard uses a Single-Page Application (SPA) pattern where all sections exist within one HTML file, and JavaScript toggles visibility. Tailwind CSS utility classes are used inline for rapid styling.

<!-- Top Navbar -->
<header class="h-16 bg-white border-b border-gray-200 flex items-center px-6 z-50 shrink-0">
    <div class="flex items-center justify-between w-full">

        <!-- Logo -->
        <a href="dashboard.html" class="flex items-center gap-2.5 no-underline">
            <span class="font-display font-900 text-navy text-xl tracking-tight">
                NIS Alumni<span class="text-accent">*</span>
            </span>
        </a>

        <!-- Search Bar -->
        <div class="hidden md:flex flex-1 max-w-md mx-8">
            <div class="relative w-full">
                <i data-lucide="search" class="w-4 h-4 text-gray-400 absolute left-3
                   top-1/2 -translate-y-1/2"></i>
                <input type="text" id="global-search" placeholder="Search alumni…"
                    class="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-full text-sm
                    border-none outline-none focus:ring-2 focus:ring-accent/30 transition" />
            </div>
        </div>

        <!-- User Avatar with Dropdown Menu -->
        <div class="relative">
            <button id="avatar-btn" class="flex items-center gap-2 hover:opacity-80 transition">
                <img id="nav-avatar" src="https://ui-avatars.com/api/?name=U&background=C8FF00
                    &color=0B1D3A&size=36" alt="Avatar"
                    class="w-9 h-9 rounded-full object-cover border-2 border-gray-200" />
                <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400"></i>
            </button>

            <div id="avatar-dropdown" class="hidden absolute right-0 top-full mt-2 w-52
                bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <a href="#" onclick="navigateTo('profile')"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600
                    hover:bg-gray-50 transition">
                    <i data-lucide="user" class="w-4 h-4"></i> Profile
                </a>
                <a href="api/logout.php"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500
                    hover:bg-red-50 transition">
                    <i data-lucide="log-out" class="w-4 h-4"></i> Log out
                </a>
            </div>
        </div>
    </div>
</header>

<!-- Sidebar Navigation -->
<aside class="w-64 bg-white border-r border-gray-200 shrink-0 hidden md:flex
       flex-col py-6 overflow-y-auto">
    <nav class="flex-1 px-4 space-y-1">
        <button onclick="navigateTo('feed')" data-nav="feed"
            class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl
            text-sm font-medium text-gray-600 hover:bg-gray-100 transition text-left">
            <i data-lucide="newspaper" class="w-5 h-5"></i> Feed
        </button>
        <button onclick="navigateTo('alumni')" data-nav="alumni"
            class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl
            text-sm font-medium text-gray-600 hover:bg-gray-100 transition text-left">
            <i data-lucide="users" class="w-5 h-5"></i> Alumni
        </button>
        <button onclick="navigateTo('map')" data-nav="map"
            class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl
            text-sm font-medium text-gray-600 hover:bg-gray-100 transition text-left">
            <i data-lucide="map" class="w-5 h-5"></i> Map
        </button>
        <button onclick="navigateTo('profile')" data-nav="profile"
            class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl
            text-sm font-medium text-gray-600 hover:bg-gray-100 transition text-left">
            <i data-lucide="user" class="w-5 h-5"></i> Profile
        </button>
        <button onclick="navigateTo('chat')" data-nav="chat"
            class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl
            text-sm font-medium text-gray-600 hover:bg-gray-100 transition text-left">
            <i data-lucide="message-square" class="w-5 h-5"></i> Chat
        </button>
        <button onclick="navigateTo('settings')" data-nav="settings"
            class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl
            text-sm font-medium text-gray-600 hover:bg-gray-100 transition text-left">
            <i data-lucide="settings" class="w-5 h-5"></i> Settings
        </button>
    </nav>
</aside>

Explanation:
• The <header> element creates a fixed navigation bar with a logo, search input, and user avatar dropdown. The Lucide icon library renders SVG icons via data-lucide attributes.
• The <aside> element creates a sidebar with navigation buttons. Each button calls navigateTo() with a section name, and data-nav attributes are used to track the active state.
• Tailwind CSS classes like "rounded-xl", "hover:bg-gray-100", and "transition" provide styling and interactivity without writing separate CSS.
• The Single-Page Application pattern means all content sections exist in one HTML file. The navigateTo() JavaScript function shows/hides them with smooth CSS animations.


— — — — — — — — — — — — — — — — — — — — — — — — — — — — — —


4.2 CSS FRAGMENT

The following code fragment shows the custom CSS used for animations, the glassmorphism card effect, and the section transition system. These styles complement Tailwind CSS with custom properties, keyframe animations, and specialized component styles.

/* ── Design Tokens (CSS Custom Properties) ──────────────── */
:root {
  --color-navy:       #0B1D3A;
  --color-navy-light: #15325E;
  --color-accent:     #C8FF00;
  --color-accent-soft:#D4FF4D;
}

/* ── Animated background gradient ────────────────────────── */
.gradient-animated {
  background: linear-gradient(135deg,
    var(--color-navy) 0%,
    var(--color-navy-light) 50%,
    #1a3a6b 100%);
  background-size: 200% 200%;
  animation: gradientShift 8s ease infinite;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}

/* ── Glass morphism card ─────────────────────────────────── */
.glass-card-light {
  background: rgba(255, 255, 255, .85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, .4);
  border-radius: 1.25rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, .04);
}

/* ── Section Transitions (Smooth sidebar switching) ─────── */
.section-enter {
  animation: sectionFadeIn 0.25s ease-out forwards;
}

.section-exit {
  animation: sectionFadeOut 0.2s ease-in forwards;
}

@keyframes sectionFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes sectionFadeOut {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-8px); }
}

/* ── Media Viewer (Fullscreen lightbox) ──────────────────── */
#media-viewer {
  animation: fadeIn 0.2s ease-out;
  backdrop-filter: blur(4px);
}

#media-content img,
#media-content video {
  animation: mediaZoomIn 0.3s ease-out;
}

@keyframes mediaZoomIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}

/* ── Upload Progress Bar (floating mini bar) ─────────────── */
.upload-progress-bar {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 280px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px 18px;
  box-shadow: 0 8px 30px rgba(0,0,0,.12);
  z-index: 90;
  animation: slideUpIn 0.3s ease-out;
}

@keyframes slideUpIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Like button animation ───────────────────────────────── */
.fill-red-500 {
  fill: #EF4444;
  stroke: #EF4444;
}

.post-like-btn:active {
  transform: scale(1.2);
  transition: transform 0.1s ease;
}

Explanation:
• CSS Custom Properties (:root variables) define the design system colors, making it easy to maintain consistent theming across the entire application.
• The gradient-animated class creates a smooth, continuously shifting background gradient used on the landing page and login screens, providing visual dynamism.
• The glass-card-light class implements the glassmorphism design trend using backdrop-filter: blur() and semi-transparent backgrounds, creating a modern frosted-glass appearance.
• Section transitions use CSS @keyframes animations for smooth fade-in/fade-out effects when users switch between dashboard sections. The sectionFadeIn animation slides content up while fading in, and sectionFadeOut does the reverse.
• The media viewer animations provide a zoom-in effect when opening images/videos in fullscreen mode.
• The upload-progress-bar uses fixed positioning to float in the bottom-right corner of the screen, with a slide-up entrance animation.
• The like button has a scale transform on :active, giving tactile feedback when users click the heart icon.


— — — — — — — — — — — — — — — — — — — — — — — — — — — — — —


4.3 JAVASCRIPT FRAGMENT

The following code fragment shows the key JavaScript functions that power the application's core features: the SPA navigation system, the post like toggle, and the chat messaging system.

Fragment 1 — SPA Navigation with Smooth Transitions:

function navigateTo(section, userId) {
    const currentEl = document.querySelector('.page-section:not(.hidden)');
    const targetEl = document.getElementById(`section-${section}`);

    // Update active nav button styling
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

    // Smooth transition: fade out current section, fade in new section
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
        case 'feed':    feedPage = 1; loadPosts(true); break;
        case 'alumni':  alumniPage = 1; loadAlumni(true); break;
        case 'map':     loadGoogleMaps(); break;
        case 'profile': profileUserId = userId || currentUser?.user_id;
                        loadProfile(profileUserId); break;
        case 'chat':    loadConversations(); break;
        case 'settings':loadSettings(); break;
    }
}

Explanation:
• The navigateTo() function is the heart of the SPA navigation. It finds the currently visible section and the target section, applies CSS animation classes for a smooth fade transition (200ms delay), then loads the appropriate data for the new section.
• The active navigation button is highlighted by toggling Tailwind CSS classes.
• The URL hash (location.hash) is updated so users can bookmark and share direct links to specific sections.
• The loadSectionData() function uses a switch statement to call the appropriate data-loading function for each section, following the modular function pattern.


Fragment 2 — Like Toggle with API Call:

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
            iconEl.classList.add('fill-red-500');
        } else {
            btn.classList.add('text-gray-400');
            btn.classList.remove('text-red-500');
            iconEl.classList.remove('fill-red-500');
        }
    } catch { }
}

Explanation:
• The toggleLike() function uses the async/await pattern to make an asynchronous POST request to the likes API. The server determines whether to add or remove the like (toggle behavior).
• After the API responds, the function updates the UI immediately: the like count text is updated, and the heart icon color is toggled between gray (not liked) and red (liked) using CSS classes.
• The function also adds the fill-red-500 class to fill the heart icon when liked, providing clear visual feedback.


Fragment 3 — Chat Message Sending:

async function sendChatMessage() {
    if (!currentChatUserId) return;
    const input = document.getElementById('chat-msg-input');
    const content = input.value.trim();
    if (!content) return;

    input.value = '';

    try {
        await fetch('api/chat.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: currentChatUserId, content }),
        });
        loadMessages(currentChatUserId);
    } catch { }
}

Explanation:
• The sendChatMessage() function sends a text message to the currently open chat user. It reads the input field value, clears it immediately for responsive UX, and sends a POST request with the recipient_id and message content.
• After sending, it calls loadMessages() to refresh the conversation thread and display the new message.
• The function uses JSON.stringify() to serialize the data and sets the Content-Type header to application/json, which is the REST API standard.


Fragment 4 — Upload with Progress Tracking:

function uploadWithProgress(formData, url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const bar = document.getElementById('upload-progress-bar');
        const fill = document.getElementById('upload-progress-fill');
        const pct = document.getElementById('upload-progress-pct');

        // Show progress bar
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

Explanation:
• The uploadWithProgress() function wraps XMLHttpRequest in a Promise, which allows it to be used with async/await syntax throughout the application.
• It uses the xhr.upload.onprogress event to track real-time upload progress, updating a floating progress bar in the bottom-right corner of the screen with the current percentage.
• The FormData object is used to send files, which automatically handles multipart/form-data encoding required for file uploads.
• After the upload completes, the progress bar stays visible for 1.5 seconds at 100% before hiding, providing visual confirmation.


— — — — — — — — — — — — — — — — — — — — — — — — — — — — — —


4.4 PHP FRAGMENT

Fragment 1 — Database Connection and Helper Functions (config/database.php):

<?php
// Start session (used for authentication)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Database connection settings (MAMP defaults)
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '8889');
define('DB_NAME', 'nis_alumni');
define('DB_USER', 'root');
define('DB_PASS', 'root');

/**
 * Returns a PDO instance connected to the nis_alumni database.
 * Uses a static variable so the connection is reused within a request.
 */
function getDB(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            DB_HOST, DB_PORT, DB_NAME
        );

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
            exit;
        }
    }

    return $pdo;
}

/**
 * Helper: send a JSON response and terminate.
 */
function jsonResponse(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

/**
 * Helper: require the user to be logged in.
 * Returns the authenticated user's ID or sends a 401 error.
 */
function requireAuth(): int
{
    if (empty($_SESSION['user_id'])) {
        jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
    }
    return (int) $_SESSION['user_id'];
}

Explanation:
• This file is the foundation of the backend. Every API endpoint includes this file first via require_once.
• The session_start() call at the top enables PHP sessions for authentication tracking across requests.
• The getDB() function uses a Singleton-like pattern with a static variable — the PDO connection is created only once per HTTP request and reused, improving performance.
• PDO (PHP Data Objects) is used instead of the older mysqli extension because it supports prepared statements natively, preventing SQL injection attacks.
• The PDO configuration sets ERRMODE_EXCEPTION for proper error handling, FETCH_ASSOC for cleaner associative array results, and disables emulated prepares for true server-side parameter binding.
• The jsonResponse() helper standardizes all API responses as JSON with proper HTTP status codes and Content-Type headers.
• The requireAuth() helper checks if a user is logged in by verifying $_SESSION['user_id']. If not authenticated, it returns a 401 Unauthorized response.


Fragment 2 — User Registration with Username Validation (api/register.php):

<?php
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

// Parse JSON input
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$email           = trim($input['email'] ?? '');
$password        = $input['password'] ?? '';
$confirmPassword = $input['confirm_password'] ?? '';
$fullName        = trim($input['full_name'] ?? '');
$username        = strtolower(trim($input['username'] ?? ''));
$nisBranch       = trim($input['nis_branch'] ?? '');
$gradYear        = $input['graduation_year'] ?? null;

// Validation
$errors = [];
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'A valid email is required.';
}
if (strlen($password) < 6) {
    $errors[] = 'Password must be at least 6 characters.';
}
if ($password !== $confirmPassword) {
    $errors[] = 'Passwords do not match.';
}
if (empty($fullName)) {
    $errors[] = 'Full name is required.';
}
if (!preg_match('/^[a-zA-Z0-9_]{3,30}$/', $username)) {
    $errors[] = 'Username must be 3-30 characters (letters, numbers, underscores).';
}

if (!empty($errors)) {
    jsonResponse(['success' => false, 'errors' => $errors], 422);
}

// Check for duplicate email and username
$db = getDB();
$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonResponse(['success' => false,
        'message' => 'An account with this email already exists.'], 409);
}

$stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);
if ($stmt->fetch()) {
    jsonResponse(['success' => false,
        'message' => 'This username is already taken.'], 409);
}

// Insert new user with hashed password
$hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $db->prepare('
    INSERT INTO users (username, email, password_hash, full_name, nis_branch, graduation_year)
    VALUES (?, ?, ?, ?, ?, ?)
');
$stmt->execute([$username, $email, $hash, $fullName, $nisBranch ?: null, $gradYear ?: null]);

$userId = (int) $db->lastInsertId();

// Auto-login after registration
$_SESSION['user_id'] = $userId;

jsonResponse(['success' => true, 'user_id' => $userId,
    'message' => 'Registration successful.'], 201);

Explanation:
• The registration endpoint accepts POST requests with JSON body data. The php://input stream is used to read raw JSON, with a fallback to $_POST for form submissions.
• Server-side validation checks email format (FILTER_VALIDATE_EMAIL), password length, password confirmation match, name requirement, and username format (regex pattern: alphanumeric and underscores, 3-30 characters).
• The username is normalized to lowercase with strtolower() to ensure case-insensitive uniqueness.
• Prepared statements ($db->prepare() with ? placeholders) are used for all database queries, which prevents SQL injection — one of the most critical web security measures.
• The password is hashed using password_hash() with PASSWORD_DEFAULT (bcrypt), which is the PHP-recommended approach for secure password storage. The original password is never stored.
• After successful registration, the user is automatically logged in by setting $_SESSION['user_id'], providing a seamless experience.
• HTTP status codes are used correctly: 201 (Created) for success, 422 (Unprocessable Entity) for validation errors, 409 (Conflict) for duplicate data, and 405 (Method Not Allowed) for wrong HTTP method.


Fragment 3 — Post Likes Toggle (api/likes.php):

<?php
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

// POST: Toggle like (like if not liked, unlike if already liked)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = requireAuth();
    $input  = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $postId = (int) ($input['post_id'] ?? 0);

    if ($postId === 0) {
        jsonResponse(['success' => false, 'message' => 'post_id required.'], 422);
    }

    // Check if user already liked this post
    $stmt = $db->prepare('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?');
    $stmt->execute([$postId, $userId]);
    $existing = $stmt->fetch();

    if ($existing) {
        // Already liked → unlike (delete the record)
        $db->prepare('DELETE FROM post_likes WHERE id = ?')->execute([$existing['id']]);
        $action = 'unliked';
    } else {
        // Not liked → like (insert new record)
        $db->prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)')
           ->execute([$postId, $userId]);
        $action = 'liked';
    }

    // Return updated count
    $stmt = $db->prepare('SELECT COUNT(*) FROM post_likes WHERE post_id = ?');
    $stmt->execute([$postId]);
    $count = (int) $stmt->fetchColumn();

    jsonResponse([
        'success'    => true,
        'action'     => $action,
        'is_liked'   => $action === 'liked',
        'like_count' => $count,
    ]);
}

Explanation:
• This endpoint implements a toggle pattern: a single POST request either adds or removes a like, depending on the current state. This simplifies the frontend — only one button handler is needed.
• The requireAuth() call ensures only logged-in users can like posts, returning 401 if not authenticated.
• The database is checked for an existing like record. If found, it is deleted (unlike); if not found, a new record is inserted (like). This approach uses the database as the single source of truth.
• After toggling, the total like count is recalculated with COUNT(*) and returned to the frontend, ensuring the UI always shows the accurate count.


═══════════════════════════════════════════════════════════════

5. CONCLUSION

The NIS Alumni website project demonstrates the application of modern full-stack web development techniques to solve a real-world community problem. The platform successfully integrates:

• Frontend development with HTML5 semantic structure, CSS3 animations and glassmorphism effects, and advanced JavaScript including asynchronous programming, DOM manipulation, and the MediaRecorder API for audio recording.

• Backend development with PHP 8 REST API endpoints, secure session-based authentication, PDO prepared statements for SQL injection prevention, and bcrypt password hashing.

• Database design with MySQL, including normalized table structures, foreign key relationships with cascade deletion, unique constraints for data integrity, and efficient indexing for query performance.

• User experience features such as smooth SPA navigation with CSS transitions, real-time upload progress tracking, fullscreen media viewer with keyboard navigation, and live username availability checking during registration.

The project encompasses over 2,000 lines of JavaScript, 195 lines of SQL, 14 PHP API endpoints, and 7 HTML pages, demonstrating competency in all four core web technologies (HTML, CSS, JavaScript, PHP) and database management with MySQL.

Possible future improvements include:
• Real-time messaging using WebSockets instead of polling
• Push notifications for new messages and likes
• Email verification during registration
• Mobile application version using React Native
• Post sharing and reposting functionality
• Group chats and community channels


═══════════════════════════════════════════════════════════════

6. SCREENSHOTS

[Insert screenshots of the following pages:]

1. Landing Page (index.html) — showing the hero section with animated gradient background
2. Registration Page — showing the @username field with availability check
3. Login Page — showing the login form
4. Dashboard Feed — showing posts with like and comment buttons
5. Profile Section — showing cover image, avatar, stats, about section, and social links
6. Chat Section — showing conversation list and message thread
7. Media Viewer — showing an image opened in the fullscreen lightbox
8. Settings Section — showing the profile editing form with avatar and cover upload
9. Alumni Directory — showing the searchable list of graduates
10. Upload Progress Bar — showing the floating progress indicator during file upload
