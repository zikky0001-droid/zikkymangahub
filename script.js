// MangaDex API Configuration
const BASE_URL = "https://api.mangadex.org";
const CDN_URL = "https://uploads.mangadex.org";

// State Management
let currentOffset = 0;
let isLoading = false;
let hasMoreResults = true;
let currentQuery = "";
let currentGenre = "all";
let selectedManga = null;
let selectedChapter = null;
let currentChapters = [];
let downloadedChapters = JSON.parse(localStorage.getItem('downloadedChapters')) || [];
let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];

// DOM Elements
let mainContainer, detailsPage, readerPage, resultsContainer, loadingIndicator, endResults;
let searchInput, searchBtn, menuToggle, themeToggle, backToTop, toastContainer;
let backFromDetails, backFromReader, prevChapterBtn, nextChapterBtn, downloadCurrentBtn;
let downloadOptionsModal, closeModalBtns, startDownloadBtn;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    initializeApp();
});

function initializeDOMElements() {
    mainContainer = document.getElementById('mainContainer');
    detailsPage = document.getElementById('detailsPage');
    readerPage = document.getElementById('readerPage');
    resultsContainer = document.getElementById('results');
    loadingIndicator = document.getElementById('loading');
    endResults = document.getElementById('endResults');
    toastContainer = document.getElementById('toastContainer');
    searchInput = document.getElementById('searchInput');
    searchBtn = document.getElementById('searchBtn');
    menuToggle = document.getElementById('menuToggle');
    themeToggle = document.getElementById('themeToggle');
    backToTop = document.getElementById('backToTop');
    backFromDetails = document.getElementById('backFromDetails');
    backFromReader = document.getElementById('backFromReader');
    prevChapterBtn = document.getElementById('prevChapterBtn');
    nextChapterBtn = document.getElementById('nextChapterBtn');
    downloadCurrentBtn = document.getElementById('downloadCurrentBtn');
    downloadOptionsModal = document.getElementById('downloadOptionsModal');
    closeModalBtns = document.querySelectorAll('.close-modal');
    startDownloadBtn = document.getElementById('startDownloadBtn');
    
    if (mainContainer) mainContainer.style.display = 'block';
}

function initializeApp() {
    loadManga();
    setupEventListeners();
    createParticles();
    
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
        if (themeToggle) {
            themeToggle.querySelector('i').className = 'fas fa-sun';
        }
    }
}

function setupEventListeners() {
    if (searchBtn) {
        searchBtn.addEventListener('click', startSearch);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') startSearch();
        });
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGenre = btn.dataset.genre;
            resetSearch();
        });
    });

    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMenu);
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (backFromDetails) {
        backFromDetails.addEventListener('click', () => {
            if (detailsPage) detailsPage.style.display = 'none';
            if (mainContainer) mainContainer.style.display = 'block';
            document.body.style.overflow = 'auto';
        });
    }

    if (backFromReader) {
        backFromReader.addEventListener('click', () => {
            if (readerPage) readerPage.style.display = 'none';
            if (detailsPage) detailsPage.style.display = 'block';
            document.body.style.overflow = 'auto';
        });
    }

    if (prevChapterBtn) {
        prevChapterBtn.addEventListener('click', () => navigateChapter('prev'));
    }
    
    if (nextChapterBtn) {
        nextChapterBtn.addEventListener('click', () => navigateChapter('next'));
    }
    
    if (downloadCurrentBtn) {
        downloadCurrentBtn.addEventListener('click', () => {
            if (selectedChapter && selectedManga) {
                if (readerPage) readerPage.style.display = 'none';
                showDownloadOptions(selectedChapter.index);
            }
        });
    }

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (downloadOptionsModal) downloadOptionsModal.style.display = 'none';
        });
    });

    if (startDownloadBtn) {
        startDownloadBtn.addEventListener('click', startDownload);
    }

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

function resetSearch() {
    currentOffset = 0;
    hasMoreResults = true;
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (endResults) endResults.style.display = 'none';
    loadManga();
}

