// ============================================
// CONFIGURATION
// ============================================

const AIRTABLE_BASE_ID = 'appwfr6TDvdfTpLOb';
const AIRTABLE_TABLE_ID = 'tblxh8JKmGzkNe2aN';

// Field IDs from table creation
const FIELDS = {
    produkt: 'fldCGIR2aUFW0kHyX',
    produktnummer: 'fldwlggbloAkJ3TJu',
    shopwareId: 'fldErX95xiQ1ywZjm',
    status: 'fldbGwXkocpqJerzH',
    ampel: 'fldrXDNVzuumVVGJa',
    alterText: 'fldhjX8wFuM9yI3IH',
    neuerText: 'fldYOrXPl8jIr1uJV',
    complianceProtokoll: 'fldlxI9afHwF52kgY',
    metaTitle: 'fld9PCzyr5DJL05vI',
    metaDescription: 'fldxopIzwycZUSunB',
    keywords: 'fldWQh578WKppK9Hm',
    shortDescription: 'fldynyKRUgdDfZg5G',
    seoStatus: 'fldVNwptTisLJmfKX',
    prueferKommentar: 'fldhx3UnPtJHAI2vN',
    geprueftVon: 'fldzcLHQwBlIjr66x',
    originalVerstoesse: 'fldWNwLbjcwmTSXRc',
    erstelltAm: 'fldFjqSLo0vTOFi4g',
    geprueftAm: 'fld5N56RiQDtjnShL',
    // Neue Felder für Original-Compliance
    originalComplianceStatus: 'fldPa5MMvArcEmBrn',
    originalComplianceFindings: 'fldd4r7GTcegj0ntu',
    // Feedback-Felder
    feedbackOriginaltext: 'fldqLqp3salKlj5Mj',
    feedbackWebshop: 'fldSiF8O9VYjY0r7W'
};

// ============================================
// STATE
// ============================================

let token = localStorage.getItem('airtable_token');
let reviewerName = localStorage.getItem('reviewer_name');
let currentRecord = null;
let recordQueue = [];
let currentQueueIndex = 0;
let currentMode = 'review'; // 'review' or 'browse'

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    if (!token || !reviewerName) {
        document.getElementById('setupScreen').style.display = 'flex';
        document.getElementById('mainHeader').style.display = 'none';
        // Falls einer der Werte existiert, vorausfüllen
        if (reviewerName) document.getElementById('nameInput').value = reviewerName;
        return;
    }
    
    // Show header
    document.getElementById('mainHeader').style.display = 'flex';
    
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');
    const modeParam = urlParams.get('mode');
    
    // Set mode from URL parameter
    if (modeParam === 'browse' || modeParam === 'review' || modeParam === 'overview' || modeParam === 'feedback') {
        currentMode = modeParam;
        document.getElementById('reviewModeTab').classList.toggle('active', modeParam === 'review');
        document.getElementById('browseModeTab').classList.toggle('active', modeParam === 'browse');
        document.getElementById('overviewModeTab').classList.toggle('active', modeParam === 'overview');
        document.getElementById('feedbackModeTab').classList.toggle('active', modeParam === 'feedback');
        document.getElementById('mainApp').classList.toggle('browse-mode', modeParam === 'browse');

        // Show/hide containers
        const showMainApp = modeParam === 'review' || modeParam === 'browse';
        document.getElementById('mainApp').style.display = showMainApp ? 'block' : 'none';
        document.getElementById('overviewPage').classList.toggle('active', modeParam === 'overview');
        document.getElementById('feedbackPage').classList.toggle('active', modeParam === 'feedback');

        // Show/hide header elements in overview/feedback mode
        const showProductBar = modeParam === 'review' || modeParam === 'browse';
        document.getElementById('productInfoBar').style.display = showProductBar ? 'flex' : 'none';
        document.getElementById('navControls').style.display = showProductBar ? 'flex' : 'none';

        let title = 'Produkttext Review';
        if (modeParam === 'browse') title = 'Produkttext Browse (Alle)';
        if (modeParam === 'overview') title = 'Produkttext Übersicht';
        if (modeParam === 'feedback') title = 'Feedback der Compliance-Entscheider';
        document.querySelector('.header h1').textContent = title;
    }

    if (modeParam === 'overview') {
        // Load overview data
        await loadOverviewData();
    } else if (modeParam === 'feedback') {
        // Load feedback data
        await loadFeedbackData();
    } else if (recordId) {
        // Direct link to specific record
        await loadRecord(recordId);
    } else {
        // Load queue of records to review
        await loadQueue();
    }
}

function saveSetup() {
    const inputName = document.getElementById('nameInput').value.trim();
    const inputToken = document.getElementById('tokenInput').value.trim();
    
    if (!inputName) {
        alert('Bitte Namen eingeben!');
        return;
    }
    if (!inputToken) {
        alert('Bitte Token eingeben!');
        return;
    }
    
    localStorage.setItem('reviewer_name', inputName);
    localStorage.setItem('airtable_token', inputToken);
    reviewerName = inputName;
    token = inputToken;
    document.getElementById('setupScreen').style.display = 'none';
    init();
}

// ============================================
// AIRTABLE API
// ============================================

async function airtableFetch(endpoint, options = {}) {
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    if (!response.ok) {
        throw new Error(`Airtable API Error: ${response.status}`);
    }
    
    return response.json();
}

