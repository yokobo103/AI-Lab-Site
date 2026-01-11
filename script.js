/**
 * AI Experimental Lab - Main Script
 */

// CDLEブログのカード用データ
// 追加したいときは下の配列に { id, title, url, thumb, desc } を足すだけでOK
// thumb を省略すると OGP 画像を自動取得（外部API: api.microlink.io）し、なければプレースホルダー表示。
const cdlePosts = [
    {
        id: 'cdle-001',
        title: '超初心者🔰が自分のwebサイトをつくる【Antigravity】',
        url: 'https://cdle.jp/blogs/ffb76d24c03a',
        // thumb: 'https://example.com/your-ogp.png', // 手動指定する場合
        //desc: ''
    },
    {
        id: 'cdle-002',
        title: '超初心者🔰がモザイクを取り払う',
        url: 'https://cdle.jp/blogs/9ce809712d93',
    },
        {
        id: 'cdle-003',
        title: '超初心者🔰が世界に色をつける',
        url: 'https://cdle.jp/blogs/6c482fd3c526',   
    },
    {
        id: 'cdle-004',
        title: '超初心者🔰がチャットモンスターバトルにチャレンジしてみた話',
        url: 'https://cdle.jp/blogs/3b5b784f674c',   
    },
    {
        id: 'cdle-005',
        title: '超初心者🔰がチャトモンに新機能を追加してみた',
        url: 'https://cdle.jp/blogs/1097ac766312',   
    },
    {
        id: 'cdle-006',
        title: '超初心者🔰がmulmocast使ってみた',
        url: 'https://cdle.jp/blogs/3f95fe98c9d3',   
    }
];

// OGP取得キャッシュ（同じURLへの連続リクエストを防ぐ）
const ogpCache = new Map();

document.addEventListener('DOMContentLoaded', () => {
    renderExperiments();
    renderLogs();
    renderCdle();
    setupThemeToggle();
    setupModal();
    openModalFromHash();
});

/**
 * Render Experiment Cards
 */
function renderExperiments() {
    const grid = document.getElementById('experiments-grid');

    // experiments array is loaded from experiments.js
    if (typeof experiments === 'undefined' || !grid) return;

    grid.innerHTML = experiments.map(exp => `
        <article class="experiment-card" data-id="${exp.id}">
            ${exp.image ? `
            <div class="card-image-container">
                <img src="${exp.image}" alt="${exp.title}" class="card-image" loading="lazy">
            </div>
            ` : ''}
            <div class="card-header">
                <span class="card-date">${exp.date}</span>
                <h3 class="card-title">${exp.title}</h3>
            </div>
            <div class="card-tags">
                ${exp.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <p class="card-summary">${exp.summary}</p>
            <div class="card-footer">
                <span class="card-link">View Details &rarr;</span>
            </div>
        </article>
    `).join('');

    // Add click listeners to cards
    document.querySelectorAll('.experiment-card').forEach(card => {
        card.addEventListener('click', () => {
            const expId = card.getAttribute('data-id');
            const expData = experiments.find(e => e.id === expId);
            if (expData) {
                openModal(expData);
            }
        });
    });
}

/**
 * Render Lab Logs
 */
function renderLogs() {
    const list = document.getElementById('lab-log-list');

    if (typeof labLogs === 'undefined' || !list) return;

    list.innerHTML = labLogs.map(log => `
        <div class="log-item">
            <span class="log-date">${log.date}</span>
            <p class="log-content">${log.content}</p>
        </div>
    `).join('');
}

/**
 * Render CDLE Blog Cards
 */
function renderCdle() {
    const grid = document.getElementById('cdle-grid');
    if (!grid || typeof cdlePosts === 'undefined') return;

    const fallbackThumb = 'https://placehold.co/600x360?text=CDLE+Blog';

    grid.innerHTML = cdlePosts.map(post => `
        <article class="cdle-card experiment-card">
            <a href="${post.url}" target="_blank" rel="noopener" class="cdle-thumb-link">
                <div class="card-image-container">
                    <img src="${post.thumb || fallbackThumb}" ${post.thumb ? '' : `data-ogp-url="${post.url}"`} alt="${post.title}" class="card-image cdle-thumb" loading="lazy">
                </div>
            </a>
            <div class="card-header">
                <span class="card-date">CDLE Blog</span>
                <h3 class="card-title">${post.title}</h3>
            </div>
            <p class="card-summary">${post.desc || '<span class="cdle-desc-placeholder">CDLEブログの紹介文をここに追加してください。</span>'}</p>
            <div class="card-footer">
                <a class="card-link" href="${post.url}" target="_blank" rel="noopener">View Details →</a>
            </div>
        </article>
    `).join('');

    // thumb が未指定のものは OGP 画像を自動取得して差し替え
    resolveCdleOgps();
}