function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.width = Math.random() * 3 + 'px';
        particle.style.height = particle.style.width;
        particle.style.animation = `float-particle ${Math.random() * 10 + 10}s linear infinite`;
        particle.style.animationDelay = Math.random() * 5 + 's';
        particlesContainer.appendChild(particle);
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const icon = themeToggle ? themeToggle.querySelector('i') : null;
    if (icon) {
        if (document.body.classList.contains('light-theme')) {
            icon.className = 'fas fa-sun';
            localStorage.setItem('theme', 'light');
        } else {
            icon.className = 'fas fa-moon';
            localStorage.setItem('theme', 'dark');
        }
    }
}

function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

// Format rating from MangaDex data
function formatRating(manga) {
    try {
        // MangaDex rating is between 0-10 already
        const rating = manga.attributes?.rating;
        if (!rating) return null;
        
        // Use bayesian rating if available (most accurate)
        const bayesianRating = rating.bayesian;
        const meanRating = rating.mean;
        
        // Get vote count from distribution
        let voteCount = 0;
        if (rating.distribution) {
            voteCount = Object.values(rating.distribution).reduce((a, b) => a + b, 0);
        }
        
        if (bayesianRating && bayesianRating > 0) {
            return {
                score: bayesianRating.toFixed(1),
                votes: voteCount,
                display: bayesianRating.toFixed(1)
            };
        } else if (meanRating && meanRating > 0) {
            return {
                score: meanRating.toFixed(1),
                votes: voteCount,
                display: meanRating.toFixed(1)
            };
        }
        return null;
    } catch (error) {
        console.error('Error formatting rating:', error);
        return null;
    }
}