async function loadQueue() {
    showLoading(true);
    
    try {
        let filterFormula;
        let sortField = 'Ampel';
        let sortDirection = 'desc';
        
        if (currentMode === 'browse') {
            // Browse mode: Load ALL records (no filter)
            filterFormula = '';
            sortField = 'Erstellt am';
            sortDirection = 'desc';
        } else {
            // Review mode: Load records for review
            filterFormula = '{Status}="Zur Prüfung"';
        }
        
        let url = `${AIRTABLE_TABLE_ID}?sort[0][field]=${encodeURIComponent(sortField)}&sort[0][direction]=${sortDirection}`;
        if (filterFormula) {
            url += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
        }
        
        const data = await airtableFetch(url);
        
        recordQueue = data.records || [];
        
        if (recordQueue.length === 0) {
            showAllDone();
            return;
        }
        
        currentQueueIndex = 0;
        await displayRecord(recordQueue[0]);
        updateQueueNavigation();
        
    } catch (error) {
        showError('Fehler beim Laden: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function switchMode(mode) {
    currentMode = mode;

    // Update tab styles
    document.getElementById('reviewModeTab').classList.toggle('active', mode === 'review');
    document.getElementById('browseModeTab').classList.toggle('active', mode === 'browse');
    document.getElementById('overviewModeTab').classList.toggle('active', mode === 'overview');
    document.getElementById('feedbackModeTab').classList.toggle('active', mode === 'feedback');

    // Show/hide containers
    const showMainApp = mode === 'review' || mode === 'browse';
    document.getElementById('mainApp').style.display = showMainApp ? 'block' : 'none';
    document.getElementById('overviewPage').classList.toggle('active', mode === 'overview');
    document.getElementById('feedbackPage').classList.toggle('active', mode === 'feedback');

    // Show/hide header elements in overview/feedback mode
    const showProductBar = mode === 'review' || mode === 'browse';
    document.getElementById('productInfoBar').style.display = showProductBar ? 'flex' : 'none';
    document.getElementById('navControls').style.display = showProductBar ? 'flex' : 'none';

    // Update body class for browse mode styling
    document.getElementById('mainApp').classList.toggle('browse-mode', mode === 'browse');

    // Update header title
    let title = 'Produkttext Review';
    if (mode === 'browse') title = 'Produkttext Browse (Alle)';
    if (mode === 'overview') title = 'Produkttext Übersicht';
    if (mode === 'feedback') title = 'Feedback der Compliance-Entscheider';
    document.querySelector('.header h1').textContent = title;

    // Clear comment input
    const commentInput = document.getElementById('commentInput');
    if (commentInput) commentInput.value = '';

    // Load appropriate data
    if (mode === 'overview') {
        loadOverviewData();
    } else if (mode === 'feedback') {
        loadFeedbackData();
    } else {
        loadQueue();
    }
}

// ============================================
// OVERVIEW FUNCTIONS
// ============================================

let allRecords = [];
let currentOverviewFilter = 'all';
let currentPage = 1;
const itemsPerPage = 50;

async function loadOverviewData() {
    document.getElementById('overviewTableBody').innerHTML = 
        '<tr><td colspan="6" class="no-results">Lade Daten...</td></tr>';
    
    try {
        // Load ALL records with Airtable pagination (offset)
        allRecords = [];
        let offset = null;
        
        do {
            let url = `${AIRTABLE_TABLE_ID}?sort[0][field]=Erstellt am&sort[0][direction]=desc&pageSize=100`;
            if (offset) {
                url += `&offset=${offset}`;
            }
            
            const data = await airtableFetch(url);
            allRecords = allRecords.concat(data.records || []);
            offset = data.offset; // Will be undefined when no more pages
            
        } while (offset);
        
        currentPage = 1;
        updateOverviewStats();
        renderOverviewTable();
        
    } catch (error) {
        document.getElementById('overviewTableBody').innerHTML = 
            `<tr><td colspan="6" class="no-results">Fehler beim Laden: ${error.message}</td></tr>`;
    }
}

function updateOverviewStats() {
    const total = allRecords.length;
    const live = allRecords.filter(r => r.fields['Status'] === 'Live').length;
    const approved = allRecords.filter(r => r.fields['Status'] === 'Freigegeben').length;
    const revise = allRecords.filter(r => r.fields['Status'] === 'Überarbeiten').length;
    const pending = allRecords.filter(r => r.fields['Status'] === 'Zur Prüfung').length;
    const origCompliance = allRecords.filter(r => 
        r.fields['Original-Compliance-Status'] === 'Kritisch' || 
        r.fields['Original-Compliance-Status'] === 'Prüfung empfohlen'
    ).length;
    
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statLive').textContent = live;
    document.getElementById('statApproved').textContent = approved;
    document.getElementById('statRevise').textContent = revise;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statOrigCompliance').textContent = origCompliance;
}

function getFilteredRecords() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    let filteredRecords = allRecords;
    
    // Apply status filter
    if (currentOverviewFilter !== 'all') {
        if (currentOverviewFilter === 'origCompliance') {
            // Filter by Original-Compliance-Status (Kritisch or Prüfung empfohlen)
            filteredRecords = filteredRecords.filter(r => 
                r.fields['Original-Compliance-Status'] === 'Kritisch' || 
                r.fields['Original-Compliance-Status'] === 'Prüfung empfohlen'
            );
        } else {
            filteredRecords = filteredRecords.filter(r => r.fields['Status'] === currentOverviewFilter);
        }
    }
    
    // Apply search filter
    if (searchTerm) {
        filteredRecords = filteredRecords.filter(r => {
            const produktnummer = (r.fields['Produktnummer'] || '').toLowerCase();
            const produktname = (r.fields['Produkt'] || '').toLowerCase();
            return produktnummer.includes(searchTerm) || produktname.includes(searchTerm);
        });
    }
    
    return filteredRecords;
}

function renderOverviewTable() {
    const tbody = document.getElementById('overviewTableBody');
    const filteredRecords = getFilteredRecords();
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageRecords = filteredRecords.slice(startIndex, endIndex);
    
    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-results">Keine Ergebnisse gefunden</td></tr>';
        renderPagination(0, 0);
        return;
    }
    
    tbody.innerHTML = pageRecords.map(record => {
        const fields = record.fields;
        const status = fields['Status'] || '-';
        const ampel = (fields['Ampel'] || 'GRÜN').toUpperCase();
        const geprueftAm = fields['Geprüft am'] ? new Date(fields['Geprüft am']).toLocaleDateString('de-DE') : '-';
        const erstelltAm = fields['Erstellt am'] ? new Date(fields['Erstellt am']).toLocaleDateString('de-DE') : '-';
        
        // Try to extract Original-Compliance status from direct field or protocol JSON
        let origCompStatus = fields['Original-Compliance-Status'] || '';
        if (!origCompStatus && fields['Compliance-Protokoll']) {
            try {
                let proto = fields['Compliance-Protokoll'];
                if (typeof proto === 'string') proto = JSON.parse(proto);
                if (proto?.originalTextCompliance?.status) {
                    origCompStatus = proto.originalTextCompliance.status;
                }
            } catch(e) {}
        }
        
        // Original-Compliance Ampel: OK = grün, Prüfung empfohlen = gelb, Kritisch = rot
        const origCompClass = origCompStatus === 'Kritisch' ? 'orig-rot' : 
                             origCompStatus === 'Prüfung empfohlen' ? 'orig-gelb' : 
                             origCompStatus === 'OK' ? 'orig-gruen' : 'orig-none';
        const origCompDisplay = origCompStatus === 'Kritisch' ? '✗' : 
                               origCompStatus === 'Prüfung empfohlen' ? '●' : 
                               origCompStatus === 'OK' ? '✓' : '-';
        
        const statusClass = status === 'Live' ? 'live' :
                           status === 'Freigegeben' ? 'freigegeben' : 
                           status === 'Überarbeiten' ? 'ueberarbeiten' : 
                           status === 'interner Review nötig' ? 'interner-review' : 'zur-pruefung';
        const ampelClass = ampel === 'GRÜN' ? 'gruen' : ampel === 'GELB' ? 'gelb' : 'rot';
        
        return `
            <tr onclick="openRecordInBrowse('${record.id}')">
                <td><strong>${fields['Produktnummer'] || '-'}</strong></td>
                <td>${fields['Produkt'] || '-'}</td>
                <td><span class="status-cell ${statusClass}">${status}</span></td>
                <td><span class="ampel-cell ${ampelClass}"></span></td>
                <td><span class="orig-comp-cell ${origCompClass}" title="${origCompStatus || 'Nicht geprüft'}">${origCompDisplay}</span></td>
                <td>${fields['Geprüft von'] || '-'}</td>
                <td class="date-cell">${geprueftAm !== '-' ? geprueftAm : erstelltAm}</td>
            </tr>
        `;
    }).join('');
    
    renderPagination(filteredRecords.length, totalPages);
}

function renderPagination(totalItems, totalPages) {
    const container = document.getElementById('paginationContainer');
    
    if (totalItems <= itemsPerPage) {
        container.innerHTML = `<span class="pagination-info">${totalItems} Einträge</span>`;
        return;
    }
    
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    
    let html = `<span class="pagination-info">${startItem}-${endItem} von ${totalItems}</span>`;
    html += '<div class="pagination-buttons">';
    
    // Previous button
    html += `<button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>←</button>`;
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += '<span class="pagination-ellipsis">...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="pagination-ellipsis">...</span>';
        html += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>→</button>`;
    html += '</div>';
    
    container.innerHTML = html;
}

function goToPage(page) {
    const filteredRecords = getFilteredRecords();
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderOverviewTable();
    
    // Scroll to top of table
    document.querySelector('.overview-table-wrapper').scrollIntoView({ behavior: 'smooth' });
}

function filterOverviewTable() {
    currentPage = 1; // Reset to first page on filter
    renderOverviewTable();
}

function setOverviewFilter(filter) {
    currentOverviewFilter = filter;
    currentPage = 1; // Reset to first page on filter
    
    // Update filter tab styles
    document.querySelectorAll('.filter-tab').forEach(tab => {
        const tabFilter = tab.textContent === 'Alle' ? 'all' : tab.textContent;
        tab.classList.toggle('active', tabFilter === filter);
    });
    
    renderOverviewTable();
}

function openRecordInBrowse(recordId) {
    // Switch to browse mode and load specific record
    window.location.href = `?mode=browse&id=${recordId}`;
}

async function loadRecord(recordId) {
    showLoading(true);
    
    try {
        const data = await airtableFetch(`${AIRTABLE_TABLE_ID}/${recordId}`);
        currentRecord = data;
        recordQueue = [data];
        currentQueueIndex = 0;
        await displayRecord(data);
        updateQueueNavigation();
        
    } catch (error) {
        showError('Fehler beim Laden: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function updateRecord(recordId, fields) {
    return airtableFetch(`${AIRTABLE_TABLE_ID}/${recordId}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields })
    });
}

// ============================================
// FEEDBACK FUNCTIONS
// ============================================

let feedbackRecords = [];
let currentFeedbackType = 'original'; // 'original' or 'webshop'
let selectedFeedbackRecord = null;

async function loadFeedbackData() {
    const listEl = document.getElementById('feedbackList');
    listEl.innerHTML = '<div class="feedback-list-empty">Lade Daten...</div>';

    try {
        // Load all records with pagination
        feedbackRecords = [];
        let offset = null;

        do {
            let url = `${AIRTABLE_TABLE_ID}?pageSize=100`;
            if (offset) {
                url += `&offset=${offset}`;
            }

            const data = await airtableFetch(url);
            feedbackRecords = feedbackRecords.concat(data.records || []);
            offset = data.offset;

        } while (offset);

        updateFeedbackStats();
        renderFeedbackList();

    } catch (error) {
        listEl.innerHTML = `<div class="feedback-list-empty">Fehler: ${error.message}</div>`;
    }
}

function setFeedbackType(type) {
    currentFeedbackType = type;
    document.getElementById('feedbackTypeOriginal').classList.toggle('active', type === 'original');
    document.getElementById('feedbackTypeWebshop').classList.toggle('active', type === 'webshop');

    // Reset selection
    selectedFeedbackRecord = null;
    document.getElementById('feedbackDetailPanel').innerHTML =
        '<div class="feedback-detail-empty"><p>Wähle ein Produkt aus der Liste, um Details anzuzeigen und Feedback zu geben.</p></div>';

    updateFeedbackStats();
    renderFeedbackList();
}