/**
 * 外部OGP APIから画像を取得し、プレースホルダーを置き換える
 */
async function resolveCdleOgps() {
    const targets = Array.from(document.querySelectorAll('.cdle-thumb[data-ogp-url]'));
    if (targets.length === 0) return;

    await Promise.allSettled(targets.map(async (img) => {
        const targetUrl = img.dataset.ogpUrl;
        const ogp = await fetchOgpImage(targetUrl);
        if (ogp) {
            img.src = ogp;
            img.removeAttribute('data-ogp-url');
        }
    }));
}

/**
 * Microlink API を使って OGP 画像URLを取得
 */
async function fetchOgpImage(targetUrl) {
    if (!targetUrl) return null;

    if (ogpCache.has(targetUrl)) {
        return ogpCache.get(targetUrl);
    }

    const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&meta=true`;

    try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const imageUrl = json?.data?.image?.url;
        if (imageUrl) {
            ogpCache.set(targetUrl, imageUrl);
            return imageUrl;
        }
    } catch (err) {
        console.warn('OGP fetch failed for', targetUrl, err);
    }

    ogpCache.set(targetUrl, null);
    return null;
}

/**
 * Modal Logic
 */
function setupModal() {
    const modal = document.getElementById('experiment-modal');
    const closeBtn = document.getElementById('modal-close');
    const overlay = document.getElementById('modal-overlay');

    if (!modal) return;

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
        if (location.hash.startsWith('#exp=')) {
            history.replaceState(null, '', location.pathname + location.search);
        }
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

function getExperimentIdFromHash() {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#exp=')) return null;
    return decodeURIComponent(hash.slice(5));
}

function openModalFromHash() {
    if (typeof experiments === 'undefined') return;
    const expId = getExperimentIdFromHash();
    if (!expId) return;
    const expData = experiments.find(e => e.id === expId);
    if (expData) {
        openModal(expData);
    }
}

function openModal(data) {
    const modal = document.getElementById('experiment-modal');

    // Populate data
    document.getElementById('modal-date').textContent = data.date;
    document.getElementById('modal-title').textContent = data.title;

    // Image handling
    const header = modal.querySelector('.modal-header');
    const existingImage = header.querySelector('.modal-image');
    if (existingImage) {
        existingImage.remove();
    }

    if (data.image) {
        const img = document.createElement('img');
        img.src = data.image;
        img.alt = data.title;
        img.className = 'modal-image';
        header.insertBefore(img, header.firstChild);
    }

    const tagsContainer = document.getElementById('modal-tags');
    tagsContainer.innerHTML = data.tags.map(tag => `<span class="tag">${tag}</span>`).join('');

    // Use marked.parse for Markdown rendering
    // Check if marked is available, otherwise fallback to textContent
    const parseMarkdown = (text) => {
        if (typeof marked !== 'undefined' && text) {
            return marked.parse(text);
        }
        return text || '';
    };

    // Render full markdown content
    const modalBody = modal.querySelector('.modal-body');
    // Clear previous content but keep the structure if needed, 
    // or just replace the whole body content with the markdown
    // We need to preserve the links section though.

    // Let's restructure the modal body dynamically
    let contentHtml = '';

    if (data.detail.content) {
        contentHtml += `<div class="modal-markdown">${parseMarkdown(data.detail.content)}</div>`;
    } else {
        // Fallback for old data structure (if any)
        if (data.detail.goal) contentHtml += `<div class="modal-section"><h4>Goal</h4><p>${parseMarkdown(data.detail.goal)}</p></div>`;
        if (data.detail.steps) contentHtml += `<div class="modal-section"><h4>Steps / Method</h4><p>${parseMarkdown(data.detail.steps)}</p></div>`;
        if (data.detail.result) contentHtml += `<div class="modal-section"><h4>Result / Learning</h4><p>${parseMarkdown(data.detail.result)}</p></div>`;
    }

    // Links section
    contentHtml += `<div class="modal-section"><h4>Links</h4><div id="modal-links" class="modal-links"></div></div>`;

    modalBody.innerHTML = contentHtml;

    const linksContainer = document.getElementById('modal-links');
    if (data.detail.links && data.detail.links.length > 0) {
        linksContainer.innerHTML = data.detail.links.map(link => `
            <a href="${link.url}" target="_blank" class="modal-link-btn">
                ${link.label} ↗
            </a>
        `).join('');
    } else {
        linksContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.9rem;">No links available</span>';
    }

    // Show modal
    if (data && data.id) {
        const nextHash = `#exp=${data.id}`;
        if (location.hash !== nextHash) {
            history.replaceState(null, '', location.pathname + location.search + nextHash);
        }
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

/**
 * Dark Mode Toggle
 */
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    const icon = toggleBtn.querySelector('.toggle-icon');

    // Check saved preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        icon.textContent = '☀️';
    }

    toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    });
}