// Load Manga from API
async function loadManga() {
    if (isLoading || !hasMoreResults) return;
    
    isLoading = true;
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    try {
        // Build URL with proper parameters
        let url = `${BASE_URL}/manga?limit=20&offset=${currentOffset}&includes[]=cover_art&includes[]=artist&includes[]=author&order[followedCount]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=en`;
        
        if (currentQuery) {
            url += `&title=${encodeURIComponent(currentQuery)}`;
        }
        
        if (currentGenre && currentGenre !== 'all') {
            const genreId = getGenreId(currentGenre);
            if (genreId) {
                url += `&includedTags[]=${genreId}`;
            }
        }

        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.data || data.data.length === 0) {
            hasMoreResults = false;
            if (endResults) endResults.style.display = 'block';
            showToast('No more manga available', 'info');
            return;
        }

        await displayManga(data.data);
        currentOffset += 20;
        
        if (data.data.length < 20) {
            hasMoreResults = false;
            if (endResults) endResults.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading manga:', error);
        showToast('Failed to load manga. Please try again.', 'error');
    } finally {
        isLoading = false;
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// Get Genre ID
function getGenreId(genre) {
    const genreMap = {
        'action': '391b0423-d847-456f-aff0-8b0cfc03066b',
        'romance': '423e2eae-a7a2-4a8b-ac03-a8351462d71d',
        'fantasy': 'cdc58593-87c6-4c3b-b4f6-b2c5c5f2e0d8',
        'comedy': '4d32cc48-9f00-4cca-9b5a-a839f0764984',
        'adventure': 'f4122d1c-3b44-44d0-9936-ff7502c39ad3',
        'horror': '0a39b5b1-b88e-4ec2-9d0c-f69aceaa7da9'
    };
    return genreMap[genre];
}

// Display Manga Grid
async function displayManga(mangaList) {
    if (!resultsContainer) return;
    
    // Fetch statistics for all manga in batch
    const mangaIds = mangaList.map(m => m.id).join(',');
    let statsData = {};
    
    try {
        const statsResponse = await fetch(`${BASE_URL}/statistics/manga?manga=${mangaIds}`);
        const stats = await statsResponse.json();
        statsData = stats.statistics || {};
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
    
    mangaList.forEach(manga => {
        const coverFileName = manga.relationships.find(r => r.type === 'cover_art')?.attributes?.fileName;
        const coverUrl = coverFileName ? `${CDN_URL}/covers/${manga.id}/${coverFileName}` : 'https://via.placeholder.com/200x280?text=No+Cover';
        
        const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title';
        
        // Get stats for this manga
        const mangaStats = statsData[manga.id] || {};
        const rating = mangaStats.rating || {};
        const follows = mangaStats.follows || 0;
        
        // Format rating
        let ratingDisplay = 'N/A';
        if (rating.bayesian) {
            ratingDisplay = rating.bayesian.toFixed(1);
        } else if (rating.average) {
            ratingDisplay = rating.average.toFixed(1);
        }
        
        const card = document.createElement('div');
        card.className = 'manga-card';
        
        card.innerHTML = `
            <img src="${coverUrl}" alt="${title}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x280?text=No+Cover'">
            <div class="manga-info">
                <div class="manga-title">${title}</div>
                <div class="manga-stats">
                    <span><i class="fas fa-star" style="color: #ffd700;"></i> ${ratingDisplay}</span>
                    <span><i class="fas fa-heart"></i> ${follows}</span>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => openMangaDetails(manga.id, title));
        resultsContainer.appendChild(card);
    });
}

// Open Manga Details Page
async function openMangaDetails(mangaId, title) {
    selectedManga = { id: mangaId, title };
    
    try {
        showToast('Loading manga details...', 'info');
        
        // Fetch manga details
        const response = await fetch(`${BASE_URL}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist&includes[]=tag`);
        if (!response.ok) throw new Error('Failed to fetch manga details');
        const data = await response.json();
        
        // Fetch manga statistics
        const statsResponse = await fetch(`${BASE_URL}/statistics/manga/${mangaId}`);
        if (!statsResponse.ok) throw new Error('Failed to fetch statistics');
        const statsData = await statsResponse.json();
        
        // Fetch chapters with proper counting
        currentChapters = await fetchAllChapters(mangaId);
        
        // Hide main container and show details page
        if (mainContainer) mainContainer.style.display = 'none';
        if (detailsPage) detailsPage.style.display = 'block';
        document.body.style.overflow = 'auto';
        
        // Display details
        displayMangaDetails(data.data, statsData.statistics?.[mangaId]);
    } catch (error) {
        console.error('Error opening manga:', error);
        showToast('Failed to load manga details: ' + error.message, 'error');
    }
}

// Fetch ALL chapters correctly
async function fetchAllChapters(mangaId) {
    let allChapters = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    
    try {
        while (hasMore) {
            const response = await fetch(
                `${BASE_URL}/chapter?manga=${mangaId}&translatedLanguage[]=en&limit=${limit}&offset=${offset}&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`
            );
            
            if (!response.ok) break;
            
            const data = await response.json();
            
            if (data.data.length === 0) {
                hasMore = false;
                break;
            }
            
            // Filter out duplicate chapters and sort properly
            const validChapters = data.data.filter(ch => {
                // Filter out chapters with no chapter number
                return ch.attributes.chapter !== null && ch.attributes.chapter !== undefined;
            });
            
            allChapters = [...allChapters, ...validChapters];
            offset += limit;
            
            // Check if we've got all chapters
            if (data.total && offset >= data.total) {
                hasMore = false;
            }
        }
        
        // Sort chapters numerically
        allChapters.sort((a, b) => {
            const numA = parseFloat(a.attributes.chapter) || 0;
            const numB = parseFloat(b.attributes.chapter) || 0;
            return numA - numB;
        });
        
    } catch (error) {
        console.error('Error fetching chapters:', error);
        showToast('Error loading chapters', 'error');
    }
    
    return allChapters;
}

// Display Manga Details
function displayMangaDetails(manga, stats) {
    const wrapper = document.getElementById('mangaDetailsWrapper');
    if (!wrapper) return;
    
    const description = manga.attributes.description.en || 'No description available';
    const coverFile = manga.relationships.find(r => r.type === 'cover_art')?.attributes?.fileName;
    const coverUrl = coverFile ? `${CDN_URL}/covers/${manga.id}/${coverFile}` : 'https://via.placeholder.com/300x400?text=No+Cover';
    
    // Get author and artist
    const author = manga.relationships.find(r => r.type === 'author')?.attributes?.name || 'Unknown';
    const artist = manga.relationships.find(r => r.type === 'artist')?.attributes?.name || 'Unknown';
    
    // Safely extract statistics
    const rating = stats?.rating || {};
    const follows = stats?.follows || 0;
    const comments = stats?.comments?.count || 0;
    
    // Calculate rating display
    let ratingValue = 'N/A';
    let voteCount = 0;
    
    if (rating.bayesian) {
        ratingValue = rating.bayesian.toFixed(1);
    } else if (rating.average) {
        ratingValue = rating.average.toFixed(1);
    }
    
    // Get vote count from distribution
    if (rating.distribution) {
        voteCount = Object.values(rating.distribution).reduce((a, b) => a + b, 0);
    }
    
    // Generate star rating
    const starRating = ratingValue !== 'N/A' ? Math.round(parseFloat(ratingValue) / 2) : 0;
    const stars = '★'.repeat(starRating) + '☆'.repeat(5 - starRating);
    
    wrapper.innerHTML = `
        <div class="manga-details-grid">
            <div class="details-cover-container">
                <img src="${coverUrl}" alt="${selectedManga.title}" class="details-cover" onerror="this.src='https://via.placeholder.com/300x400?text=No+Cover'">
            </div>
            <div class="details-info">
                <h2 class="details-title">${selectedManga.title}</h2>
                
                <div class="rating-container">
                    <div class="rating-score">
                        <span class="rating-value">${ratingValue}</span>
                        <span class="rating-stars">${stars}</span>
                    </div>
                    <div class="rating-details">
                        <span><i class="fas fa-users"></i> ${follows.toLocaleString()} follows</span>
                        <span><i class="fas fa-vote-yea"></i> ${voteCount.toLocaleString()} votes</span>
                        <span><i class="fas fa-comments"></i> ${comments.toLocaleString()} comments</span>
                    </div>
                </div>
                
                <div class="details-description">
                    ${description.replace(/\n/g, '<br>')}
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label"><i class="fas fa-book"></i> Chapters:</span>
                        <span class="info-value">${currentChapters.length}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><i class="fas fa-calendar"></i> Year:</span>
                        <span class="info-value">${manga.attributes.year || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><i class="fas fa-pen"></i> Author:</span>
                        <span class="info-value">${author}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><i class="fas fa-paint-brush"></i> Artist:</span>
                        <span class="info-value">${artist}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><i class="fas fa-globe"></i> Status:</span>
                        <span class="info-value">${manga.attributes.status || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><i class="fas fa-language"></i> Language:</span>
                        <span class="info-value">${manga.attributes.originalLanguage?.toUpperCase() || 'Unknown'}</span>
                    </div>
                </div>
                
                <div class="details-tags">
                    ${manga.attributes.tags.map(tag => 
                        `<span class="tag">${tag.attributes.name.en}</span>`
                    ).join('')}
                </div>
                
                <div class="action-buttons">
                    <button class="action-btn primary" id="readFirstBtn">
                        <i class="fas fa-book-open"></i> Read First Chapter
                    </button>
                    <button class="action-btn secondary" id="bookmarkBtn">
                        <i class="far fa-bookmark"></i> Bookmark
                    </button>
                </div>
            </div>
        </div>
        
        <div class="chapters-section">
            <h3><i class="fas fa-list"></i> Chapters (${currentChapters.length})</h3>
            <div class="chapter-list" id="chapterList">
                ${currentChapters.length > 0 ? 
                    currentChapters.map((ch, index) => {
                        const chapterNum = ch.attributes.chapter || (index + 1);
                        const chapterTitle = ch.attributes.title || '';
                        const pages = ch.attributes.pages || 0;
                        const uploaded = ch.attributes.publishAt ? new Date(ch.attributes.publishAt).toLocaleDateString() : 'Unknown';
                        return `
                            <div class="chapter-item" data-chapter-index="${index}">
                                <div class="chapter-info">
                                    <span class="chapter-number">Chapter ${chapterNum}</span>
                                    ${chapterTitle ? `<span class="chapter-title">${chapterTitle}</span>` : ''}
                                    <span class="chapter-pages"><i class="far fa-file-image"></i> ${pages} pages</span>
                                    <span class="chapter-date"><i class="far fa-calendar-alt"></i> ${uploaded}</span>
                                </div>
                                <div class="chapter-actions">
                                    <button class="chapter-action-btn read-chapter" data-index="${index}" title="Read">
                                        <i class="fas fa-book-open"></i>
                                    </button>
                                    <button class="chapter-action-btn download-chapter" data-index="${index}" title="Download">
                                        <i class="fas fa-download"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('') 
                    : '<div class="no-chapters">No chapters available</div>'
                }
            </div>
        </div>
    `;
    
    // Add event listeners
    document.querySelectorAll('.chapter-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.chapter-actions')) {
                const index = item.dataset.chapterIndex;
                if (index !== undefined) openChapterReader(parseInt(index));
            }
        });
    });
    
    document.querySelectorAll('.read-chapter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = btn.dataset.index;
            if (index !== undefined) openChapterReader(parseInt(index));
        });
    });
    
    document.querySelectorAll('.download-chapter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = btn.dataset.index;
            if (index !== undefined) showDownloadOptions(parseInt(index));
        });
    });
    
    const readFirstBtn = document.getElementById('readFirstBtn');
    if (readFirstBtn) {
        readFirstBtn.addEventListener('click', () => {
            if (currentChapters.length > 0) {
                openChapterReader(0);
            } else {
                showToast('No chapters available', 'info');
            }
        });
    }
    
    const bookmarkBtn = document.getElementById('bookmarkBtn');
    if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', () => {
            toggleBookmark(selectedManga.id, selectedManga.title);
        });
    }
    
    updateBookmarkButton();
}

