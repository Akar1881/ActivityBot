document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const leaderboardType = document.getElementById('leaderboard-type');
    const timeFilter = document.getElementById('time-filter');
    const timeFilterContainer = document.getElementById('time-filter-container');
    const guildSearch = document.getElementById('guild-search');
    const searchButton = document.getElementById('search-button');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const currentPageSpan = document.getElementById('current-page');
    const totalPagesSpan = document.getElementById('total-pages');
    const tableHeaderRow = document.getElementById('table-header-row');
    
    // State
    let currentPage = 1;
    let totalPages = 10; // Default value, will be updated from API
    let guildsData = [];
    let filteredGuilds = [];
    const itemsPerPage = 10;
    let currentLeaderboardType = leaderboardType.value;
    
    // Initialize
    fetchGuildsData();
    
    // Event Listeners
    leaderboardType.addEventListener('change', handleLeaderboardTypeChange);
    timeFilter.addEventListener('change', handleFilterChange);
    searchButton.addEventListener('click', handleSearch);
    guildSearch.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });
    prevPageButton.addEventListener('click', goToPrevPage);
    nextPageButton.addEventListener('click', goToNextPage);
    
    // Set initial values from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const timeFilterParam = urlParams.get('timeFilter');
    const typeParam = urlParams.get('type');
    
    if (timeFilterParam && timeFilter.querySelector(`option[value="${timeFilterParam}"]`)) {
        timeFilter.value = timeFilterParam;
    }
    
    if (typeParam && leaderboardType.querySelector(`option[value="${typeParam}"]`)) {
        leaderboardType.value = typeParam;
        currentLeaderboardType = typeParam;
        
        // Hide time filter for invite leaderboard
        if (typeParam === 'invites') {
            timeFilterContainer.classList.add('hidden');
        } else {
            timeFilterContainer.classList.remove('hidden');
        }
    }
    
    // Functions
    function fetchGuildsData() {
        // Show loading state
        showLoadingState();
        
        // Get the current filters
        const currentTimeFilter = timeFilter.value;
        const searchTerm = guildSearch.value.trim();
        const type = leaderboardType.value;
        
        // Fetch data from our API endpoint
        fetch(`/leaderboard/api/guilds?timeFilter=${currentTimeFilter}&page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}&type=${type}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Use the data from the API
                guildsData = data.guilds || [];
                currentLeaderboardType = data.leaderboardType || 'xp';
                
                // Update pagination based on API response
                totalPages = data.pagination.totalPages || 1;
                currentPage = data.pagination.currentPage || 1;
                
                filteredGuilds = [...guildsData];
                updatePagination();
                renderGuildsList();
            })
            .catch(error => {
                console.error('Error fetching guild data:', error);
                
                // Fallback to using the data already rendered in the page
                const rows = leaderboardBody.querySelectorAll('tr');
                guildsData = Array.from(rows).map((row, index) => {
                    const rankCell = row.querySelector('.rank-column');
                    const guildCell = row.querySelector('.guild-column');
                    const membersCell = row.querySelector('.members-column');
                    
                    if (currentLeaderboardType === 'invites') {
                        const invitesCell = row.querySelector('.invites-column');
                        return {
                            rank: index + 1,
                            id: guildCell?.querySelector('.guild-id')?.textContent.replace('ID: ', '') || `guild-${index}`,
                            name: guildCell?.querySelector('.guild-name')?.textContent || `Guild ${index + 1}`,
                            iconURL: guildCell?.querySelector('.guild-icon')?.src || '/img/default-guild.png',
                            memberCount: parseInt(membersCell?.textContent.replace(/,/g, '') || '0'),
                            totalInvites: parseInt(invitesCell?.textContent.replace(/,/g, '').replace(' Invites', '') || '0')
                        };
                    } else {
                        const xpCell = row.querySelector('.xp-column');
                        return {
                            rank: index + 1,
                            id: guildCell?.querySelector('.guild-id')?.textContent.replace('ID: ', '') || `guild-${index}`,
                            name: guildCell?.querySelector('.guild-name')?.textContent || `Guild ${index + 1}`,
                            iconURL: guildCell?.querySelector('.guild-icon')?.src || '/img/default-guild.png',
                            memberCount: parseInt(membersCell?.textContent.replace(/,/g, '') || '0'),
                            totalXP: parseInt(xpCell?.textContent.replace(/,/g, '').replace(' XP', '') || '0')
                        };
                    }
                });
                
                filteredGuilds = [...guildsData];
                totalPages = Math.ceil(filteredGuilds.length / itemsPerPage);
                updatePagination();
                renderGuildsList();
            });
    }
    
    function generateMockData(count) {
        const mockData = [];
        const baseXP = 1000000;
        
        for (let i = 0; i < count; i++) {
            mockData.push({
                rank: i + 1,
                id: `guild-${i}`,
                name: `Discord Guild ${i + 1}`,
                iconURL: '/img/default-guild.png',
                memberCount: Math.floor(Math.random() * 10000) + 100,
                totalXP: Math.floor(baseXP - (i * baseXP / count) + Math.random() * 50000)
            });
        }
        
        return mockData;
    }
    
    function handleLeaderboardTypeChange() {
        // Get the current type
        const type = leaderboardType.value;
        
        // Show/hide time filter based on leaderboard type
        if (type === 'invites') {
            timeFilterContainer.classList.add('hidden');
        } else {
            timeFilterContainer.classList.remove('hidden');
        }
        
        // Redirect to the same page with the selected leaderboard type
        const currentTimeFilter = timeFilter.value;
        window.location.href = `/leaderboard?type=${type}${type === 'xp' ? `&timeFilter=${currentTimeFilter}` : ''}`;
    }
    
    function handleFilterChange() {
        // Redirect to the same page with the selected time filter
        const type = leaderboardType.value;
        window.location.href = `/leaderboard?type=${type}&timeFilter=${timeFilter.value}`;
    }
    
    function handleSearch() {
        const searchTerm = guildSearch.value.trim();
        currentPage = 1;
        fetchGuildsData();
    }
    
    function goToPrevPage() {
        if (currentPage > 1) {
            currentPage--;
            fetchGuildsData();
            scrollToTop();
        }
    }
    
    function goToNextPage() {
        if (currentPage < totalPages) {
            currentPage++;
            fetchGuildsData();
            scrollToTop();
        }
    }
    
    function updatePagination() {
        currentPageSpan.textContent = currentPage;
        totalPagesSpan.textContent = totalPages;
        
        prevPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
    }
    
    function renderGuildsList() {
        // Clear current list
        leaderboardBody.innerHTML = '';
        
        // Update table headers based on leaderboard type
        // Get translations from the page
        const translations = {
            rank: document.querySelector('th.rank-column')?.textContent || 'Rank',
            guild: document.querySelector('th.guild-column')?.textContent || 'Server',
            members: document.querySelector('th.members-column')?.textContent || 'Members',
            totalXp: document.querySelector('th.xp-column')?.textContent || 'Total XP',
            activity: document.querySelector('th.activity-column')?.textContent || 'Activity',
            totalInvites: document.querySelector('th.invites-column')?.textContent || 'Regular Invites',
            inviters: document.querySelector('th.activity-column')?.textContent || 'Inviters'
        };
        
        if (currentLeaderboardType === 'invites') {
            tableHeaderRow.innerHTML = `
                <th class="rank-column">${translations.rank}</th>
                <th class="guild-column">${translations.guild}</th>
                <th class="members-column">${translations.members}</th>
                <th class="invites-column">${translations.totalInvites}</th>
                <th class="activity-column">${translations.inviters}</th>
            `;
        } else {
            tableHeaderRow.innerHTML = `
                <th class="rank-column">${translations.rank}</th>
                <th class="guild-column">${translations.guild}</th>
                <th class="members-column">${translations.members}</th>
                <th class="xp-column">${translations.totalXp}</th>
                <th class="activity-column">${translations.activity}</th>
            `;
        }
        
        // Calculate start and end indices for current page
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, filteredGuilds.length);
        
        // If no results found
        if (filteredGuilds.length === 0) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.innerHTML = `
                <td colspan="5" class="no-results">
                    <div class="no-results-message">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <p>No guilds found matching your search</p>
                    </div>
                </td>
            `;
            leaderboardBody.appendChild(noResultsRow);
            return;
        }
        
        // Render guilds for current page
        for (let i = startIndex; i < endIndex; i++) {
            const guild = filteredGuilds[i];
            const rank = i + 1;
            const isTopThree = rank <= 3;
            
            const row = document.createElement('tr');
            row.className = isTopThree ? `top-three rank-${rank}` : '';
            
            if (currentLeaderboardType === 'invites') {
                // Get the highest invites value for calculating activity bar width
                const highestInvites = filteredGuilds[0]?.totalInvites || 1;
                
                row.innerHTML = `
                    <td class="rank-column">
                        <div class="rank-badge">${rank}</div>
                    </td>
                    <td class="guild-column">
                        <div class="guild-info">
                            <img src="${guild.iconURL}" alt="${guild.name}" class="guild-icon">
                            <div class="guild-details">
                                <div class="guild-name">${guild.name}</div>
                                <div class="guild-id">ID: ${guild.id}</div>
                            </div>
                        </div>
                    </td>
                    <td class="members-column">${guild.memberCount.toLocaleString()}</td>
                    <td class="invites-column">${guild.totalInvites.toLocaleString()} ${translations.totalInvites}</td>
                    <td class="activity-column">
                        <div class="activity-bar-container">
                            <div class="activity-bar" style="width: ${Math.min(100, (guild.totalInvites / highestInvites) * 100)}%"></div>
                        </div>
                        <span>${guild.inviterCount || 0} ${translations.inviters.toLowerCase()}</span>
                    </td>
                `;
            } else {
                // Get the highest XP value for calculating activity bar width
                const highestXP = filteredGuilds[0]?.totalXP || 1;
                
                row.innerHTML = `
                    <td class="rank-column">
                        <div class="rank-badge">${rank}</div>
                    </td>
                    <td class="guild-column">
                        <div class="guild-info">
                            <img src="${guild.iconURL}" alt="${guild.name}" class="guild-icon">
                            <div class="guild-details">
                                <div class="guild-name">${guild.name}</div>
                                <div class="guild-id">ID: ${guild.id}</div>
                            </div>
                        </div>
                    </td>
                    <td class="members-column">${guild.memberCount.toLocaleString()}</td>
                    <td class="xp-column">${guild.totalXP.toLocaleString()} ${translations.totalXp}</td>
                    <td class="activity-column">
                        <div class="activity-bar-container">
                            <div class="activity-bar" style="width: ${Math.min(100, (guild.totalXP / highestXP) * 100)}%"></div>
                        </div>
                    </td>
                `;
            }
            
            leaderboardBody.appendChild(row);
        }
        
        // Add animation to rows
        animateRows();
    }
    
    function showLoadingState() {
        leaderboardBody.innerHTML = '';
        
        for (let i = 0; i < itemsPerPage; i++) {
            const row = document.createElement('tr');
            row.className = 'loading-row';
            
            row.innerHTML = `
                <td class="rank-column">
                    <div class="rank-badge loading-placeholder"></div>
                </td>
                <td class="guild-column">
                    <div class="guild-info">
                        <div class="guild-icon loading-placeholder"></div>
                        <div class="guild-details">
                            <div class="guild-name loading-placeholder"></div>
                            <div class="guild-id loading-placeholder"></div>
                        </div>
                    </div>
                </td>
                <td class="members-column">
                    <div class="loading-placeholder"></div>
                </td>
                <td class="xp-column">
                    <div class="loading-placeholder"></div>
                </td>
                <td class="activity-column">
                    <div class="activity-bar-container loading-placeholder"></div>
                </td>
            `;
            
            leaderboardBody.appendChild(row);
        }
    }
    
    function animateRows() {
        const rows = leaderboardBody.querySelectorAll('tr');
        
        rows.forEach((row, index) => {
            row.style.opacity = '0';
            row.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                row.style.opacity = '1';
                row.style.transform = 'translateY(0)';
            }, 50 * index);
        });
    }
    
    function scrollToTop() {
        const leaderboardContainer = document.querySelector('.leaderboard-container');
        if (leaderboardContainer) {
            leaderboardContainer.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    // Add these styles for loading placeholders
    const style = document.createElement('style');
    style.textContent = `
        .loading-placeholder {
            background: linear-gradient(90deg, var(--bg-tertiary), var(--bg-secondary), var(--bg-tertiary));
            background-size: 200% 100%;
            animation: loading-animation 1.5s infinite;
            border-radius: 4px;
            height: 1rem;
            width: 100%;
        }
        
        .guild-icon.loading-placeholder {
            width: 36px;
            height: 36px;
            border-radius: 50%;
        }
        
        .rank-badge.loading-placeholder {
            width: 30px;
            height: 30px;
            border-radius: 50%;
        }
        
        @keyframes loading-animation {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        .no-results-message {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem 0;
            color: var(--text-muted);
        }
        
        .no-results-message svg {
            width: 48px;
            height: 48px;
            stroke: var(--text-muted);
            margin-bottom: 1rem;
        }
    `;
    document.head.appendChild(style);
});