function updateFeedbackStats() {
    let kritisch = 0, pruefung = 0, offen = 0, erledigt = 0;

    if (currentFeedbackType === 'original') {
        // Count by Original-Compliance-Status
        feedbackRecords.forEach(r => {
            const status = r.fields['Original-Compliance-Status'];
            const hasFeedback = r.fields['Feedback Originaltext'];

            if (status === 'Kritisch') {
                if (hasFeedback) erledigt++; else { kritisch++; offen++; }
            } else if (status === 'Prüfung empfohlen') {
                if (hasFeedback) erledigt++; else { pruefung++; offen++; }
            }
        });
    } else {
        // Webshop: Count by Status === 'Überarbeiten'
        feedbackRecords.forEach(r => {
            const status = r.fields['Status'];
            const hasFeedback = r.fields['Feedback Webshop'];

            if (status === 'Überarbeiten') {
                if (hasFeedback) erledigt++; else offen++;
            }
        });
        // For webshop, kritisch/pruefung not applicable
        kritisch = '-';
        pruefung = '-';
    }

    document.getElementById('feedbackStatKritisch').textContent = kritisch;
    document.getElementById('feedbackStatPruefung').textContent = pruefung;
    document.getElementById('feedbackStatOffen').textContent = offen;
    document.getElementById('feedbackStatErledigt').textContent = erledigt;
}

function getFilteredFeedbackRecords() {
    const searchTerm = document.getElementById('feedbackSearchInput').value.toLowerCase();

    let filtered;

    if (currentFeedbackType === 'original') {
        // Filter: Original-Compliance-Status is 'Kritisch' or 'Prüfung empfohlen'
        filtered = feedbackRecords.filter(r => {
            const status = r.fields['Original-Compliance-Status'];
            return status === 'Kritisch' || status === 'Prüfung empfohlen';
        });
    } else {
        // Webshop: Status is 'Überarbeiten'
        filtered = feedbackRecords.filter(r => r.fields['Status'] === 'Überarbeiten');
    }

    // Apply search
    if (searchTerm) {
        filtered = filtered.filter(r => {
            const produktnummer = (r.fields['Produktnummer'] || '').toLowerCase();
            const produktname = (r.fields['Produkt'] || '').toLowerCase();
            return produktnummer.includes(searchTerm) || produktname.includes(searchTerm);
        });
    }

    // Sort by Ampel: ROT first, then GELB, then GRÜN
    const ampelOrder = { 'ROT': 0, 'GELB': 1, 'GRÜN': 2 };
    filtered.sort((a, b) => {
        const ampelA = a.fields['Ampel'] || 'GRÜN';
        const ampelB = b.fields['Ampel'] || 'GRÜN';
        return (ampelOrder[ampelA] || 2) - (ampelOrder[ampelB] || 2);
    });

    return filtered;
}

function renderFeedbackList() {
    const listEl = document.getElementById('feedbackList');
    const filtered = getFilteredFeedbackRecords();

    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="feedback-list-empty">Keine Produkte mit Feedback-Bedarf gefunden.</div>';
        return;
    }

    const feedbackField = currentFeedbackType === 'original' ? 'Feedback Originaltext' : 'Feedback Webshop';

    listEl.innerHTML = filtered.map(record => {
        const fields = record.fields;
        const hasFeedback = fields[feedbackField];
        const ampel = fields['Ampel'] || 'GRÜN';
        const ampelClass = ampel === 'ROT' ? 'rot' : (ampel === 'GELB' ? 'gelb' : 'gruen');

        let statusText = '';
        if (currentFeedbackType === 'original') {
            const compStatus = fields['Original-Compliance-Status'] || '';
            statusText = compStatus;
        } else {
            statusText = fields['Status'] || '';
        }

        return `
            <div class="feedback-list-item ${hasFeedback ? 'completed' : ''} ${selectedFeedbackRecord?.id === record.id ? 'active' : ''}"
                 onclick="selectFeedbackProduct('${record.id}')">
                <div class="item-header">
                    <span class="item-sku">${escapeHtml(fields['Produktnummer'] || '-')}</span>
                    <span class="item-ampel ${ampelClass}">${ampel}</span>
                </div>
                <div class="item-name">${escapeHtml(fields['Produkt'] || '-')}</div>
                <div class="item-status ${hasFeedback ? 'erledigt' : ''}">${hasFeedback ? '✓ Feedback gesendet' : statusText}</div>
            </div>
        `;
    }).join('');
}

function filterFeedbackList() {
    renderFeedbackList();
}

function selectFeedbackProduct(recordId) {
    selectedFeedbackRecord = feedbackRecords.find(r => r.id === recordId);
    if (!selectedFeedbackRecord) return;

    // Update list selection
    renderFeedbackList();

    const fields = selectedFeedbackRecord.fields;
    const feedbackField = currentFeedbackType === 'original' ? 'Feedback Originaltext' : 'Feedback Webshop';
    const existingFeedback = fields[feedbackField];

    const detailPanel = document.getElementById('feedbackDetailPanel');

    // Determine text and compliance info based on type
    let textContent, complianceStatus, complianceFindings, sectionTitle;

    if (currentFeedbackType === 'original') {
        textContent = fields['Alter Text'] || 'Kein Originaltext vorhanden.';
        complianceStatus = fields['Original-Compliance-Status'] || 'OK';
        complianceFindings = fields['Original-Compliance-Findings'] || 'Keine Findings vorhanden.';
        sectionTitle = 'Originaltext';
    } else {
        textContent = fields['Neuer Text'] || 'Kein neuer Text vorhanden.';
        complianceStatus = fields['Ampel'] || 'GRÜN';
        complianceFindings = fields['Compliance-Protokoll'] || 'Kein Protokoll vorhanden.';
        sectionTitle = 'Neuer Text (Webshop)';
    }

    // Map status to CSS class
    let statusClass = 'ok';
    if (complianceStatus === 'Kritisch' || complianceStatus === 'ROT') statusClass = 'kritisch';
    else if (complianceStatus === 'Prüfung empfohlen' || complianceStatus === 'GELB') statusClass = 'pruefung';

    // Build detail HTML
    let feedbackSection;
    if (existingFeedback) {
        feedbackSection = `
            <div class="feedback-already-submitted">
                <div class="checkmark">✓</div>
                <div class="message">Feedback wurde bereits gesendet</div>
                <div class="submitted-text">${escapeHtml(existingFeedback)}</div>
            </div>
        `;
    } else {
        const helpTextOriginal = 'Hinweis: Du kommentierst den Originaltext, wie er aktuell wahrscheinlich auf Etiketten oder auf der Info-Seite wiedergegeben wird. Das bedeutet, dass dieser Artikel dort auf Basis dieser Auswertung nicht compliant ist und die Texte überarbeitet werden sollten. Dieser Workflow ist nur zum Festhalten von Feedback für die Ansprechperson.';
        const helpTextWebshop = 'Hinweis: Diese Informationen werden an die Textgenerierungs-AI als zusätzliche Anweisung zurückgespielt. Gib möglichst genaue Anweisungen oder zusätzliche Informationen bezüglich der Fehler, die der AI helfen, ein besseres Ergebnis zu generieren.';
        const helpText = currentFeedbackType === 'original' ? helpTextOriginal : helpTextWebshop;

        feedbackSection = `
            <div class="feedback-input-section">
                <label>Dein Feedback:</label>
                <div class="feedback-help-text">${helpText}</div>
                <div class="richtext-toolbar">
                    <button type="button" onclick="formatText('bold')" title="Fett"><b>B</b></button>
                    <button type="button" onclick="formatText('italic')" title="Kursiv"><i>I</i></button>
                    <button type="button" onclick="formatText('underline')" title="Unterstrichen"><u>U</u></button>
                    <span class="toolbar-divider"></span>
                    <button type="button" onclick="formatText('insertUnorderedList')" title="Liste">•</button>
                    <button type="button" onclick="formatText('insertOrderedList')" title="Nummerierte Liste">1.</button>
                </div>
                <div id="feedbackEditor" class="richtext-editor" contenteditable="true" placeholder="Beschreibe das Problem oder stelle eine Frage zum ${currentFeedbackType === 'original' ? 'Originaltext' : 'Webshop-Text'}..."></div>
            </div>
            <div class="feedback-submit-section">
                <span class="reviewer-info">Gesendet von: <strong>${escapeHtml(reviewerName || '-')}</strong></span>
                <button class="feedback-submit-btn" onclick="submitFeedback()">Feedback senden</button>
            </div>
        `;
    }

    detailPanel.innerHTML = `
        <div class="feedback-detail-content">
            <div class="feedback-detail-left">
                <div class="feedback-section-header">
                    <span>${sectionTitle}</span>
                    <span class="product-info">${escapeHtml(fields['Produktnummer'] || '')} - ${escapeHtml(fields['Produkt'] || '')}</span>
                </div>
                <div class="feedback-text-display preview-content">${sanitizeHtml(textContent)}</div>
            </div>
            <div class="feedback-detail-right">
                <div class="feedback-section-header">Compliance-Report</div>
                <div class="feedback-compliance-report">
                    <div class="compliance-status ${statusClass}">${escapeHtml(complianceStatus)}</div>
                    <div class="compliance-findings">${formatComplianceReport(complianceFindings)}</div>
                </div>
                ${feedbackSection}
            </div>
        </div>
    `;
}

function formatText(command) {
    document.execCommand(command, false, null);
    document.getElementById('feedbackEditor').focus();
}