function toggleBookmark(id, title) {
    const index = bookmarks.findIndex(b => b.id === id);
    
    if (index === -1) {
        bookmarks.push({ id, title, addedAt: new Date().toISOString() });
        showToast('Bookmarked!', 'success');
    } else {
        bookmarks.splice(index, 1);
        showToast('Removed from bookmarks', 'info');
    }
    
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    updateBookmarkButton();
}

function updateBookmarkButton() {
    const bookmarkBtn = document.getElementById('bookmarkBtn');
    if (!bookmarkBtn || !selectedManga) return;
    
    const isBookmarked = bookmarks.some(b => b.id === selectedManga.id);
    
    if (isBookmarked) {
        bookmarkBtn.innerHTML = '<i class="fas fa-bookmark"></i> Bookmarked';
    } else {
        bookmarkBtn.innerHTML = '<i class="far fa-bookmark"></i> Bookmark';
    }
}

// Open Chapter Reader
async function openChapterReader(index) {
    if (index < 0 || index >= currentChapters.length) return;
    
    selectedChapter = {
        index,
        id: currentChapters[index].id,
        number: currentChapters[index].attributes.chapter || (index + 1),
        title: currentChapters[index].attributes.title || ''
    };
    
    try {
        showToast('Loading chapter...', 'info');
        
        const response = await fetch(`${BASE_URL}/at-home/server/${selectedChapter.id}`);
        if (!response.ok) throw new Error('Failed to load chapter');
        
        const data = await response.json();
        
        const baseUrl = data.baseUrl;
        const chapterHash = data.chapter.hash;
        const pages = data.chapter.data.map(page => 
            `${baseUrl}/data/${chapterHash}/${page}`
        );
        
        if (detailsPage) detailsPage.style.display = 'none';
        if (readerPage) readerPage.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        displayReader(pages);
    } catch (error) {
        console.error('Error loading chapter:', error);
        showToast('Failed to load chapter', 'error');
    }
}

