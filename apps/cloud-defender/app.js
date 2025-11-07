// Cloud Defender Application
// Main application logic for navigation, data loading, and UI updates

class CloudDefenderApp {
    constructor() {
        this.resources = [];
        this.attackPaths = [];
        this.securityAlerts = [];
        
        this.init();
    }

    async init() {
        // Load CSV data
        await this.loadData();
        
        // Setup event listeners
        this.setupNavigation();
        this.setupKeyboardNavigation();
        this.setupInventoryHandlers();
        
        // Update dashboard metrics
        this.updateDashboard();
        
        // Render inventory table
        this.renderInventoryTable();
    }

    async loadData() {
        try {
            // Load assessed resources
            const resourcesData = await this.loadCSV('assessed_resources.csv');
            this.resources = this.parseCSV(resourcesData);
            
            // Load attack paths
            try {
                const attackPathsData = await this.loadCSV('attack_paths.csv');
                this.attackPaths = this.parseCSV(attackPathsData);
            } catch (e) {
                console.log('No attack paths data available');
                this.attackPaths = [];
            }
            
            // Load security alerts
            try {
                const securityAlertsData = await this.loadCSV('security_alerts.csv');
                this.securityAlerts = this.parseCSV(securityAlertsData);
            } catch (e) {
                console.log('No security alerts data available');
                this.securityAlerts = [];
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    async loadCSV(filename) {
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}`);
        }
        return await response.text();
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            data.push(row);
        }
        
        return data;
    }

    setupNavigation() {
        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageName = link.getAttribute('data-page');
                this.navigateToPage(pageName);
            });
        });

        // Assessed resources card click
        const assessedResourcesCard = document.getElementById('assessed-resources-card');
        if (assessedResourcesCard) {
            assessedResourcesCard.addEventListener('click', () => {
                this.navigateToPage('inventory');
            });
        }

        // Close button on inventory page
        const closeButton = document.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.navigateToPage('overview');
            });
        }

        // Section header toggles
        const sectionHeaders = document.querySelectorAll('.nav-section-header');
        sectionHeaders.forEach(header => {
            header.addEventListener('click', () => {
                this.toggleSection(header);
            });
        });
    }

    setupKeyboardNavigation() {
        // Enable keyboard navigation for nav links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    link.click();
                }
            });
        });

        // Enable keyboard navigation for assessed resources card
        const assessedResourcesCard = document.getElementById('assessed-resources-card');
        if (assessedResourcesCard) {
            assessedResourcesCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    assessedResourcesCard.click();
                }
            });
        }
    }

    setupInventoryHandlers() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterResources(e.target.value);
            });
        }
    }

    navigateToPage(pageName) {
        // Hide all pages
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => {
            page.classList.remove('active');
        });

        // Show selected page
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // Update navigation active state
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === pageName) {
                link.classList.add('active');
            }
        });

        // Update page title
        const pageTitle = pageName.charAt(0).toUpperCase() + 
                         pageName.slice(1).replace('-', ' ');
        document.title = `Microsoft Defender for Cloud | ${pageTitle}`;
    }

    toggleSection(header) {
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        const targetId = header.getAttribute('aria-controls');
        const targetList = document.getElementById(targetId);

        if (targetList) {
            if (isExpanded) {
                header.setAttribute('aria-expanded', 'false');
                header.classList.add('collapsed');
                targetList.classList.add('hidden');
            } else {
                header.setAttribute('aria-expanded', 'true');
                header.classList.remove('collapsed');
                targetList.classList.remove('hidden');
            }
        }
    }

    updateDashboard() {
        // Update subscription count (always 1 per spec)
        document.getElementById('subscription-count').textContent = '1';

        // Update assessed resources count
        const assessedCount = this.resources.length;
        document.getElementById('assessed-resources-count').textContent = assessedCount;

        // Update attack paths count
        const attackPathsCount = this.attackPaths.length;
        document.getElementById('attack-paths-count').textContent = 
            attackPathsCount > 0 ? attackPathsCount : '--';

        // Update security alerts count
        const securityAlertsCount = this.securityAlerts.length;
        document.getElementById('security-alerts-count').textContent = 
            securityAlertsCount > 0 ? securityAlertsCount : '--';
    }

    renderInventoryTable() {
        const tbody = document.getElementById('resource-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Update summary counts
        this.updateInventorySummary();

        // Render each resource
        this.resources.forEach(resource => {
            const row = this.createResourceRow(resource);
            tbody.appendChild(row);
        });
    }

    createResourceRow(resource) {
        const row = document.createElement('tr');
        row.setAttribute('role', 'row');

        // Resource name
        const nameCell = document.createElement('td');
        const nameLink = document.createElement('a');
        nameLink.href = '#';
        nameLink.className = 'resource-name';
        nameLink.textContent = resource.Resource_name || 'N/A';
        nameLink.setAttribute('aria-label', `View details for ${resource.Resource_name}`);
        nameCell.appendChild(nameLink);
        row.appendChild(nameCell);

        // Resource type
        const typeCell = document.createElement('td');
        typeCell.textContent = resource.Resource_type || 'N/A';
        row.appendChild(typeCell);

        // Scope
        const scopeCell = document.createElement('td');
        scopeCell.textContent = resource.Scope || 'N/A';
        row.appendChild(scopeCell);

        // Environment
        const envCell = document.createElement('td');
        const envBadge = document.createElement('span');
        envBadge.className = 'env-badge';
        const environment = resource.Environment || 'N/A';
        
        let envIcon = '☁️';
        if (environment === 'AWS') envIcon = '🔶';
        else if (environment === 'GCP') envIcon = '☁️';
        else if (environment === 'Azure') envIcon = '☁️';
        
        envBadge.innerHTML = `<span>${envIcon}</span><span>${environment}</span>`;
        envCell.appendChild(envBadge);
        row.appendChild(envCell);

        // Defender for Cloud status
        const defenderCell = document.createElement('td');
        const defenderStatus = resource.Defender_for_Cloud || 'N/A';
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge ${defenderStatus.toLowerCase() === 'enabled' ? 'status-enabled' : 'status-disabled'}`;
        statusBadge.textContent = defenderStatus;
        defenderCell.appendChild(statusBadge);
        row.appendChild(defenderCell);

        // Recommendations
        const recsCell = document.createElement('td');
        const recommendations = resource.Recommendations || 'N/A';
        recsCell.className = 'recommendations-list';
        recsCell.textContent = recommendations;
        row.appendChild(recsCell);

        return row;
    }

    updateInventorySummary() {
        // Total resources
        document.getElementById('total-resources').textContent = this.resources.length;

        // Unhealthy resources (resources with disabled defender)
        const unhealthy = this.resources.filter(r => 
            r.Defender_for_Cloud && r.Defender_for_Cloud.toLowerCase() === 'disabled'
        ).length;
        document.getElementById('unhealthy-resources').textContent = unhealthy;

        // Count by environment
        const envCounts = {
            Azure: 0,
            AWS: 0,
            GCP: 0
        };

        this.resources.forEach(resource => {
            const env = resource.Environment || '';
            if (env in envCounts) {
                envCounts[env]++;
            }
        });

        document.getElementById('azure-count').textContent = envCounts.Azure;
        document.getElementById('aws-count').textContent = envCounts.AWS;
        document.getElementById('gcp-count').textContent = envCounts.GCP;
    }

    filterResources(searchTerm) {
        const tbody = document.getElementById('resource-table-body');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(term)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CloudDefenderApp();
});