function formatComplianceReport(data) {
    // Try to parse as JSON
    let report;
    try {
        report = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
        // Not JSON, return as escaped text
        return escapeHtml(data);
    }

    if (!report || typeof report !== 'object') {
        return escapeHtml(data);
    }

    let html = '';

    // Summary section
    if (report.summary) {
        html += `<div class="report-summary">${escapeHtml(report.summary)}</div>`;
    }

    if (report.recommendation) {
        html += `<div class="report-recommendation"><strong>Empfehlung:</strong> ${escapeHtml(report.recommendation)}</div>`;
    }

    // Health Claims Check
    if (report.healthClaimsCheck && report.healthClaimsCheck.status !== 'OK') {
        html += `<div class="report-section">
            <div class="report-section-title ${report.healthClaimsCheck.status === 'FEHLER' ? 'error' : 'warning'}">Health Claims: ${report.healthClaimsCheck.status}</div>
            <div class="report-section-content">${escapeHtml(report.healthClaimsCheck.verdict || '')}</div>
        </div>`;
    }

    // Content Fidelity
    if (report.contentFidelity && report.contentFidelity.addedContent && report.contentFidelity.addedContent.length > 0) {
        const criticalAdded = report.contentFidelity.addedContent.filter(c => c.severity === 'kritisch');
        if (criticalAdded.length > 0) {
            html += `<div class="report-section">
                <div class="report-section-title error">Kritische Änderungen</div>
                ${criticalAdded.map(c => `<div class="report-item"><strong>${escapeHtml(c.text)}</strong><br><em>${escapeHtml(c.note || '')}</em></div>`).join('')}
            </div>`;
        }
    }

    // Original Text Compliance Issues
    if (report.originalTextCompliance && report.originalTextCompliance.violations && report.originalTextCompliance.violations.length > 0) {
        html += `<div class="report-section">
            <div class="report-section-title error">Verstöße im Originaltext</div>
            ${report.originalTextCompliance.violations.slice(0, 5).map(v =>
                `<div class="report-item">
                    <span class="violation-type">${escapeHtml(v.type)}</span>
                    <div class="violation-text">"${escapeHtml(v.text)}"</div>
                    <div class="violation-reason">${escapeHtml(v.reason)}</div>
                </div>`
            ).join('')}
        </div>`;
    }

    // Legal Notice Errors
    if (report.legalNotice && report.legalNotice.errors && report.legalNotice.errors.length > 0) {
        html += `<div class="report-section">
            <div class="report-section-title warning">Rechtliche Hinweise</div>
            ${report.legalNotice.errors.map(e => `<div class="report-item">${escapeHtml(e)}</div>`).join('')}
        </div>`;
    }

    // FAQ (first 2)
    if (report.faq && report.faq.length > 0) {
        html += `<div class="report-section">
            <div class="report-section-title">Häufige Fragen</div>
            ${report.faq.slice(0, 2).map(f =>
                `<div class="report-faq">
                    <div class="faq-question">${escapeHtml(f.question)}</div>
                    <div class="faq-answer">${escapeHtml(f.answer)}</div>
                </div>`
            ).join('')}
        </div>`;
    }

    return html || escapeHtml(data);
}