function displayReader(pages) {
    const readerBody = document.getElementById('readerBody');
    const readerTitle = document.getElementById('readerTitle');
    const chapterIndicator = document.getElementById('chapterIndicator');
    
    if (readerTitle) {
        readerTitle.textContent = selectedManga ? selectedManga.title : '';
    }
    
    if (chapterIndicator) {
        chapterIndicator.textContent = `Chapter ${selectedChapter.number}/${currentChapters.length}`;
    }
    
    if (readerBody) {
        readerBody.innerHTML = pages.map(page => 
            `<img src="${page}" alt="Page" loading="lazy" onerror="this.src='https://via.placeholder.com/800x1200?text=Error+Loading+Page'">`
        ).join('');
    }
    
    const readerContainer = document.querySelector('.reader-container');
    if (readerContainer) readerContainer.scrollTop = 0;
}

function showDownloadOptions(index) {
    if (!selectedManga || !currentChapters[index]) return;
    
    selectedChapter = {
        index,
        id: currentChapters[index].id,
        number: currentChapters[index].attributes.chapter || (index + 1),
        mangaTitle: selectedManga.title
    };
    
    const downloadChapterInfo = document.getElementById('downloadChapterInfo');
    if (downloadChapterInfo) {
        downloadChapterInfo.innerHTML = `
            <h4>Chapter ${selectedChapter.number}</h4>
            <p>${selectedManga.title}</p>
            <small>Pages: ${currentChapters[index].attributes.pages || '?'}</small>
        `;
    }
    
    const downloadProgress = document.getElementById('downloadProgress');
    if (downloadProgress) downloadProgress.style.display = 'none';
    
    if (downloadOptionsModal) downloadOptionsModal.style.display = 'block';
}