async function submitFeedback() {
    if (!selectedFeedbackRecord) return;

    const editor = document.getElementById('feedbackEditor');
    const feedbackHtml = editor.innerHTML.trim();
    const feedbackText = editor.innerText.trim();

    if (!feedbackText) {
        alert('Bitte gib einen Feedback-Text ein.');
        return;
    }

    const submitBtn = document.querySelector('.feedback-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gesendet...';

    try {
        const feedbackField = currentFeedbackType === 'original' ? 'Feedback Originaltext' : 'Feedback Webshop';
        const statusField = currentFeedbackType === 'original' ? 'Original-Compliance-Status' : 'Status';
        const newStatus = currentFeedbackType === 'original' ? 'Review Original eingereicht' : 'Review Webshop eingereicht';

        // Format feedback with timestamp and reviewer name (Airtable supports rich text/HTML)
        const timestamp = new Date().toLocaleString('de-DE');
        const formattedFeedback = `<p><strong>[${timestamp}] ${escapeHtml(reviewerName)}:</strong></p>${feedbackHtml}`;

        // Update in Airtable
        await updateRecord(selectedFeedbackRecord.id, {
            [feedbackField]: formattedFeedback,
            [statusField]: newStatus
        });

        // Update local data
        selectedFeedbackRecord.fields[feedbackField] = formattedFeedback;
        selectedFeedbackRecord.fields[statusField] = newStatus;

        // Refresh display
        updateFeedbackStats();
        renderFeedbackList();
        selectFeedbackProduct(selectedFeedbackRecord.id);

    } catch (error) {
        alert('Fehler beim Senden: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Feedback senden';
    }
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

async function displayRecord(record) {
    currentRecord = record;
    const fields = record.fields;
    
    document.getElementById('mainApp').style.display = 'block';
    
    // Header
    document.getElementById('productName').textContent = fields['Produkt'] || '-';
    document.getElementById('productSku').textContent = fields['Produktnummer'] || '-';
    
    const ampelBadge = document.getElementById('ampelBadge');
    const ampel = fields['Ampel'] || 'GRÜN';
    ampelBadge.textContent = ampel;
    ampelBadge.className = 'ampel ' + ampel;
    
    // Status Badge (visible in browse mode)
    const statusBadge = document.getElementById('statusBadge');
    const status = fields['Status'] || '';
    if (currentMode === 'browse' && status) {
        statusBadge.textContent = status;
        statusBadge.style.display = 'inline-block';
        // Color based on status
        if (status === 'Live') {
            statusBadge.style.background = '#8b5cf6';
        } else if (status === 'Freigegeben') {
            statusBadge.style.background = '#22c55e';
        } else if (status === 'Überarbeiten') {
            statusBadge.style.background = '#f59e0b';
        } else if (status === 'Zur Prüfung') {
            statusBadge.style.background = '#3b82f6';
        } else if (status === 'interner Review nötig') {
            statusBadge.style.background = '#f97316';
        } else {
            statusBadge.style.background = '#666';
        }
    } else {
        statusBadge.style.display = 'none';
    }
    
    // Old Text - als HTML rendern
    const oldText = fields['Alter Text'] || '';
    document.getElementById('oldTextContent').innerHTML = oldText || '<p style="color:#999;font-style:italic;">Kein alter Text vorhanden</p>';
    document.getElementById('oldTextLength').textContent = oldText.length + ' Zeichen';
    
    // New Text Preview
    let newText = fields['Neuer Text'] || '';
    
    // Check if newText looks like a JSON parsing error was stored
    if (newText.startsWith('FEHLER') || newText.includes('JSON at position')) {
        document.getElementById('previewContent').innerHTML = `
            <div style="background:#fee2e2;border:1px solid #ef4444;border-radius:8px;padding:15px;margin:10px;">
                <strong style="color:#dc2626;">Fehler bei Texterstellung</strong>
                <p style="color:#666;margin-top:8px;font-size:0.9em;">${newText}</p>
                <p style="color:#999;margin-top:8px;font-size:0.85em;">Dieser Datensatz muss erneut durch den Workflow verarbeitet werden.</p>
            </div>
        `;
    } else {
        // Build meta content section
        const metaHtml = renderMetaContent(fields);
        document.getElementById('previewContent').innerHTML = (newText || '<p style="color:#999;text-align:center;">Kein neuer Text</p>') + metaHtml;
    }
    
    // Compliance Protocol
    renderProtocol(fields);
    
    // Load existing comment
    document.getElementById('commentInput').value = fields['Prüfer-Kommentar'] || '';
    
    // Show reviewer name
    document.getElementById('reviewerNameDisplay').textContent = reviewerName || '-';
}

function renderMetaContent(fields) {
    const metaTitle = fields['Meta-Title'] || '';
    const metaDesc = fields['Meta-Description'] || '';
    const keywords = fields['Keywords'] || '';
    const shortDesc = fields['Short-Description'] || '';
    
    if (!metaTitle && !metaDesc && !keywords && !shortDesc) {
        return '';
    }
    
    return `
        <div style="margin-top:30px;padding-top:20px;border-top:2px solid #e0e0e0;">
            <h3 style="color:#333;font-size:1em;margin-bottom:15px;display:flex;align-items:center;gap:8px;">
                <span style="background:#a0ba32;color:white;padding:2px 8px;border-radius:6px;font-size:0.8em;">SEO</span>
                Meta-Inhalte
            </h3>
            
            ${metaTitle ? `
            <div style="margin-bottom:12px;background:#f9f9f9;padding:10px 12px;border-radius:6px;border-left:3px solid #a0ba32;">
                <div style="font-size:0.75em;color:#666;margin-bottom:4px;">Meta-Title <span style="color:${metaTitle.length <= 60 ? '#22c55e' : '#ef4444'};">(${metaTitle.length}/60)</span></div>
                <div style="font-size:0.9em;color:#333;">${metaTitle}</div>
            </div>
            ` : ''}
            
            ${metaDesc ? `
            <div style="margin-bottom:12px;background:#f9f9f9;padding:10px 12px;border-radius:6px;border-left:3px solid #a0ba32;">
                <div style="font-size:0.75em;color:#666;margin-bottom:4px;">Meta-Description <span style="color:${metaDesc.length <= 155 ? '#22c55e' : '#ef4444'};">(${metaDesc.length}/155)</span></div>
                <div style="font-size:0.9em;color:#333;">${metaDesc}</div>
            </div>
            ` : ''}
            
            ${keywords ? `
            <div style="margin-bottom:12px;background:#f9f9f9;padding:10px 12px;border-radius:6px;border-left:3px solid #a0ba32;">
                <div style="font-size:0.75em;color:#666;margin-bottom:4px;">Keywords <span style="color:#666;">(${keywords.split(',').filter(k => k.trim()).length} Stück)</span></div>
                <div style="font-size:0.85em;color:#333;font-family:monospace;">${keywords}</div>
            </div>
            ` : ''}
            
            ${shortDesc ? `
            <div style="margin-bottom:12px;background:#f9f9f9;padding:10px 12px;border-radius:6px;border-left:3px solid #a0ba32;">
                <div style="font-size:0.75em;color:#666;margin-bottom:4px;">Short-Description <span style="color:${shortDesc.length <= 160 ? '#22c55e' : '#ef4444'};">(${shortDesc.length}/160)</span></div>
                <div style="font-size:0.9em;color:#333;">${shortDesc}</div>
            </div>
            ` : ''}
        </div>
    `;
}

function renderProtocol(fields) {
    const container = document.getElementById('protocolContent');
    let protokoll = fields['Compliance-Protokoll'] || '';
    const ampel = fields['Ampel'] || 'GRÜN';
    
    // Try to parse as JSON (might be in various formats from n8n/Anthropic API)
    let protocolData = null;
    try {
        // First attempt - direct parse
        let parsed = JSON.parse(protokoll);
        
        // Check if it's Anthropic API response format: [{"content":[{"type":"text","text":"..."}]}]
        if (Array.isArray(parsed) && parsed[0]?.content?.[0]?.text) {
            // Extract the actual JSON from Anthropic response
            parsed = JSON.parse(parsed[0].content[0].text);
        }
        
        // Check if it's just content array: {"content":[{"type":"text","text":"..."}]}
        if (parsed?.content?.[0]?.text) {
            parsed = JSON.parse(parsed.content[0].text);
        }
        
        // If it's still a string, parse again (double-encoded)
        if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
        }
        
        protocolData = parsed;
    } catch (e) {
        // Not JSON, display as text
        console.log('Protocol parse error:', e);
    }
    
    // Check for different JSON formats
    if (protocolData && typeof protocolData === 'object') {
        // Format 1: Has "ampel" at top level (old format with full structure)
        if (protocolData.ampel && protocolData.efsa) {
            container.innerHTML = renderProtocolJSON(protocolData, fields);
        }
        // Format 2: Has validator structure (inhaltstreue, health_claims, healthClaimsCheck, contentFidelity)
        else if (protocolData.inhaltstreue || protocolData.health_claims || protocolData.healthClaimsCheck || protocolData.contentFidelity) {
            container.innerHTML = renderNewProtocolFormat(protocolData, fields, ampel);
        }
        // Format 3: Has ampel but simpler structure
        else if (protocolData.ampel) {
            container.innerHTML = renderNewProtocolFormat(protocolData, fields, ampel);
        }
        // Unknown JSON format - render as formatted JSON
        else {
            container.innerHTML = renderUnknownJSON(protocolData, fields, ampel);
        }
    } else if (protokoll) {
        container.innerHTML = `<div class="protocol-item">${protokoll.replace(/\n/g, '<br>')}</div>`;
    } else {
        // Generate basic protocol from available data
        container.innerHTML = renderBasicProtocol(fields, ampel);
    }
    
    // Always append Original Compliance Check section from Airtable fields
    container.innerHTML += renderOriginalComplianceCheck(fields);
}

function renderOriginalComplianceCheck(fields) {
    const status = fields['Original-Compliance-Status'] || '';
    const verstoesse = fields['Original-Verstöße'] || '';
    const findings = fields['Original-Compliance-Findings'] || '';
    
    // Skip if no data
    if (!status && !verstoesse && !findings) {
        return '';
    }
    
    const statusColor = status === 'Kritisch' ? '#dc2626' : 
                       status === 'Prüfung empfohlen' ? '#d97706' : '#22c55e';
    const statusBg = status === 'Kritisch' ? '#fef2f2' : 
                    status === 'Prüfung empfohlen' ? '#fffbeb' : '#f0fdf4';
    const statusIcon = status === 'Kritisch' ? '🚨' : 
                      status === 'Prüfung empfohlen' ? '⚠️' : '✅';
    
    let html = `
        <div class="protocol-section" style="background:${statusBg};border:2px solid ${statusColor};border-radius:8px;margin-top:20px;padding:15px;">
            <div class="protocol-section-title" style="color:${statusColor};font-size:1.1em;margin-bottom:12px;">
                ${statusIcon} Original Compliance Check
            </div>
            <div style="font-size:0.85em;color:#666;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid ${statusColor}33;">
                Compliance-Prüfung des <strong>Originaltexts</strong> (nicht der Umformatierung)
            </div>
    `;
    
    // Status
    if (status) {
        html += `
            <div style="margin-bottom:10px;">
                <div style="font-weight:600;color:#374151;margin-bottom:4px;">Status</div>
                <div style="display:inline-block;padding:4px 12px;border-radius:4px;background:${statusColor};color:white;font-weight:500;">
                    ${status}
                </div>
            </div>
        `;
    }
    
    // Original-Verstöße (Kategorien)
    if (verstoesse) {
        html += `
            <div style="margin-bottom:10px;">
                <div style="font-weight:600;color:#374151;margin-bottom:4px;">Verstoß-Kategorien</div>
                <div style="color:#666;font-size:0.95em;">
                    ${verstoesse.split(',').map(v => `<span style="display:inline-block;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:3px;margin:2px 4px 2px 0;font-size:0.85em;">${v.trim()}</span>`).join('')}
                </div>
            </div>
        `;
    }
    
    // Findings (ausführlicher Report)
    if (findings) {
        html += `
            <div style="margin-bottom:5px;">
                <div style="font-weight:600;color:#374151;margin-bottom:4px;">Detaillierte Findings</div>
                <div style="background:white;border:1px solid #e5e7eb;border-radius:6px;padding:12px;font-size:0.9em;color:#4b5563;white-space:pre-line;line-height:1.5;">
                    ${findings}
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    
    return html;
}

function renderNewProtocolFormat(data, fields, ampel) {
    let html = '';
    
    // Review Metadata (show in browse mode or when reviewed)
    if (fields['Geprüft von'] || fields['Geprüft am']) {
        html += `
            <div class="protocol-section" style="background:#e8f4ea;border-radius:8px;padding:12px;margin-bottom:15px;">
                <div style="display:flex;gap:20px;font-size:0.9em;">
                    ${fields['Geprüft von'] ? `<span>👤 <strong>${fields['Geprüft von']}</strong></span>` : ''}
                    ${fields['Geprüft am'] ? `<span>📅 ${new Date(fields['Geprüft am']).toLocaleString('de-DE')}</span>` : ''}
                    ${fields['Status'] ? `<span>📋 ${fields['Status']}</span>` : ''}
                </div>
                ${fields['Prüfer-Kommentar'] ? `<div style="margin-top:8px;font-style:italic;color:#666;">"${fields['Prüfer-Kommentar']}"</div>` : ''}
            </div>
        `;
    }
    
    // Status Summary
    html += `
        <div class="protocol-section">
            <div class="protocol-section-title">
                <span class="status-icon">${ampel === 'GRÜN' ? '✅' : ampel === 'GELB' ? '⚠️' : '❌'}</span>
                Validierungsergebnis: ${ampel}
            </div>
            ${data.summary ? `<div class="protocol-item">${data.summary}</div>` : ''}
        </div>
    `;
    
    // Inhaltstreue / Content Fidelity (support both formats)
    const contentData = data.inhaltstreue || data.contentFidelity;
    if (contentData) {
        const statusIcon = contentData.status === 'OK' ? '✅' : contentData.status === 'WARNUNG' ? '⚠️' : '❌';
        const problems = contentData.probleme || [];
        const added = contentData.addedContent || [];
        const removed = contentData.removedContent || [];
        const checked = contentData.checkedElements || [];
        
        html += `
            <div class="protocol-section">
                <div class="protocol-section-title">${statusIcon} Inhaltstreue</div>
                ${checked.length > 0 ? `
                    <div class="protocol-item" style="font-size:0.9em;color:#666;">
                        ${checked.map(c => `<div>✓ ${c}</div>`).join('')}
                    </div>
                ` : ''}
                ${problems.length > 0 ? `
                    <div class="protocol-item ${contentData.status === 'FEHLER' ? 'error' : 'warning'}">
                        ${problems.map(p => `<div style="margin-bottom:8px;">• ${p}</div>`).join('')}
                    </div>
                ` : ''}
                ${added.length > 0 ? `
                    <div class="protocol-item warning">
                        <div style="font-weight:bold;margin-bottom:6px;">⚠️ Hinzugefügt:</div>
                        ${added.map(a => `<div style="margin-left:12px;">• ${typeof a === 'string' ? a : a.text} ${a.note ? `<span style="color:#666;font-size:0.9em;">(${a.note})</span>` : ''}</div>`).join('')}
                    </div>
                ` : ''}
                ${removed.length > 0 ? `
                    <div class="protocol-item warning">
                        <div style="font-weight:bold;margin-bottom:6px;">⚠️ Weggelassen:</div>
                        ${removed.map(r => `<div style="margin-left:12px;">• ${typeof r === 'string' ? r : r.text} ${r.note ? `<span style="color:#666;font-size:0.9em;">(${r.note})</span>` : ''}</div>`).join('')}
                    </div>
                ` : ''}
                ${problems.length === 0 && added.length === 0 && removed.length === 0 ? '<div class="protocol-item success">Keine Probleme gefunden</div>' : ''}
            </div>
        `;
    }
    
    // Health Claims (support both formats)
    const hcData = data.health_claims || data.healthClaimsCheck;
    if (hcData) {
        const origCount = hcData.original_anzahl ?? hcData.claimsInOriginalCount ?? 0;
        const newCount = hcData.neuer_text_anzahl ?? hcData.claimsInNewCount ?? 0;
        const addedCount = hcData.claimsAddedCount ?? (newCount > origCount ? newCount - origCount : 0);
        const origClaims = hcData.original_claims || hcData.claimsInOriginal || [];
        const newClaims = hcData.neue_claims || hcData.claimsInNewText || [];
        const verdict = hcData.anmerkung || hcData.verdict || '';
        
        const statusIcon = addedCount > 0 ? '❌' : hcData.status === 'OK' ? '✅' : '⚠️';
        
        html += `
            <div class="protocol-section">
                <div class="protocol-section-title">${statusIcon} Health Claims</div>
                <div class="protocol-item ${addedCount > 0 ? 'error' : ''}">
                    <div><strong>Original:</strong> ${origCount} Claims</div>
                    <div><strong>Neuer Text:</strong> ${newCount} Claims</div>
                    ${addedCount > 0 ? `<div style="color:#dc2626;font-weight:bold;margin-top:8px;">⚠️ ${addedCount} Claim(s) hinzugefügt - VERSTOSS!</div>` : ''}
                    ${verdict ? `<div style="margin-top:8px;color:#666;font-style:italic;">${verdict}</div>` : ''}
                </div>
                ${origClaims.length > 0 ? `
                    <div class="protocol-item" style="margin-top:8px;">
                        <div style="font-weight:bold;margin-bottom:6px;">Claims im Original:</div>
                        ${origClaims.map(c => `<div style="margin-left:12px;font-size:0.9em;">• ${c}</div>`).join('')}
                    </div>
                ` : ''}
                ${newClaims.length > 0 ? `
                    <div class="protocol-item" style="margin-top:8px;">
                        <div style="font-weight:bold;margin-bottom:6px;">Claims im neuen Text:</div>
                        ${newClaims.map(c => `<div style="margin-left:12px;font-size:0.9em;">• ${c}</div>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // Tabellen-Check (support both formats)
    const tcData = data.tableCheck || data.tabellen_check;
    if (tcData) {
        const statusIcon = tcData.status === 'OK' ? '✅' : '❌';
        html += `
            <div class="protocol-section">
                <div class="protocol-section-title">${statusIcon} Tabellen-Check</div>
                <div class="protocol-item">
                    ${tcData.originalRowCount !== undefined ? `<div>Original: ${tcData.originalRowCount} Zeilen</div>` : ''}
                    ${tcData.newRowCount !== undefined ? `<div>Neu: ${tcData.newRowCount} Zeilen</div>` : ''}
                    ${tcData.missingRows && tcData.missingRows.length > 0 ? 
                        `<div class="error" style="margin-top:8px;">Fehlend: ${tcData.missingRows.join(', ')}</div>` : ''}
                    ${tcData.fehler ? `<div class="error">${tcData.fehler}</div>` : ''}
                    ${tcData.verdict ? `<div style="margin-top:8px;">${tcData.verdict}</div>` : ''}
                    ${!tcData.fehler && (!tcData.missingRows || tcData.missingRows.length === 0) ? '<div class="success">Tabelle korrekt übernommen</div>' : ''}
                </div>
            </div>
        `;
    }
    
    // Warnhinweise (support both formats)
    const whData = data.warnhinweise || data.warningsCheck;
    if (whData) {
        const missing = whData.fehlend || whData.missing || [];
        const statusIcon = missing.length > 0 ? '❌' : '✅';
        html += `
            <div class="protocol-section">
                <div class="protocol-section-title">${statusIcon} Warnhinweise</div>
                <div class="protocol-item">
                    ${whData.foundInOriginal && whData.foundInOriginal.length > 0 ? 
                        `<div style="margin-bottom:8px;"><strong>Im Original:</strong> ${whData.foundInOriginal.join(', ')}</div>` : ''}
                    ${whData.foundInNew && whData.foundInNew.length > 0 ? 
                        `<div style="margin-bottom:8px;"><strong>Im neuen Text:</strong> ${whData.foundInNew.join(', ')}</div>` : ''}
                    ${missing.length > 0 ? 
                        `<div class="error">Fehlend: ${missing.join(', ')}</div>` : 
                        '<div class="success">Alle Warnhinweise vorhanden</div>'}
                </div>
            </div>
        `;
    }
    
    // Original-Compliance (Compliance-Probleme im Originaltext)
    const ocData = data.originalTextCompliance;
    if (ocData && (ocData.status !== 'OK' || ocData.hasViolations)) {
        const statusColor = ocData.status === 'KRITISCH' ? '#dc2626' : 
                           ocData.status === 'PRÜFUNG_EMPFOHLEN' ? '#d97706' : '#666';
        const statusBg = ocData.status === 'KRITISCH' ? '#fef2f2' : 
                        ocData.status === 'PRÜFUNG_EMPFOHLEN' ? '#fffbeb' : '#f9fafb';
        const statusIcon = ocData.status === 'KRITISCH' ? '🚨' : 
                          ocData.status === 'PRÜFUNG_EMPFOHLEN' ? '⚠️' : 'ℹ️';
        
        html += `
            <div class="protocol-section" style="background:${statusBg};border:2px solid ${statusColor};border-radius:8px;margin-top:15px;">
                <div class="protocol-section-title" style="color:${statusColor};">
                    ${statusIcon} Original-Compliance: ${ocData.status === 'KRITISCH' ? 'Kritisch' : 
                                                        ocData.status === 'PRÜFUNG_EMPFOHLEN' ? 'Prüfung empfohlen' : 'OK'}
                </div>
                <div style="font-size:0.85em;color:#666;margin-bottom:10px;">
                    Hinweis: Dies betrifft den <strong>Originaltext</strong>, nicht die Umformatierung.
                </div>
                ${ocData.shortReport ? `
                    <div class="protocol-item" style="white-space:pre-line;font-size:0.9em;">
                        ${ocData.shortReport}
                    </div>
                ` : ''}
                ${ocData.botanicalsWithClaims && ocData.botanicalsWithClaims.length > 0 ? `
                    <div class="protocol-item" style="margin-top:10px;">
                        <div style="font-weight:bold;color:${statusColor};margin-bottom:6px;">🌿 Botanicals mit Wirkaussagen:</div>
                        ${ocData.botanicalsWithClaims.map(b => `
                            <div style="margin-left:12px;margin-bottom:8px;padding:8px;background:white;border-radius:4px;">
                                <strong>${b.botanical}:</strong> "${b.claim}"
                                ${b.fullQuote ? `<div style="font-size:0.85em;color:#666;margin-top:4px;">→ "${b.fullQuote}"</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${ocData.violations && ocData.violations.length > 0 ? `
                    <div class="protocol-item" style="margin-top:10px;">
                        <div style="font-weight:bold;margin-bottom:6px;">Weitere Findings:</div>
                        ${ocData.violations.slice(0, 5).map(v => `
                            <div style="margin-left:12px;margin-bottom:6px;">
                                <span style="color:${v.severity === 'schwer' ? '#dc2626' : v.severity === 'mittel' ? '#d97706' : '#666'};">
                                    [${v.severity}]
                                </span>
                                ${v.type}: "${v.text}"
                            </div>
                        `).join('')}
                        ${ocData.violations.length > 5 ? `<div style="color:#666;font-size:0.85em;">... und ${ocData.violations.length - 5} weitere</div>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    return html;
}

function renderUnknownJSON(data, fields, ampel) {
    let html = '';
    
    // Review Metadata
    if (fields['Geprüft von'] || fields['Geprüft am']) {
        html += `
            <div class="protocol-section" style="background:#e8f4ea;border-radius:8px;padding:12px;margin-bottom:15px;">
                <div style="display:flex;gap:20px;font-size:0.9em;">
                    ${fields['Geprüft von'] ? `<span>👤 <strong>${fields['Geprüft von']}</strong></span>` : ''}
                    ${fields['Geprüft am'] ? `<span>📅 ${new Date(fields['Geprüft am']).toLocaleString('de-DE')}</span>` : ''}
                    ${fields['Status'] ? `<span>📋 ${fields['Status']}</span>` : ''}
                </div>
                ${fields['Prüfer-Kommentar'] ? `<div style="margin-top:8px;font-style:italic;color:#666;">"${fields['Prüfer-Kommentar']}"</div>` : ''}
            </div>
        `;
    }
    
    // Status
    html += `
        <div class="protocol-section">
            <div class="protocol-section-title">
                <span class="status-icon">${ampel === 'GRÜN' ? '✅' : ampel === 'GELB' ? '⚠️' : '❌'}</span>
                Validierungsergebnis: ${ampel}
            </div>
        </div>
    `;
    
    // Check for minimal/legacy format and show helpful message
    const dataKeys = Object.keys(data);
    const isMinimalFormat = dataKeys.length <= 3 && (data.valid !== undefined || data.ampel !== undefined);
    
    if (isMinimalFormat) {
        html += `
            <div class="protocol-section" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px;margin:15px 0;">
                <div style="color:#92400e;font-weight:bold;margin-bottom:8px;">⚠️ Minimales Protokoll-Format</div>
                <div style="color:#78716c;font-size:0.9em;">
                    Dieser Datensatz wurde mit einer älteren Workflow-Version erstellt.<br>
                    Für detaillierte Compliance-Prüfung den Workflow erneut ausführen.
                </div>
            </div>
        `;
    }
    
    // Render each key in the JSON with better formatting
    for (const [key, value] of Object.entries(data)) {
        // Skip internal/technical keys
        if (key === 'valid' && isMinimalFormat) continue;
        
        const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        
        if (typeof value === 'object' && value !== null) {
            html += `
                <div class="protocol-section">
                    <div class="protocol-section-title">${displayKey}</div>
                    <div class="protocol-item" style="font-family:monospace;font-size:0.85em;white-space:pre-wrap;background:#f8f8f8;padding:10px;border-radius:4px;">${JSON.stringify(value, null, 2)}</div>
                </div>
            `;
        } else if (typeof value === 'boolean') {
            html += `
                <div class="protocol-section">
                    <div class="protocol-section-title">${value ? '✅' : '❌'} ${displayKey}</div>
                </div>
            `;
        } else if (value !== null && value !== undefined && value !== '') {
            html += `
                <div class="protocol-section">
                    <div class="protocol-section-title">${displayKey}</div>
                    <div class="protocol-item">${value}</div>
                </div>
            `;
        }
    }
    
    return html;
}

function renderProtocolJSON(data, fields) {
    let html = '';
    
    // Review Metadata (show in browse mode or when reviewed)
    if (fields['Geprüft von'] || fields['Geprüft am']) {
        html += `
            <div class="protocol-section" style="background:#e8f4ea;border-radius:8px;padding:12px;margin-bottom:15px;">
                <div style="display:flex;gap:20px;font-size:0.9em;">
                    ${fields['Geprüft von'] ? `<span>👤 <strong>${fields['Geprüft von']}</strong></span>` : ''}
                    ${fields['Geprüft am'] ? `<span>📅 ${new Date(fields['Geprüft am']).toLocaleString('de-DE')}</span>` : ''}
                    ${fields['Status'] ? `<span>📋 ${fields['Status']}</span>` : ''}
                </div>
                ${fields['Prüfer-Kommentar'] ? `<div style="margin-top:8px;font-style:italic;color:#666;">"${fields['Prüfer-Kommentar']}"</div>` : ''}
            </div>
        `;
    }
    
    // Summary
    html += `
        <div class="protocol-section">
            <div class="protocol-section-title">
                <span class="status-icon">${data.ampel === 'GRÜN' ? '✅' : data.ampel === 'GELB' ? '⚠️' : '❌'}</span>
                Zusammenfassung
            </div>
            <div class="protocol-item ${data.ampel === 'GRÜN' ? 'success' : data.ampel === 'GELB' ? 'warning' : 'error'}">
                <strong>${data.recommendation || 'Keine Empfehlung'}</strong><br>
                ${data.summary || ''}
            </div>
        </div>
    `;
    
    // EFSA Claims
    if (data.efsa && data.efsa.claimsUsed) {
        html += `
            <div class="protocol-section">
                <div class="protocol-section-title">
                    <span class="status-icon">${data.efsa.status === 'OK' ? '✅' : '⚠️'}</span>
                    EFSA-Claims
                </div>
                <div class="claim-list">
                    ${data.efsa.claimsUsed.map(c => `
                        <div class="claim-item">
                            <span class="claim-status">${c.valid ? '✓' : '✗'}</span>
                            <span><strong>${c.ingredient}:</strong> ${c.claim}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // SEO
    if (data.seo) {
        html += `
            <div class="protocol-section">
                <div class="protocol-section-title">SEO-Check</div>
                <div class="seo-grid">
                    <div class="seo-item">
                        <span class="label">Meta-Title</span>
                        <span class="value ${data.seo.metaTitleOk ? 'ok' : 'warning'}">${data.seo.metaTitleLength || '?'}/60</span>
                    </div>
                    <div class="seo-item">
                        <span class="label">Meta-Desc</span>
                        <span class="value ${data.seo.metaDescOk ? 'ok' : 'warning'}">${data.seo.metaDescLength || '?'}/155</span>
                    </div>
                    <div class="seo-item">
                        <span class="label">Keywords</span>
                        <span class="value ${data.seo.keywordsOk ? 'ok' : 'warning'}">${data.seo.keywordCount || '?'} Stück</span>
                    </div>
                    <div class="seo-item">
                        <span class="label">Short-Desc</span>
                        <span class="value ${data.seo.shortDescOk ? 'ok' : 'warning'}">${data.seo.shortDescLength || '?'}/160</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // FAQs
    if (data.faq && data.faq.length > 0) {
        html += `
            <div class="protocol-section">
                <div class="protocol-section-title">Häufige Einwände</div>
                ${data.faq.map(f => `
                    <div class="faq-item">
                        <div class="faq-question">❓ ${f.question}</div>
                        <div class="faq-answer">${f.answer}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    return html;
}

function renderBasicProtocol(fields, ampel) {
    let html = '';
    
    // Review Metadata (show in browse mode or when reviewed)
    if (fields['Geprüft von'] || fields['Geprüft am']) {
        html += `
            <div class="protocol-section" style="background:#e8f4ea;border-radius:8px;padding:12px;margin-bottom:15px;">
                <div style="display:flex;gap:20px;font-size:0.9em;">
                    ${fields['Geprüft von'] ? `<span>👤 <strong>${fields['Geprüft von']}</strong></span>` : ''}
                    ${fields['Geprüft am'] ? `<span>📅 ${new Date(fields['Geprüft am']).toLocaleString('de-DE')}</span>` : ''}
                    ${fields['Status'] ? `<span>📋 ${fields['Status']}</span>` : ''}
                </div>
                ${fields['Prüfer-Kommentar'] ? `<div style="margin-top:8px;font-style:italic;color:#666;">"${fields['Prüfer-Kommentar']}"</div>` : ''}
            </div>
        `;
    }
    
    html += `
        <div class="protocol-section">
            <div class="protocol-section-title">
                <span class="status-icon">${ampel === 'GRÜN' ? '✅' : ampel === 'GELB' ? '⚠️' : '❌'}</span>
                Status: ${ampel}
            </div>
            <div class="protocol-item">
                Kein detailliertes Compliance-Protokoll vorhanden.
            </div>
        </div>
    `;
    
    return html;
}

// ============================================
// ACTIONS
// ============================================

async function setStatus(status) {
    if (!currentRecord) return;
    
    // Prevent actions in browse mode
    if (currentMode === 'browse') {
        showToast('Im Browse-Modus sind keine Änderungen möglich', 'error');
        return;
    }
    
    const comment = document.getElementById('commentInput').value.trim();
    
    if (!reviewerName) {
        showToast('Kein Prüfer-Name gespeichert!', 'error');
        return;
    }
    
    const buttons = document.querySelectorAll('.action-btn');
    buttons.forEach(btn => btn.disabled = true);
    
    try {
        const updateFields = {
            'Status': status,
            'Prüfer-Kommentar': comment,
            'Geprüft von': reviewerName,
            'Geprüft am': new Date().toISOString()
        };
        
        await updateRecord(currentRecord.id, updateFields);
        
        showToast(`Status auf "${status}" gesetzt!`, 'success');
        
        // Remove from queue and go to next
        recordQueue.splice(currentQueueIndex, 1);
        
        if (recordQueue.length === 0) {
            showAllDone();
            return;
        } else {
            if (currentQueueIndex >= recordQueue.length) {
                currentQueueIndex = recordQueue.length - 1;
            }
            await displayRecord(recordQueue[currentQueueIndex]);
            updateQueueNavigation();
        }
        
    } catch (error) {
        showToast('Fehler: ' + error.message, 'error');
    } finally {
        buttons.forEach(btn => btn.disabled = false);
    }
}

// ============================================
// NAVIGATION
// ============================================

function updateQueueNavigation() {
    document.getElementById('currentIndex').textContent = currentQueueIndex + 1;
    document.getElementById('totalCount').textContent = recordQueue.length;
    document.getElementById('prevBtn').disabled = currentQueueIndex === 0;
    document.getElementById('nextBtn').disabled = currentQueueIndex >= recordQueue.length - 1;
}

async function navigatePrev() {
    if (currentQueueIndex > 0) {
        currentQueueIndex--;
        await displayRecord(recordQueue[currentQueueIndex]);
        updateQueueNavigation();
    }
}

async function navigateNext() {
    if (currentQueueIndex < recordQueue.length - 1) {
        currentQueueIndex++;
        await displayRecord(recordQueue[currentQueueIndex]);
        updateQueueNavigation();
    }
}

// ============================================
// UI HELPERS
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeHtml(html) {
    if (!html) return '';
    // Allow safe HTML tags, remove dangerous ones
    const div = document.createElement('div');
    div.innerHTML = html;

    // Remove script tags and event handlers
    div.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
    div.querySelectorAll('*').forEach(el => {
        // Remove all event handlers
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return div.innerHTML;
}

function setDevice(device, btn) {
    document.getElementById('previewFrame').className = 'preview-frame ' + device;
    document.querySelectorAll('.device-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showError(message) {
    document.getElementById('mainApp').innerHTML = `
        <div class="error-state">
            <h2>⚠️ Fehler</h2>
            <p>${escapeHtml(message)}</p>
            <button onclick="window.location.reload()" style="margin-top:20px;padding:10px 20px;cursor:pointer;">
                Neu laden
            </button>
        </div>
    `;
    document.getElementById('mainApp').style.display = 'block';
}

function showAllDone() {
    const isReviewMode = currentMode === 'review';
    const title = isReviewMode ? 'Keine Produkte zur Prüfung vorhanden.' : 'Keine Datensätze gefunden.';
    const buttonText = isReviewMode ? '🔄 Auf neue Produkte prüfen' : '🔄 Aktualisieren';
    const switchModeText = isReviewMode ? 'Alle ansehen' : 'Zur Prüfung';
    const switchModeUrl = isReviewMode ? '?mode=browse' : '?mode=review';
    
    document.getElementById('mainApp').innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);color:#fff;text-align:center;padding:40px;">
            <img src="https://energiavital.de/media/51/95/d5/1751886601/ev_logo_du.png?ts=1761581030" alt="energiavital" style="height:50px;margin-bottom:8px;filter:brightness(0) invert(1);">
            <div style="font-size:0.7em;font-weight:600;color:#a0ba32;letter-spacing:0.5px;margin-bottom:30px;text-transform:uppercase;">Compliance Reviewer</div>
            <p style="font-size:1.3em;color:#888;margin-bottom:30px;">${title}</p>
            <div style="display:flex;gap:15px;margin-bottom:30px;flex-wrap:wrap;justify-content:center;">
                <button onclick="window.location.reload()" style="background:#a0ba32;color:#fff;border:none;padding:14px 28px;border-radius:8px;font-size:16px;cursor:pointer;transition:all 0.2s;">
                    ${buttonText}
                </button>
                <button onclick="window.location.href='${switchModeUrl}'" style="background:#3b82f6;color:#fff;border:none;padding:14px 28px;border-radius:8px;font-size:16px;cursor:pointer;transition:all 0.2s;">
                    ${switchModeText}
                </button>
                <button onclick="window.location.href='?mode=overview'" style="background:#6b7280;color:#fff;border:none;padding:14px 28px;border-radius:8px;font-size:16px;cursor:pointer;transition:all 0.2s;">
                    Übersicht
                </button>
            </div>
            <div style="display:flex;gap:15px;margin-top:20px;">
                <a href="https://airtable.com/appwfr6TDvdfTpLOb/tblxh8JKmGzkNe2aN" target="_blank" style="color:#a0ba32;text-decoration:none;">📊 Airtable öffnen</a>
                <span style="color:#a0ba32;cursor:pointer;" onclick="showHelp()">❓ Hilfe</span>
                <span style="color:#a0ba32;cursor:pointer;" onclick="showCriteria()">📋 Prüfkriterien</span>
            </div>
        </div>
    `;
    document.getElementById('mainApp').style.display = 'block';
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// MODALS
// ============================================

function showHelp() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>❓ Bedienungsanleitung</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-content">
                <h3>Überblick</h3>
                <p>Das Review-Tool zeigt AI-generierte Produkttexte zur Prüfung an. Sie sehen drei Spalten:</p>
                <ul>
                    <li><strong>Alter Text</strong> – Der aktuelle Text in Shopware</li>
                    <li><strong>Neuer Text</strong> – Der AI-generierte Vorschlag (Live-Preview)</li>
                    <li><strong>Compliance-Protokoll</strong> – Automatische Prüfergebnisse</li>
                </ul>
                
                <h3>Ampel-System</h3>
                <div class="ampel-box gruen"><strong>🟢 GRÜN</strong> – Keine Probleme erkannt, zur Freigabe empfohlen</div>
                <div class="ampel-box gelb"><strong>🟡 GELB</strong> – Kleine Hinweise (z.B. SEO), aber compliant</div>
                <div class="ampel-box rot"><strong>🔴 ROT</strong> – Compliance-Problem erkannt, bitte genau prüfen</div>
                
                <h3>Aktionen</h3>
                <ul>
                    <li><strong>✓ Freigeben</strong> – Text wird für Shopware-Deployment freigegeben</li>
                    <li><strong>↻ Überarbeiten</strong> – Text braucht Änderungen (Kommentar angeben!)</li>
                </ul>
                
                <h3>Device-Preview</h3>
                <p>Mit den Buttons <code>Desktop</code> / <code>Tablet</code> / <code>Mobile</code> können Sie die Darstellung auf verschiedenen Geräten simulieren.</p>
                
                <h3>Navigation</h3>
                <ul>
                    <li><strong>← Zurück / Weiter →</strong> – Zwischen Produkten wechseln</li>
                    <li><strong>X von Y</strong> – Zeigt Position in der Warteschlange</li>
                </ul>
                
                <h3>Bei Problemen</h3>
                <p>Falls etwas nicht funktioniert, öffnen Sie die <a href="https://airtable.com/appwfr6TDvdfTpLOb/tblxh8JKmGzkNe2aN" target="_blank" style="color:#a0ba32;">Airtable-Tabelle</a> direkt und prüfen/bearbeiten Sie den Datensatz dort.</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function showCriteria() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>📋 Prüfkriterien der Validation-AI</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-content">
                <h3>1. Compliance-Prüfung (wichtigster Teil)</h3>
                
                <p><strong>✅ ERLAUBT:</strong></p>
                <ul>
                    <li>EFSA-zugelassene Health Claims (exakter oder angepasster Wortlaut)</li>
                    <li>Emotionale Sprache: "Ihr Begleiter für mehr Energie"</li>
                    <li>Zielgruppen: "Perfekt für aktive Menschen"</li>
                    <li>Superlative: "hochdosiert", "premium", "umfassend"</li>
                    <li>Traditionelle Hinweise: "seit Jahrhunderten geschätzt"</li>
                    <li>Sachliche Angaben: "vegan", "Made in Germany", "500 mg"</li>
                </ul>
                
                <p><strong>❌ VERBOTEN (führt zu 🔴 ROT):</strong></p>
                <ul>
                    <li>Krankheitsnamen: "bei Arthrose", "gegen Diabetes", "hilft bei Depression"</li>
                    <li>Heilversprechen: "heilt", "behandelt", "lindert [Krankheit]"</li>
                    <li>Medikamenten-Vergleiche: "wirkt wie Aspirin"</li>
                    <li>Nicht-zugelassene Health Claims</li>
                </ul>
                
                <h3>2. SEO-Prüfung</h3>
                <ul>
                    <li><strong>Meta-Title:</strong> max. 60 Zeichen</li>
                    <li><strong>Meta-Description:</strong> max. 155 Zeichen</li>
                    <li><strong>Keywords:</strong> 5-8 Stück empfohlen</li>
                    <li><strong>Short-Description:</strong> max. 160 Zeichen</li>
                </ul>
                <p>SEO-Verstöße führen nur zu 🟡 GELB, nicht zu ROT.</p>
                
                <h3>3. Template-Prüfung</h3>
                <p>Geprüft wird, ob alle Elemente vorhanden sind:</p>
                <ul>
                    <li>H2-Teaser, 3 Badges</li>
                    <li>Produktbeschreibung (emotional)</li>
                    <li>Wirkung-Box (falls Claims vorhanden)</li>
                    <li>Ideal-für-Box, Qualitäts-Box</li>
                    <li>Das-ist-drin-Box mit Tabelle</li>
                    <li>Einnahme-Box, Accordion</li>
                </ul>
                
                <h3>4. Häufige Einwände (FAQ)</h3>
                <p>Die AI generiert produktspezifische Antworten auf typische Fragen, z.B.:</p>
                <ul>
                    <li>"Warum steht da 'trägt bei' statt direktere Formulierungen?"</li>
                    <li>"Ist 'hochdosiert' rechtlich problematisch?"</li>
                    <li>"Warum gibt es keine EFSA-Claims für [Stoff]?"</li>
                </ul>
                
                <h3>Entscheidungshilfe</h3>
                <div class="ampel-box gruen"><strong>🟢 GRÜN</strong> → In der Regel freigeben</div>
                <div class="ampel-box gelb"><strong>🟡 GELB</strong> → Kurz prüfen, meist freigeben</div>
                <div class="ampel-box rot"><strong>🔴 ROT</strong> → Genau hinschauen, Compliance-Protokoll lesen</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ============================================
// START
// ============================================

init();