async function startDownload() {
    const quality = document.querySelector('input[name="quality"]:checked')?.value || 'original';
    
    if (downloadOptionsModal) downloadOptionsModal.style.display = 'none';
    
    try {
        showToast('Preparing download...', 'info');
        
        const response = await fetch(`${BASE_URL}/at-home/server/${selectedChapter.id}`);
        if (!response.ok) throw new Error('Failed to fetch chapter');
        
        const data = await response.json();
        
        const baseUrl = data.baseUrl;
        const chapterHash = data.chapter.hash;
        const pages = data.chapter.data;
        
        const downloadedPages = [];
        const totalPages = pages.length;
        
        for (let i = 0; i < pages.length; i++) {
            const pageUrl = `${baseUrl}/data/${chapterHash}/${pages[i]}`;
            const pageData = await downloadPage(pageUrl, i, totalPages);
            downloadedPages.push(pageData);
        }
        
        await createAndDownloadZip(downloadedPages);
        showToast('Download complete!', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToast('Download failed. Please try again.', 'error');
    }
}

async function downloadPage(url, index, total) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to download page');
        const blob = await response.blob();
        return {
            blob,
            name: `page_${String(index + 1).padStart(3, '0')}.jpg`
        };
    } catch (error) {
        console.error(`Error downloading page ${index + 1}:`, error);
        throw error;
    }
}

async function createAndDownloadZip(pages) {
    if (typeof JSZip === 'undefined') {
        showToast('JSZip library not loaded', 'error');
        return;
    }
    
    const zip = new JSZip();
    const safeTitle = (selectedChapter.mangaTitle || 'manga').replace(/[^a-z0-9]/gi, '_');
    const folderName = `${safeTitle}_Chapter_${selectedChapter.number}`;
    const folder = zip.folder(folderName);
    
    pages.forEach(page => {
        folder.file(page.name, page.blob);
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderName}.zip`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    saveToDownloaded();
}

function saveToDownloaded() {
    const downloadItem = {
        id: `${selectedChapter.mangaTitle}_${selectedChapter.number}`,
        mangaTitle: selectedChapter.mangaTitle,
        chapterNumber: selectedChapter.number,
        downloadedAt: new Date().toISOString()
    };
    
    downloadedChapters.push(downloadItem);
    localStorage.setItem('downloadedChapters', JSON.stringify(downloadedChapters));
}

function navigateChapter(direction) {
    if (!selectedChapter || !currentChapters.length) return;
    
    let newIndex = selectedChapter.index;
    
    if (direction === 'prev' && newIndex > 0) {
        newIndex--;
    } else if (direction === 'next' && newIndex < currentChapters.length - 1) {
        newIndex++;
    } else {
        showToast(direction === 'prev' ? 'This is the first chapter' : 'This is the last chapter', 'info');
        return;
    }
    
    openChapterReader(newIndex);
}

function handleScroll() {
    if (backToTop) {
        if (window.scrollY > 300) {
            backToTop.classList.add('show');
        } else {
            backToTop.classList.remove('show');
        }
    }
    
    if (mainContainer && mainContainer.style.display !== 'none') {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            loadManga();
        }
    }
}

function showToast(message, type = 'info') {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function startSearch() {
    if (searchInput) {
        currentQuery = searchInput.value;
        resetSearch();
    }
}