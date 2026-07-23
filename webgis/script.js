/* ============================================
   WEBGIS DASHBOARD - SCRIPT.JS
   UAS Maha Data & Kapita Selekta
   Kelompok 7 - Universitas Bakrie
   ============================================ */

// ===== Global State =====
const APP = {
    map: null,
    layers: {},
    geoJsonLayers: {},
    stats: null,
    charts: {},
    isDark: false,
    defaultCenter: [1.48, 124.84],
    defaultZoom: 12,
    layerColors: {
        veg2024: '#66bb6a',
        veg2025: '#2e7d32',
        gain: '#1565c0',
        loss: '#c62828',
        batas: '#1a237e'
    }
};

// ===== Loading Screen =====
function initLoading() {
    const fill = document.getElementById('loadingBarFill');
    const percent = document.getElementById('loadingPercent');
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => {
                document.getElementById('loadingScreen').classList.add('hidden');
                document.getElementById('appWrapper').classList.add('visible');
                if (APP.map) {
                    setTimeout(() => APP.map.invalidateSize(), 100);
                }
                setTimeout(() => {
                    const welcomeModal = new bootstrap.Modal(document.getElementById('welcomeModal'));
                    welcomeModal.show();
                    initFadeInObserver();
                    showToast('Selamat datang di WebGIS Dashboard!', 'success', 'fas fa-check-circle');
                }, 500);
            }, 600);
        }
        fill.style.width = progress + '%';
        percent.textContent = Math.round(progress) + '%';
    }, 200);
}

// ===== Toast Notification =====
function showToast(message, type = 'info', icon = 'fas fa-info-circle') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ===== Theme Toggle =====
function initTheme() {
    const toggle = document.getElementById('themeToggle');
    const saved = localStorage.getItem('webgis-theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        APP.isDark = true;
        toggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
    toggle.addEventListener('click', () => {
        APP.isDark = !APP.isDark;
        document.documentElement.setAttribute('data-theme', APP.isDark ? 'dark' : '');
        toggle.innerHTML = APP.isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('webgis-theme', APP.isDark ? 'dark' : 'light');
        showToast(APP.isDark ? 'Dark mode diaktifkan' : 'Light mode diaktifkan', 'info', 'fas fa-palette');
        updateChartsTheme();
    });
}

// ===== Tab Navigation =====
function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const panels = document.querySelectorAll('.tab-content-panel');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            panels.forEach(p => {
                p.classList.remove('active');
                if (p.id === 'panel' + target.charAt(0).toUpperCase() + target.slice(1)) {
                    p.classList.add('active');
                }
            });
            // Refresh map when switching to map tab
            if (target === 'peta' && APP.map) {
                setTimeout(() => APP.map.invalidateSize(), 100);
            }
            // Animate timeline items
            if (target === 'data') {
                animateTimeline();
            }
            // Animate metrics
            if (target === 'evaluasi') {
                animateMetrics();
            }
            // Re-trigger fade-in
            initFadeInObserver();
        });
    });
}

// ===== Sidebar Toggle =====
function initSidebars() {
    const leftSidebar = document.getElementById('leftSidebar');
    const rightSidebar = document.getElementById('rightSidebar');

    document.getElementById('leftSidebarToggle').addEventListener('click', () => {
        leftSidebar.classList.toggle('collapsed');
        setTimeout(() => { if (APP.map) APP.map.invalidateSize(); }, 350);
    });
    document.getElementById('leftSidebarClose').addEventListener('click', () => {
        leftSidebar.classList.add('collapsed');
        setTimeout(() => { if (APP.map) APP.map.invalidateSize(); }, 350);
    });
    document.getElementById('rightSidebarToggle').addEventListener('click', () => {
        rightSidebar.classList.toggle('collapsed');
        setTimeout(() => { if (APP.map) APP.map.invalidateSize(); }, 350);
    });
    document.getElementById('rightSidebarClose').addEventListener('click', () => {
        rightSidebar.classList.add('collapsed');
        setTimeout(() => { if (APP.map) APP.map.invalidateSize(); }, 350);
    });
}

// ===== Initialize Map =====
function initMap() {
    APP.map = L.map('map', {
        center: APP.defaultCenter,
        zoom: APP.defaultZoom,
        zoomControl: false,
        attributionControl: true
    });

    // Basemap
    APP.layers.basemap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(APP.map);

    // Zoom Control (top right)
    L.control.zoom({ position: 'topright' }).addTo(APP.map);

    // Scale Bar
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(APP.map);

    // Fullscreen Control
    L.control.fullscreen({ position: 'topright' }).addTo(APP.map);

    // MiniMap
    const miniMapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    new L.Control.MiniMap(miniMapLayer, { position: 'bottomright', toggleDisplay: true, minimized: false, width: 120, height: 90 }).addTo(APP.map);

    // Compass Control (custom)
    const CompassControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function () {
            const div = L.DomUtil.create('div', 'leaflet-compass');
            div.innerHTML = '<i class="fas fa-compass"></i>';
            div.title = 'North';
            div.style.cursor = 'pointer';
            L.DomEvent.disableClickPropagation(div);
            div.addEventListener('click', () => {
                APP.map.setView(APP.defaultCenter, APP.defaultZoom);
            });
            return div;
        }
    });
    APP.map.addControl(new CompassControl());

    // Mouse Coordinate
    APP.map.on('mousemove', (e) => {
        document.getElementById('coordLat').textContent = e.latlng.lat.toFixed(6);
        document.getElementById('coordLng').textContent = e.latlng.lng.toFixed(6);
    });

    // Search Control (uses leaflet-search to search within layers)
    const searchControl = new L.Control.Search({
        position: 'topleft',
        layer: L.layerGroup(), // will be updated after layers load
        initial: false,
        zoom: 16,
        marker: false,
        textPlaceholder: 'Cari lokasi...'
    });
    APP.map.addControl(searchControl);

    // Load GeoJSON layers
    loadAllLayers();
}

// ===== Load All GeoJSON Layers =====
function loadAllLayers() {
    const files = [
        { key: 'veg2024', url: 'data/Vegetasi_2024_GeoJSON (2).geojson', name: 'Vegetasi 2024', color: APP.layerColors.veg2024, year: '2024', change: 'Vegetasi' },
        { key: 'veg2025', url: 'data/Vegetasi_2025_GeoJSON (2).geojson', name: 'Vegetasi 2025', color: APP.layerColors.veg2025, year: '2025', change: 'Vegetasi' },
        { key: 'gain', url: 'data/Gain_GeoJSON (2).geojson', name: 'Gain', color: APP.layerColors.gain, year: '2024-2025', change: 'Vegetasi Bertambah' },
        { key: 'loss', url: 'data/Loss_GeoJSON (2).geojson', name: 'Loss', color: APP.layerColors.loss, year: '2024-2025', change: 'Vegetasi Berkurang' }
    ];

    let loaded = 0;
    files.forEach(f => {
        fetch(f.url)
            .then(r => r.json())
            .then(data => {
                const layer = L.geoJSON(data, {
                    style: () => ({
                        fillColor: f.color,
                        color: f.color,
                        weight: 0.5,
                        opacity: 0.8,
                        fillOpacity: 0.7
                    }),
                    onEachFeature: (feature, lyr) => {
                        const area = computePolygonArea(feature);
                        const areaStr = area > 0 ? area.toFixed(4) + ' Ha' : 'N/A';
                        lyr.bindPopup(`
                            <div class="popup-title" style="color:${f.color}">${f.name}</div>
                            <div class="popup-row"><span class="popup-label">Layer</span><span class="popup-value">${f.name}</span></div>
                            <div class="popup-row"><span class="popup-label">Jenis Perubahan</span><span class="popup-value">${f.change}</span></div>
                            <div class="popup-row"><span class="popup-label">Luas</span><span class="popup-value">${areaStr}</span></div>
                            <div class="popup-row"><span class="popup-label">Tahun</span><span class="popup-value">${f.year}</span></div>
                            <div class="popup-row"><span class="popup-label">Warna</span><span class="popup-value"><span style="display:inline-block;width:14px;height:14px;background:${f.color};border-radius:3px;vertical-align:middle;"></span></span></div>
                        `);
                    }
                }).addTo(APP.map);

                APP.geoJsonLayers[f.key] = { layer, data, meta: f };

                // Click event for gain/loss interactive stats
                if (f.key === 'gain' || f.key === 'loss') {
                    layer.on('click', () => showLayerClickInfo(f.key));
                }

                loaded++;
                if (loaded === files.length) {
                    onAllLayersLoaded();
                }
            })
            .catch(err => {
                console.error('Error loading ' + f.url, err);
                loaded++;
            });
    });
}

// ===== Compute approximate polygon area using Shoelace formula in Ha =====
function computePolygonArea(feature) {
    try {
        const geom = feature.geometry;
        let coords = [];
        if (geom.type === 'Polygon') {
            coords = [geom.coordinates[0]];
        } else if (geom.type === 'MultiPolygon') {
            coords = geom.coordinates.map(p => p[0]);
        } else {
            return 0;
        }
        let totalArea = 0;
        coords.forEach(ring => {
            let area = 0;
            for (let i = 0; i < ring.length - 1; i++) {
                const [x1, y1] = ring[i];
                const [x2, y2] = ring[i + 1];
                area += (x2 - x1) * (y2 + y1);
            }
            // Convert deg^2 to m^2 approximately (at equator: 1 deg ~= 111320 m)
            const latFactor = Math.cos((ring[0][1] * Math.PI) / 180);
            totalArea += Math.abs(area / 2) * (111320 * latFactor) * 111320;
        });
        return totalArea / 10000; // m^2 to Ha
    } catch {
        return 0;
    }
}

// ===== Number formatting helper =====
function formatNumber(n, decimals = 2) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Number(n).toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ===== After All Layers Loaded =====
function onAllLayersLoaded() {
    // Create Batas Kota Manado from all layers bounds
    createBatasKota();

    // Setup layer toggles
    setupLayerToggles();

    // Setup opacity sliders
    setupOpacitySliders();

    // Fit bounds
    const allBounds = [];
    Object.values(APP.geoJsonLayers).forEach(l => {
        try { allBounds.push(l.layer.getBounds()); } catch(e) {}
    });
    if (allBounds.length > 0) {
        let combined = allBounds[0];
        allBounds.slice(1).forEach(b => combined.extend(b));
        APP.map.fitBounds(combined, { padding: [20, 20] });
        APP.defaultCenter = combined.getCenter();
    }

    showToast('Semua layer berhasil dimuat!', 'success', 'fas fa-layer-group');
}

// ===== Create Batas Kota Manado =====
function createBatasKota() {
    // Create a convex hull-like boundary from all data points
    const allCoords = [];
    Object.values(APP.geoJsonLayers).forEach(l => {
        l.data.features.forEach(f => {
            extractCoords(f.geometry, allCoords);
        });
    });

    if (allCoords.length > 0) {
        // Compute bounding box as boundary
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        allCoords.forEach(([lng, lat]) => {
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
        });
        
        // Add a small padding
        const padLat = (maxLat - minLat) * 0.02;
        const padLng = (maxLng - minLng) * 0.02;
        minLat -= padLat; maxLat += padLat;
        minLng -= padLng; maxLng += padLng;

        const batasCoords = [
            [minLat, minLng], [minLat, maxLng],
            [maxLat, maxLng], [maxLat, minLng]
        ];

        APP.layers.batas = L.polygon(batasCoords, {
            color: APP.layerColors.batas,
            weight: 3,
            fill: false,
            dashArray: '8, 4',
            opacity: 0.8
        }).addTo(APP.map);
        
        APP.layers.batas.bindPopup(`
            <div class="popup-title" style="color:${APP.layerColors.batas}">Batas Kota Manado</div>
            <div class="popup-row"><span class="popup-label">Wilayah</span><span class="popup-value">Kota Manado</span></div>
            <div class="popup-row"><span class="popup-label">Provinsi</span><span class="popup-value">Sulawesi Utara</span></div>
        `);
    }
}

function extractCoords(geometry, arr) {
    if (geometry.type === 'Polygon') {
        geometry.coordinates[0].forEach(c => arr.push(c));
    } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach(poly => poly[0].forEach(c => arr.push(c)));
    }
}

// ===== Layer Toggles =====
function setupLayerToggles() {
    document.getElementById('layerBasemap').addEventListener('change', (e) => {
        if (e.target.checked) APP.map.addLayer(APP.layers.basemap);
        else APP.map.removeLayer(APP.layers.basemap);
    });
    document.getElementById('layerBatas').addEventListener('change', (e) => {
        if (APP.layers.batas) {
            if (e.target.checked) APP.map.addLayer(APP.layers.batas);
            else APP.map.removeLayer(APP.layers.batas);
        }
    });
    const layerMap = {
        layerVeg2024: 'veg2024',
        layerVeg2025: 'veg2025',
        layerGain: 'gain',
        layerLoss: 'loss'
    };
    Object.entries(layerMap).forEach(([elemId, key]) => {
        document.getElementById(elemId).addEventListener('change', (e) => {
            if (APP.geoJsonLayers[key]) {
                if (e.target.checked) APP.map.addLayer(APP.geoJsonLayers[key].layer);
                else APP.map.removeLayer(APP.geoJsonLayers[key].layer);
            }
        });
    });
}

// ===== Opacity Sliders =====
function setupOpacitySliders() {
    const sliders = {
        opacityVeg2024: 'veg2024',
        opacityVeg2025: 'veg2025',
        opacityGain: 'gain',
        opacityLoss: 'loss'
    };
    Object.entries(sliders).forEach(([sliderId, key]) => {
        const slider = document.getElementById(sliderId);
        const valSpan = document.getElementById(sliderId + 'Val');
        slider.addEventListener('input', () => {
            const val = parseFloat(slider.value);
            valSpan.textContent = Math.round(val * 100) + '%';
            if (APP.geoJsonLayers[key]) {
                APP.geoJsonLayers[key].layer.setStyle({ fillOpacity: val, opacity: val });
            }
        });
    });
}

// ===== Map Tools =====
function initMapTools() {
    // Reset View
    document.getElementById('btnResetView').addEventListener('click', () => {
        if (APP.defaultCenter) {
            APP.map.setView(APP.defaultCenter, APP.defaultZoom);
        }
        showToast('Peta dikembalikan ke posisi awal', 'info', 'fas fa-home');
    });

    // Fullscreen
    document.getElementById('btnFullscreen').addEventListener('click', () => {
        APP.map.toggleFullscreen();
    });

    // Export Map PNG
    document.getElementById('btnExportMap').addEventListener('click', () => {
        showToast('Mengekspor peta...', 'info', 'fas fa-spinner fa-spin');
        const mapEl = document.getElementById('map');
        html2canvas(mapEl, { useCORS: true, allowTaint: true }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'Peta_Vegetasi_Manado.png';
            link.href = canvas.toDataURL();
            link.click();
            showToast('Peta berhasil diekspor!', 'success', 'fas fa-check-circle');
        }).catch(() => {
            showToast('Gagal mengekspor peta', 'error', 'fas fa-times-circle');
        });
    });

    // Download CSV
    document.getElementById('btnDownloadCSV').addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = 'data/Statistik_Manado.csv';
        link.download = 'Statistik_Manado.csv';
        link.click();
        showToast('File CSV diunduh!', 'success', 'fas fa-download');
    });

    // Screenshot
    document.getElementById('screenshotBtn').addEventListener('click', () => {
        showToast('Mengambil screenshot...', 'info', 'fas fa-camera');
        html2canvas(document.getElementById('appWrapper'), { useCORS: true, allowTaint: true }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'WebGIS_Screenshot.png';
            link.href = canvas.toDataURL();
            link.click();
            showToast('Screenshot berhasil!', 'success', 'fas fa-check-circle');
        }).catch(() => {
            showToast('Gagal mengambil screenshot', 'error', 'fas fa-times-circle');
        });
    });
}

// ===== Show Layer Click Info (Interactive Stats) =====
function showLayerClickInfo(key) {
    const info = APP.geoJsonLayers[key];
    if (!info || !APP.stats) return;

    const container = document.getElementById('layerClickInfo');
    const details = document.getElementById('layerClickDetails');
    container.style.display = 'block';

    const totalPolygons = info.data.features.length;
    const totalLuas = key === 'gain' ? APP.stats.Gain_Ha : APP.stats.Loss_Ha;
    const luasKota = APP.stats.Luas_Kota_Ha;
    const persen = ((totalLuas / luasKota) * 100).toFixed(2);

    details.innerHTML = `
        <div class="click-info-item">
            <span>Layer</span>
            <strong style="color:${info.meta.color}">${info.meta.name}</strong>
        </div>
        <div class="click-info-item">
            <span>Total Polygon</span>
            <strong>${totalPolygons.toLocaleString()}</strong>
        </div>
        <div class="click-info-item">
            <span>Total Luas</span>
            <strong>${totalLuas.toFixed(2)} Ha</strong>
        </div>
        <div class="click-info-item">
            <span>% terhadap Kota</span>
            <strong>${persen}%</strong>
        </div>
    `;

    // Ensure right sidebar is visible
    document.getElementById('rightSidebar').classList.remove('collapsed');
}

// ===== Load Statistics CSV =====
function loadStatistics() {
    Papa.parse('data/Statistik_Manado.csv', {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: (results) => {
            if (results.data && results.data.length > 0) {
                APP.stats = results.data[0];
                populateDashboard();
                populateInsightCards();
                populateSmartAnalytics();
                generateAIInsight();
                createInsightCharts();
                showToast('Data statistik berhasil dimuat', 'success', 'fas fa-database');
            }
        },
        error: () => {
            showToast('Gagal memuat data statistik', 'error', 'fas fa-times-circle');
        }
    });
}

// ===== Populate Right Sidebar Dashboard =====
function populateDashboard() {
    const s = APP.stats;
    const container = document.getElementById('dashboardStats');
    const items = [
        { label: 'Luas Kota Manado', value: s.Luas_Kota_Ha, unit: 'Ha', icon: '🏙️', color: '#1a3a5c', border: '#1a3a5c', decimals: 0 },
        { label: 'Luas Vegetasi 2024', value: s.Luas_Vegetasi_2024_Ha, unit: 'Ha', icon: '🌳', color: '#66bb6a', border: '#66bb6a', decimals: 2 },
        { label: 'Luas Vegetasi 2025', value: s.Luas_Vegetasi_2025_Ha, unit: 'Ha', icon: '🌿', color: '#2e7d32', border: '#2e7d32', decimals: 2 },
        { label: 'Gain (Bertambah)', value: s.Gain_Ha, unit: 'Ha', icon: '📈', color: '#1565c0', border: '#1565c0', decimals: 2 },
        { label: 'Loss (Berkurang)', value: s.Loss_Ha, unit: 'Ha', icon: '📉', color: '#c62828', border: '#c62828', decimals: 2 },
        { label: 'Net Change', value: s.Net_Change_Ha, unit: 'Ha', icon: '🛰', color: s.Net_Change_Ha >= 0 ? '#2e7d32' : '#c62828', border: s.Net_Change_Ha >= 0 ? '#2e7d32' : '#c62828', decimals: 2 },
        { label: 'Persentase Perubahan', value: s.Persentase_Perubahan, unit: '%', icon: '📊', color: s.Persentase_Perubahan >= 0 ? '#2e7d32' : '#c62828', border: s.Persentase_Perubahan >= 0 ? '#2e7d32' : '#c62828', decimals: 2 }
    ];

    container.innerHTML = items.map(item => `
        <div class="dashboard-stat-card" style="border-left-color:${item.border}">
            <div class="ds-label">${item.icon} ${item.label}</div>
            <div class="ds-value" style="color:${item.color}">
                ${typeof item.value === 'number' ? formatNumber(item.value, item.decimals) : item.value}
                <span class="ds-unit">${item.unit}</span>
            </div>
        </div>
    `).join('');
}

// ===== Populate Insight Cards =====
function populateInsightCards() {
    const s = APP.stats;
    const container = document.getElementById('insightCards');
    const items = [
        { label: 'Luas Kota Manado', value: s.Luas_Kota_Ha, unit: 'Ha', icon: '🏙️', color: '#1a3a5c', decimals: 0 },
        { label: 'Luas Vegetasi 2024', value: s.Luas_Vegetasi_2024_Ha, unit: 'Ha', icon: '🌳', color: '#66bb6a', decimals: 2 },
        { label: 'Luas Vegetasi 2025', value: s.Luas_Vegetasi_2025_Ha, unit: 'Ha', icon: '🌿', color: '#2e7d32', decimals: 2 },
        { label: 'Gain (Bertambah)', value: s.Gain_Ha, unit: 'Ha', icon: '📈', color: '#1565c0', positive: true, decimals: 2 },
        { label: 'Loss (Berkurang)', value: s.Loss_Ha, unit: 'Ha', icon: '📉', color: '#c62828', negative: true, decimals: 2 },
        { label: 'Tetap Vegetasi', value: s.Tetap_Vegetasi_Ha, unit: 'Ha', icon: '🌲', color: '#388e3c', decimals: 2 },
        { label: 'Tetap Non Vegetasi', value: s.Tetap_NonVegetasi_Ha, unit: 'Ha', icon: '🏗️', color: '#757575', decimals: 2 },
        { label: 'Net Change', value: s.Net_Change_Ha, unit: 'Ha', icon: '🛰', color: s.Net_Change_Ha >= 0 ? '#2e7d32' : '#c62828', decimals: 2 },
        { label: 'Persentase Perubahan', value: s.Persentase_Perubahan, unit: '%', icon: '📊', color: s.Persentase_Perubahan >= 0 ? '#2e7d32' : '#c62828', decimals: 2 }
    ];

    container.innerHTML = items.map(item => `
        <div class="col-md-4 col-sm-6">
            <div class="insight-stat-card">
                <div class="stat-icon">${item.icon}</div>
                <div class="stat-label">${item.label}</div>
                <div class="stat-value ${item.positive ? 'stat-positive' : item.negative ? 'stat-negative' : ''}" style="color:${item.color}">
                    ${typeof item.value === 'number' ? formatNumber(item.value, item.decimals) : item.value}
                    <span class="stat-unit">${item.unit}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ===== Smart Analytics =====
function populateSmartAnalytics() {
    const s = APP.stats;
    const luasKota = s.Luas_Kota_Ha;
    const items = [
        { label: 'Vegetasi Bertambah', value: s.Gain_Ha, persen: (s.Gain_Ha / luasKota * 100), color: '#1565c0' },
        { label: 'Vegetasi Berkurang', value: s.Loss_Ha, persen: (s.Loss_Ha / luasKota * 100), color: '#c62828' },
        { label: 'Vegetasi Tetap', value: s.Tetap_Vegetasi_Ha, persen: (s.Tetap_Vegetasi_Ha / luasKota * 100), color: '#2e7d32' },
        { label: 'Non Vegetasi Tetap', value: s.Tetap_NonVegetasi_Ha, persen: (s.Tetap_NonVegetasi_Ha / luasKota * 100), color: '#757575' }
    ];

    // Full panel (Insight tab)
    const fullContainer = document.getElementById('smartAnalyticsContainer');
    fullContainer.innerHTML = items.map(item => `
        <div class="col-md-3 col-sm-6">
            <div class="progress-circle-container">
                <div class="progress-circle">
                    <svg viewBox="0 0 100 100">
                        <circle class="circle-bg" cx="50" cy="50" r="40"></circle>
                        <circle class="circle-fill" cx="50" cy="50" r="40" stroke="${item.color}" data-persen="${item.persen}"></circle>
                    </svg>
                    <div class="circle-text" style="color:${item.color}">${Number(item.persen).toFixed(1)}%</div>
                </div>
                <div class="progress-circle-label">${item.label}</div>
                <small style="color:var(--text-muted)">${formatNumber(item.value, 2)} Ha</small>
            </div>
        </div>
    `).join('');

    // Animate circles after a short delay
    setTimeout(animateProgressCircles, 500);

    // Mini sidebar version
    const miniContainer = document.getElementById('smartAnalyticsMini');
    miniContainer.innerHTML = items.map(item => `
        <div class="mini-progress">
            <div class="mini-progress-label">
                <span>${item.label}</span>
                <span style="color:${item.color}">${item.persen.toFixed(1)}%</span>
            </div>
            <div class="mini-progress-bar">
                <div class="mini-progress-fill" style="background:${item.color}" data-width="${Math.min(item.persen * 1.5, 100)}"></div>
            </div>
        </div>
    `).join('');

    // Animate mini progress bars
    setTimeout(() => {
        document.querySelectorAll('.mini-progress-fill').forEach(bar => {
            bar.style.width = bar.dataset.width + '%';
        });
    }, 800);
}

function animateProgressCircles() {
    document.querySelectorAll('.circle-fill').forEach(circle => {
        const persen = parseFloat(circle.dataset.persen);
        const circumference = 2 * Math.PI * 40; // r=40
        const offset = circumference - (persen / 100) * circumference;
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = offset;
    });
}

// ===== AI Insight =====
function generateAIInsight() {
    const s = APP.stats;
    const direction = s.Net_Change_Ha > 0 ? 'peningkatan' : 'penurunan';
    const text = `Analisis menunjukkan bahwa luas vegetasi Kota Manado mengalami <strong>${direction}</strong> sebesar <strong>${Math.abs(s.Persentase_Perubahan).toFixed(2)}%</strong> dari tahun 2024 ke 2025. Area penambahan vegetasi (<strong>${s.Gain_Ha.toFixed(2)} Ha</strong>) lebih besar dibandingkan area kehilangan vegetasi (<strong>${s.Loss_Ha.toFixed(2)} Ha</strong>), sehingga terjadi Net Change <strong>${s.Net_Change_Ha > 0 ? 'positif' : 'negatif'}</strong> sebesar <strong>${Math.abs(s.Net_Change_Ha).toFixed(2)} Ha</strong>. Kondisi ini mengindikasikan adanya ${direction} tutupan vegetasi selama periode pengamatan. Luas vegetasi tetap sebesar <strong>${s.Tetap_Vegetasi_Ha.toFixed(2)} Ha</strong> menunjukkan stabilitas tutupan vegetasi yang cukup tinggi.`;

    document.getElementById('aiInsightText').innerHTML = `<p>${text}</p>`;
    document.getElementById('aiInsightMiniText').innerHTML = text;
}

// ===== Insight Charts =====
function createInsightCharts() {
    const s = APP.stats;
    const isDark = APP.isDark;
    const textColor = isDark ? '#e8edf3' : '#1a2332';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

    // Bar Chart
    const barCtx = document.getElementById('insightBarChart').getContext('2d');
    APP.charts.insightBar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ['Vegetasi 2024', 'Vegetasi 2025', 'Gain', 'Loss', 'Net Change'],
            datasets: [{
                label: 'Luas (Ha)',
                data: [s.Luas_Vegetasi_2024_Ha, s.Luas_Vegetasi_2025_Ha, s.Gain_Ha, s.Loss_Ha, s.Net_Change_Ha],
                backgroundColor: ['#66bb6a', '#2e7d32', '#1565c0', '#c62828', '#ff9800'],
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
            },
            scales: {
                y: { ticks: { color: textColor }, grid: { color: gridColor } },
                x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } }
            }
        }
    });

    // Doughnut Chart
    const doughnutCtx = document.getElementById('insightDoughnutChart').getContext('2d');
    APP.charts.insightDoughnut = new Chart(doughnutCtx, {
        type: 'doughnut',
        data: {
            labels: ['Tetap Vegetasi', 'Tetap Non Vegetasi', 'Gain', 'Loss'],
            datasets: [{
                data: [s.Tetap_Vegetasi_Ha, s.Tetap_NonVegetasi_Ha, s.Gain_Ha, s.Loss_Ha],
                backgroundColor: ['#2e7d32', '#757575', '#1565c0', '#c62828'],
                borderWidth: 2,
                borderColor: isDark ? '#1e2d3d' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, font: { size: 11 }, padding: 12, usePointStyle: true }
                }
            },
            cutout: '60%'
        }
    });

    // Line Chart
    const lineCtx = document.getElementById('insightLineChart').getContext('2d');
    APP.charts.insightLine = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: ['2024', '2025'],
            datasets: [{
                label: 'Luas Vegetasi (Ha)',
                data: [s.Luas_Vegetasi_2024_Ha, s.Luas_Vegetasi_2025_Ha],
                borderColor: '#2e7d32',
                backgroundColor: 'rgba(46, 125, 50, 0.15)',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: '#2e7d32',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: { ticks: { color: textColor }, grid: { color: gridColor } },
                x: { ticks: { color: textColor }, grid: { display: false } }
            }
        }
    });
}

// ===== Evaluation Charts =====
function createEvalCharts() {
    const isDark = APP.isDark;
    const textColor = isDark ? '#e8edf3' : '#1a2332';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

    // Bar Chart
    const barCtx = document.getElementById('evalBarChart').getContext('2d');
    APP.charts.evalBar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ['Accuracy', 'Precision', 'Recall', 'F1 Score'],
            datasets: [{
                label: 'Score (%)',
                data: [97.67, 96.43, 99.26, 97.83],
                backgroundColor: [
                    'rgba(21, 101, 192, 0.8)',
                    'rgba(46, 125, 50, 0.8)',
                    'rgba(230, 81, 0, 0.8)',
                    'rgba(106, 27, 154, 0.8)'
                ],
                borderColor: ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a'],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 105,
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: { color: textColor },
                    grid: { display: false }
                }
            }
        }
    });

    // Radar Chart
    const radarCtx = document.getElementById('evalRadarChart').getContext('2d');
    APP.charts.evalRadar = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: ['Accuracy', 'Precision', 'Recall', 'F1 Score'],
            datasets: [{
                label: 'Random Forest',
                data: [97.67, 96.43, 99.26, 97.83],
                backgroundColor: 'rgba(26, 58, 92, 0.2)',
                borderColor: '#1a3a5c',
                borderWidth: 2,
                pointBackgroundColor: ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a'],
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: textColor } }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 105,
                    ticks: { color: textColor, backdropColor: 'transparent' },
                    grid: { color: gridColor },
                    pointLabels: { color: textColor, font: { size: 12, weight: '600' } }
                }
            }
        }
    });
}

// ===== Update Charts Theme =====
function updateChartsTheme() {
    // Destroy and recreate charts
    Object.values(APP.charts).forEach(chart => {
        try { chart.destroy(); } catch(e) {}
    });
    APP.charts = {};
    createEvalCharts();
    if (APP.stats) createInsightCharts();
}

// ===== Animate Metrics =====
function animateMetrics() {
    document.querySelectorAll('.metric-value').forEach(el => {
        const target = parseFloat(el.dataset.target);
        let current = 0;
        const step = target / 60;
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            el.textContent = current.toFixed(2);
        }, 20);
    });

    document.querySelectorAll('.metric-bar-fill').forEach(bar => {
        setTimeout(() => {
            bar.style.width = bar.dataset.width + '%';
        }, 300);
    });
}

// ===== Timeline =====
function initTimeline() {
    const steps = [
        {
            step: 1,
            title: 'Input Data Penelitian',
            subtitle: 'Integrasi data spasial, citra Sentinel-2, dan ground truth manual',
            summary: 'Tahap awal menggabungkan batas administrasi, citra Sentinel-2 2024–2025, dan 400 titik ground truth manual sebagai dasar analisis.',
            icon: 'fas fa-database',
            data: [
                'Batas Administrasi Kota Manado (FeatureCollection/GeoJSON)',
                'Citra Sentinel-2 Surface Reflectance Harmonized tahun 2024 & 2025',
                'Ground Truth Manual: Vegetasi dan Non Vegetasi',
                'Sumber data dari Google Earth Engine Asset dan digitasi manual'
            ],
            methods: [
                'Pengumpulan data spasial dan atribut dari GEE Asset',
                'Persiapan dataset penelitian untuk dua periode waktu'
            ],
            parameters: [
                'Asset ID: projects/gee-uas-kapita/assets/manado_boundary-1',
                'Dataset: COPERNICUS/S2_SR_HARMONIZED',
                'Resolusi: 10 meter',
                'Cloud Cover: <15%'
            ],
            output: [
                'Data input siap dianalisis',
                'Batas kota, citra 2024, citra 2025, dan 400 titik ground truth'
            ]
        },
        {
            step: 2,
            title: 'Preprocessing Data',
            subtitle: 'Tahapan preprocessing meliputi filtering, cloud masking, composite, clipping, dan visualisasi RGB',
            summary: 'Citra dibersihkan dari gangguan awan dan dipotong sesuai batas Kota Manado agar siap dipakai untuk analisis lanjutan.',
            icon: 'fas fa-filter',
            data: [
                'Citra Sentinel-2 Surface Reflectance Harmonized tahun 2024 dan 2025',
                'Batas Administrasi Kota Manado',
                'Area studi yang difokuskan pada wilayah kota'
            ],
            methods: [
                'Filtering Area Kota Manado',
                'Filtering Cloud Cover <15%',
                'Median Composite Sentinel-2',
                'Clip berdasarkan batas administrasi',
                'Visualisasi RGB dengan band B4, B3, B2'
            ],
            parameters: [
                'Band RGB: B4, B3, B2',
                'Cloud Cover: <15%',
                'Area of interest: batas Kota Manado'
            ],
            output: [
                'RGB Tahun 2024',
                'RGB Tahun 2025'
            ]
        },
        {
            step: 3,
            title: 'Perhitungan NDVI',
            subtitle: 'NDVI dihitung menggunakan rumus sederhana berbasis band merah dan NIR',
            summary: 'NDVI dihitung untuk mengukur tingkat kehijauan vegetasi pada citra 2024 dan 2025.',
            icon: 'fas fa-leaf',
            data: [
                'Citra Sentinel-2 hasil preprocessing',
                'Band Near Infrared (B8) dan Red (B4)'
            ],
            methods: [
                'NDVI = (B8 − B4) / (B8 + B4)',
                'Menghitung indeks vegetasi untuk citra 2024 dan 2025'
            ],
            parameters: [
                'Band yang digunakan: Near Infrared (B8)',
                'Band yang digunakan: Red (B4)',
                'Rumus: NDVI = (B8 − B4) / (B8 + B4)'
            ],
            output: [
                'Peta NDVI Tahun 2024',
                'Peta NDVI Tahun 2025'
            ]
        },
        {
            step: 4,
            title: 'Ground Truth Manual',
            subtitle: 'Data training diperoleh melalui digitasi manual',
            summary: 'Titik sampel manual ditetapkan sebagai acuan kelas untuk melatih model klasifikasi.',
            icon: 'fas fa-map-pin',
            data: [
                'Data training hasil digitasi manual',
                'Kelas Vegetasi dan Non Vegetasi'
            ],
            methods: [
                'Digitasi manual berdasarkan interpretasi visual citra',
                'Penetapan kelas Vegetasi dan Non Vegetasi'
            ],
            parameters: [
                'Kelas: Vegetasi, Non Vegetasi',
                'Total sampel: 400 titik',
                'Pembagian: 200 titik tahun 2024 dan 200 titik tahun 2025'
            ],
            output: [
                'Dataset ground truth manual',
                'Label kelas untuk pelatihan model'
            ]
        },
        {
            step: 5,
            title: 'Ekstraksi Nilai Piksel',
            subtitle: 'Nilai setiap titik sampel diekstraksi dari citra Sentinel-2',
            summary: 'Nilai piksel dari setiap titik sampel diambil untuk membentuk dataset pelatihan yang siap dipakai model.',
            icon: 'fas fa-cube',
            data: [
                'Titik sampel ground truth',
                'Citra Sentinel-2 hasil preprocessing',
                'Peta NDVI hasil perhitungan'
            ],
            methods: [
                'Ekstraksi nilai piksel pada tiap sampel',
                'Menggabungkan nilai band dan NDVI menjadi dataset training'
            ],
            parameters: [
                'Band yang digunakan: B2, B3, B4, B8, NDVI',
                'Kolom output: B2, B3, B4, B8, NDVI, Class, Year'
            ],
            output: [
                'Dataset CSV Training',
                'Kolom: B2, B3, B4, B8, NDVI, Class, Year'
            ]
        },
        {
            step: 6,
            title: 'Split Dataset',
            subtitle: 'Pembagian data dilakukan untuk pelatihan dan pengujian model',
            summary: 'Dataset dibagi menjadi 70% data latih dan 30% data uji dengan metode stratified split agar distribusi kelas tetap seimbang.',
            icon: 'fas fa-scissors',
            data: [
                'Dataset hasil ekstraksi piksel',
                'Label kelas vegetasi dan non vegetasi'
            ],
            methods: [
                'Training = 70%',
                'Testing = 30%',
                'Random State = 42',
                'Stratified Split'
            ],
            parameters: [
                'Training: 70%',
                'Testing: 30%',
                'Random State: 42',
                'Metode: Stratified Split'
            ],
            output: [
                'Data latih siap pelatihan',
                'Data uji untuk evaluasi model'
            ]
        },
        {
            step: 7,
            title: 'Model Random Forest',
            subtitle: 'Algoritma Random Forest Classifier digunakan untuk klasifikasi tutupan lahan',
            summary: 'Model Random Forest dilatih menggunakan fitur band dan NDVI untuk memprediksi kelas vegetasi dan non vegetasi.',
            icon: 'fas fa-tree',
            data: [
                'Data pelatihan hasil split',
                'Fitur band dan indeks vegetasi'
            ],
            methods: [
                'Random Forest Classifier',
                'Jumlah Tree: 100',
                'Menggunakan fitur B2, B3, B4, B8, NDVI'
            ],
            parameters: [
                'Algoritma: Random Forest Classifier',
                'Jumlah Tree: 100',
                'Feature: B2, B3, B4, B8, NDVI',
                'Target: Vegetasi / Non Vegetasi'
            ],
            output: [
                'Model klasifikasi terlatih',
                'Prediksi kelas untuk data uji dan data raster'
            ]
        },
        {
            step: 8,
            title: 'Evaluasi Model',
            subtitle: 'Metrik evaluasi digunakan untuk mengukur kualitas prediksi model',
            summary: 'Performa model dinilai melalui akurasi, presisi, recall, F1 score, dan confusion matrix terhadap data testing 30%.',
            icon: 'fas fa-bullseye',
            data: [
                'Hasil prediksi model pada data testing',
                'Label aktual dan label prediksi'
            ],
            methods: [
                'Menghitung Accuracy, Precision, Recall, F1 Score',
                'Membuat Confusion Matrix',
                'Evaluasi dilakukan menggunakan dataset testing 30%'
            ],
            parameters: [
                'Metrik: Accuracy, Precision, Recall, F1 Score',
                'Confusion Matrix',
                'Dataset testing: 30%'
            ],
            output: [
                'Nilai performa model',
                'Pemetaan kualitas klasifikasi secara kuantitatif'
            ]
        },
        {
            step: 9,
            title: 'Klasifikasi Tutupan Vegetasi',
            subtitle: 'Menghasilkan peta vegetasi berdasarkan hasil klasifikasi Random Forest',
            summary: 'Model diterapkan ke seluruh piksel citra untuk menghasilkan peta klasifikasi vegetasi 2024 dan 2025.',
            icon: 'fas fa-tags',
            data: [
                'Model Random Forest yang sudah dievaluasi',
                'Citra Sentinel-2 tahun 2024 dan 2025'
            ],
            methods: [
                'Random Forest Classification',
                'Menghasilkan kelas Vegetasi dan Non Vegetasi'
            ],
            parameters: [
                'Peta Vegetasi 2024',
                'Peta Vegetasi 2025',
                'Metode: Random Forest Classification'
            ],
            output: [
                'Peta Vegetasi 2024',
                'Peta Vegetasi 2025'
            ]
        },
        {
            step: 10,
            title: 'Analisis Perubahan Vegetasi',
            subtitle: 'Membandingkan hasil klasifikasi antara tahun 2024 dan 2025',
            summary: 'Perubahan tutupan vegetasi dianalisis dengan membandingkan hasil klasifikasi tahun 2024 dan 2025.',
            icon: 'fas fa-exchange-alt',
            data: [
                'Peta vegetasi 2024',
                'Peta vegetasi 2025'
            ],
            methods: [
                'Membandingkan hasil klasifikasi 2024 dan 2025',
                'Mengidentifikasi kategori Gain, Loss, Tetap Vegetasi, Tetap Non Vegetasi'
            ],
            parameters: [
                'Kategori perubahan: Gain (Vegetasi Bertambah)',
                'Kategori perubahan: Loss (Vegetasi Berkurang)',
                'Kategori perubahan: Tetap Vegetasi',
                'Kategori perubahan: Tetap Non Vegetasi'
            ],
            output: [
                'Peta Change Detection',
                'Identifikasi area yang bertambah dan berkurang'
            ]
        },
        {
            step: 11,
            title: 'Statistik Perubahan Vegetasi',
            subtitle: 'Statistik dihitung menggunakan Google Earth Engine dengan pixelArea()',
            summary: 'Statistik perubahan dihitung untuk mengukur luas vegetasi, gain, loss, net change, dan persentase perubahan.',
            icon: 'fas fa-chart-pie',
            data: [
                'Hasil change detection',
                'Data statistik dari file Statistik_Manado.csv'
            ],
            methods: [
                'Menghitung luas dengan Google Earth Engine menggunakan pixelArea()',
                'Menganalisis luas vegetasi, gain, loss, dan net change'
            ],
            parameters: [
                'Luas Kota Manado',
                'Luas Vegetasi 2024',
                'Luas Vegetasi 2025',
                'Gain',
                'Loss',
                'Tetap Vegetasi',
                'Tetap Non Vegetasi',
                'Net Change',
                'Persentase Perubahan'
            ],
            output: [
                'Statistik perubahan vegetasi',
                'Data siap ditampilkan pada dashboard WebGIS'
            ]
        },
        {
            step: 12,
            title: 'Export Hasil Analisis',
            subtitle: 'Seluruh hasil diekspor menjadi format geospasial dan tabular',
            summary: 'Hasil analisis diekspor menjadi GeoJSON, CSV, dan GeoTIFF agar dapat digunakan langsung pada WebGIS.',
            icon: 'fas fa-file-export',
            data: [
                'Peta klasifikasi',
                'Peta change detection',
                'Statistik perhitungan'
            ],
            methods: [
                'Ekspor data menjadi GeoJSON',
                'Ekspor data menjadi CSV',
                'Ekspor data menjadi GeoTIFF'
            ],
            parameters: [
                'GeoJSON: Vegetasi_2024.geojson, Vegetasi_2025.geojson, Gain.geojson, Loss.geojson',
                'CSV: Statistik_Manado.csv, Sampel_Titik_Manado_2024.csv, Sampel_Titik_Manado_2025.csv',
                'GeoTIFF: Raster_Klasifikasi_2024.tif, Raster_Klasifikasi_2025.tif'
            ],
            output: [
                'Dataset siap publikasi',
                'Sumber utama untuk visualisasi WebGIS'
            ]
        },
        {
            step: 13,
            title: 'Pembangunan WebGIS Interaktif',
            subtitle: 'Framework dan teknologi yang digunakan untuk membangun WebGIS',
            summary: 'Antarmuka WebGIS dibangun dengan teknologi modern untuk menampilkan peta, layer, dan statistik secara interaktif.',
            icon: 'fas fa-globe-americas',
            data: [
                'Vegetasi_2024.geojson',
                'Vegetasi_2025.geojson',
                'Gain.geojson',
                'Loss.geojson',
                'Statistik_Manado.csv'
            ],
            methods: [
                'HTML5, CSS3, JavaScript (ES6)',
                'Leaflet.js, Bootstrap 5, Font Awesome, Chart.js, PapaParse',
                'Layer Control, Basemap Switcher, Dashboard Statistik, AI Assistant'
            ],
            parameters: [
                'Fitur utama: Visualisasi peta interaktif',
                'Fitur utama: Layer Control',
                'Fitur utama: Basemap Switcher',
                'Fitur utama: Dashboard Statistik, Grafik Analisis, Timeline Proses, Evaluasi Model, Responsive Design'
            ],
            output: [
                'WebGIS Analisis Perubahan Vegetasi Kota Manado'
            ]
        },
        {
            step: 14,
            title: 'Visualisasi dan Dashboard Analisis',
            subtitle: 'Dashboard menampilkan hasil analisis dalam bentuk visual interaktif',
            summary: 'Dashboard menampilkan peta, grafik, progress bar, dan insight untuk memudahkan interpretasi hasil analisis.',
            icon: 'fas fa-chart-line',
            data: [
                'Layer Vegetasi 2024',
                'Layer Vegetasi 2025',
                'Gain Layer',
                'Loss Layer',
                'Dashboard Statistik'
            ],
            methods: [
                'Interactive Map',
                'Bar Chart, Pie Chart, Radar Chart, Confusion Matrix',
                'Insight Analisis'
            ],
            parameters: [
                'Progress Bar',
                'Layer Vegetasi 2024',
                'Layer Vegetasi 2025',
                'Gain Layer',
                'Loss Layer'
            ],
            output: [
                'Visualisasi spasial yang interaktif untuk mendukung interpretasi perubahan vegetasi Kota Manado'
            ]
        },
        {
            step: 15,
            title: 'Publikasi WebGIS',
            subtitle: 'Tahap akhir penelitian adalah melakukan deployment aplikasi WebGIS sehingga dapat diakses melalui browser',
            summary: 'Aplikasi dipublikasikan dengan repository yang memuat source code, data, hasil analisis, laporan, dan dokumentasi proyek.',
            icon: 'fas fa-rocket',
            data: [
                'Source code Google Earth Engine',
                'Source code WebGIS',
                'Data analisis, hasil evaluasi, laporan, dokumentasi'
            ],
            methods: [
                'Deployment WebGIS ke lingkungan publik',
                'Repository proyek disusun sesuai struktur README.md, gee/, webgis/, data/, results/, report/'
            ],
            parameters: [
                'Repository GitHub berisi: Source Code Google Earth Engine',
                'Repository GitHub berisi: Source Code WebGIS',
                'Repository GitHub berisi: Data Analisis, Hasil Evaluasi, Laporan, Dokumentasi'
            ],
            output: [
                'WebGIS siap diakses secara publik',
                'Dokumentasi penelitian lengkap tersedia'
            ]
        }
    ];

    const container = document.getElementById('timelineContainer');
    const renderPanel = (label, items, icon) => `
        <div class="timeline-detail-card">
            <div class="timeline-detail-title"><i class="${icon}"></i>${label}</div>
            <ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>
        </div>`;

    const renderSummary = (summary) => `
        <div class="timeline-summary-card">
            <div class="timeline-summary-title"><i class="fas fa-lightbulb"></i>Ringkasan</div>
            <p>${summary}</p>
        </div>`;

    container.innerHTML = `
        <div class="timeline-progress-card">
            <div class="timeline-progress-header">
                <div>
                    <div class="timeline-progress-title">Workflow Penelitian Lengkap</div>
                    <div class="timeline-progress-subtitle">15 tahapan dari input data hingga deployment WebGIS</div>
                </div>
                <div class="timeline-progress-badge">Step 1–15</div>
            </div>
            <div class="progress timeline-progress-bar" role="progressbar" aria-label="Workflow progress">
                <div class="progress-bar" style="width: 100%"></div>
            </div>
        </div>
        ${steps.map((s, index) => `
            <div class="timeline-item accordion-item ${index === 0 ? 'visible' : ''}">
                <h2 class="accordion-header">
                    <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapseStep${s.step}" aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="collapseStep${s.step}">
                        <div class="timeline-card-head">
                            <div class="timeline-step-badge">Step ${String(s.step).padStart(2, '0')}</div>
                            <div class="timeline-icon-pill"><i class="${s.icon}"></i></div>
                            <div class="timeline-card-copy">
                                <div class="timeline-title">${s.title}</div>
                                <div class="timeline-subtitle">${s.subtitle}</div>
                                <div class="timeline-mini-summary">${s.summary}</div>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="collapseStep${s.step}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#timelineContainer">
                    <div class="accordion-body">
                        ${renderSummary(s.summary)}
                        <div class="timeline-detail-grid">
                            ${renderPanel('Data', s.data, 'fas fa-database')}
                            ${renderPanel('Metode', s.methods, 'fas fa-cogs')}
                            ${renderPanel('Parameter', s.parameters, 'fas fa-sliders-h')}
                            ${renderPanel('Output', s.output, 'fas fa-bullseye')}
                        </div>
                    </div>
                </div>
            </div>
        `).join('')}
    `;
}

function animateTimeline() {
    const items = document.querySelectorAll('.timeline-item');
    items.forEach((item, i) => {
        setTimeout(() => item.classList.add('visible'), i * 80);
    });
}

// ===== Fade-in Observer =====
function initFadeInObserver() {
    const elements = document.querySelectorAll('.fade-in');
    elements.forEach((el, i) => {
        setTimeout(() => el.classList.add('visible'), i * 100 + 200);
    });
}

// ===== Footer Clock =====
function initClock() {
    function update() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById('footerClock').textContent = timeStr;
    }
    update();
    setInterval(update, 1000);
}

// ===== Initialize Everything =====
document.addEventListener('DOMContentLoaded', () => {
    initLoading();
    initTheme();
    initTabs();
    initSidebars();
    initTimeline();
    initClock();
    initChatbot();

    // Init map after a brief delay to allow DOM to settle
    setTimeout(() => {
        initMap();
        initMapTools();
        loadStatistics();
        createEvalCharts();
    }, 300);
});

// ===== AI Chatbot =====
function initChatbot() {
    const toggle = document.getElementById('chatbotToggle');
    const panel = document.getElementById('chatbotPanel');
    const closeBtn = document.getElementById('chatbotClose');
    const input = document.getElementById('chatbotInput');
    const sendBtn = document.getElementById('chatbotSend');
    const suggestions = document.querySelectorAll('.chat-suggestion');

    toggle.addEventListener('click', () => {
        const isOpen = panel.classList.contains('open');
        if (isOpen) {
            panel.classList.remove('open');
            toggle.classList.remove('active');
        } else {
            panel.classList.add('open');
            toggle.classList.add('active');
            input.focus();
        }
    });

    closeBtn.addEventListener('click', () => {
        panel.classList.remove('open');
        toggle.classList.remove('active');
    });

    sendBtn.addEventListener('click', () => sendChatMessage());
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    suggestions.forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.dataset.q;
            sendChatMessage();
        });
    });
}

function sendChatMessage() {
    const input = document.getElementById('chatbotInput');
    const msg = input.value.trim();
    if (!msg) return;

    addChatMessage(msg, 'user');
    input.value = '';

    // Show typing indicator
    const typingEl = addTypingIndicator();

    // Simulate AI thinking delay
    setTimeout(() => {
        typingEl.remove();
        const response = generateChatResponse(msg);
        addChatMessage(response, 'bot');
    }, 800 + Math.random() * 700);
}

function addChatMessage(content, type) {
    const container = document.getElementById('chatbotMessages');
    const div = document.createElement('div');
    div.className = `chat-message ${type}-message`;

    const icon = type === 'bot' ? 'fa-robot' : 'fa-user';
    div.innerHTML = `
        <div class="chat-avatar"><i class="fas ${icon}"></i></div>
        <div class="chat-bubble">${content}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addTypingIndicator() {
    const container = document.getElementById('chatbotMessages');
    const div = document.createElement('div');
    div.className = 'chat-message bot-message';
    div.id = 'typingIndicator';
    div.innerHTML = `
        <div class="chat-avatar"><i class="fas fa-robot"></i></div>
        <div class="chat-bubble">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
}

function generateChatResponse(question) {
    const q = question.toLowerCase();
    const s = APP.stats;

    // Knowledge base
    const kb = [
        {
            keywords: ['klasifikasi', 'kelas', 'kategori', 'jenis'],
            response: () => `Klasifikasi dalam penelitian ini menggunakan metode <strong>supervised classification</strong> dengan algoritma <strong>Random Forest</strong>. Data diklasifikasikan menjadi 2 kelas utama:<br><br>🌿 <strong>Kelas 1 - Vegetasi:</strong> Area yang terdeteksi memiliki tutupan vegetasi berdasarkan nilai NDVI tinggi dari citra Sentinel-2.<br><br>🏗️ <strong>Kelas 0 - Non-Vegetasi:</strong> Area seperti bangunan, jalan, badan air, dan lahan terbuka.<br><br>Model dilatih menggunakan <strong>400 titik ground truth</strong> dari tahun 2024 dan 2025, dengan pembagian data Training 70% dan Testing 30%.`
        },
        {
            keywords: ['akurasi', 'accuracy', 'performa', 'kinerja', 'evaluasi'],
            response: () => `Model Random Forest yang dibangun memiliki performa yang <strong>sangat baik</strong>:<br><br>🎯 <strong>Accuracy:</strong> 97,67% — tingkat kebenaran keseluruhan prediksi<br>🔍 <strong>Precision:</strong> 96,43% — ketepatan prediksi kelas vegetasi<br>📊 <strong>Recall:</strong> 99,26% — kemampuan mendeteksi seluruh vegetasi aktual<br>📈 <strong>F1 Score:</strong> 97,83% — keseimbangan antara precision dan recall<br><br>Confusion Matrix menunjukkan dari 258 data testing, hanya <strong>6 data</strong> yang salah diklasifikasikan (5 false positive dan 1 false negative).`
        },
        {
            keywords: ['luas', 'vegetasi', 'berapa', 'area'],
            response: () => {
                if (!s) return 'Data statistik belum dimuat. Silakan tunggu data selesai dimuat.';
                return `📊 <strong>Statistik Luas Vegetasi Kota Manado:</strong><br><br>🏙️ Luas Kota Manado: <strong>${s.Luas_Kota_Ha.toFixed(2)} Ha</strong><br>🌳 Vegetasi 2024: <strong>${s.Luas_Vegetasi_2024_Ha.toFixed(2)} Ha</strong><br>🌿 Vegetasi 2025: <strong>${s.Luas_Vegetasi_2025_Ha.toFixed(2)} Ha</strong><br><br>Terjadi perubahan sebesar <strong>${Math.abs(s.Net_Change_Ha).toFixed(2)} Ha</strong> (${s.Persentase_Perubahan >= 0 ? 'penambahan' : 'pengurangan'} ${Math.abs(s.Persentase_Perubahan).toFixed(2)}%).`;
            }
        },
        {
            keywords: ['random forest', 'algoritma', 'machine learning', 'model'],
            response: () => `🌲 <strong>Random Forest</strong> adalah algoritma machine learning ensemble yang mengkombinasikan banyak <em>decision tree</em> untuk membuat prediksi yang lebih akurat.<br><br><strong>Cara Kerja:</strong><br>1. Membuat banyak decision tree dari subset data acak (bagging)<br>2. Setiap tree memberikan "vote" untuk kelas prediksi<br>3. Kelas dengan vote terbanyak menjadi hasil akhir<br><br><strong>Keunggulan:</strong><br>• Akurasi tinggi untuk klasifikasi tutupan lahan<br>• Tahan terhadap overfitting<br>• Mampu menangani data multispektral dari Sentinel-2<br>• Dalam penelitian ini menghasilkan akurasi <strong>97,67%</strong>`
        },
        {
            keywords: ['ndvi', 'indeks', 'kehijauan'],
            response: () => `🌿 <strong>NDVI (Normalized Difference Vegetation Index)</strong> adalah indeks yang digunakan untuk mengukur tingkat kehijauan dan kesehatan vegetasi dari citra satelit.<br><br><strong>Rumus:</strong> NDVI = (NIR - Red) / (NIR + Red)<br><br>📊 <strong>Interpretasi Nilai:</strong><br>• <strong>-1 sampai 0:</strong> Air, awan, salju, atau tanah kosong<br>• <strong>0 sampai 0.2:</strong> Lahan kosong, batuan<br>• <strong>0.2 sampai 0.4:</strong> Vegetasi jarang/semak<br>• <strong>0.4 sampai 0.6:</strong> Vegetasi sedang<br>• <strong>0.6 sampai 1:</strong> Vegetasi lebat/hutan<br><br>Pada penelitian ini, NDVI dihitung dari band NIR dan Red pada citra <strong>Sentinel-2</strong> untuk tahun 2024 dan 2025.`
        },
        {
            keywords: ['sentinel', 'satelit', 'citra'],
            response: () => `🛰 <strong>Sentinel-2</strong> adalah misi observasi bumi dari European Space Agency (ESA) yang menyediakan citra multispektral resolusi tinggi.<br><br><strong>Spesifikasi:</strong><br>• 13 band spektral (visible, NIR, SWIR)<br>• Resolusi spasial: <strong>10m, 20m, 60m</strong><br>• Revisit time: <strong>5 hari</strong><br>• Cakupan: seluruh permukaan bumi<br><br>Pada penelitian ini digunakan:<br>📅 <strong>Sentinel-2 Tahun 2024</strong> — sebagai data baseline vegetasi<br>📅 <strong>Sentinel-2 Tahun 2025</strong> — sebagai data pembanding untuk deteksi perubahan<br><br>Data diproses melalui <strong>Google Earth Engine</strong> dengan cloud masking untuk mendapatkan citra bersih.`
        },
        {
            keywords: ['perubahan', 'change', 'gain', 'loss', 'bertambah', 'berkurang'],
            response: () => {
                if (!s) return 'Data statistik belum dimuat.';
                return `📈 <strong>Analisis Perubahan Vegetasi Kota Manado (2024-2025):</strong><br><br>✅ <strong>Gain (Vegetasi Bertambah):</strong> ${s.Gain_Ha.toFixed(2)} Ha — area yang berubah dari non-vegetasi menjadi vegetasi<br>❌ <strong>Loss (Vegetasi Berkurang):</strong> ${s.Loss_Ha.toFixed(2)} Ha — area yang berubah dari vegetasi menjadi non-vegetasi<br>🔄 <strong>Net Change:</strong> ${s.Net_Change_Ha > 0 ? '+' : ''}${s.Net_Change_Ha.toFixed(2)} Ha<br>📊 <strong>Persentase:</strong> ${s.Persentase_Perubahan >= 0 ? '+' : ''}${s.Persentase_Perubahan.toFixed(2)}%<br><br>🌲 <strong>Tetap Vegetasi:</strong> ${s.Tetap_Vegetasi_Ha.toFixed(2)} Ha<br>🏗️ <strong>Tetap Non-Vegetasi:</strong> ${s.Tetap_NonVegetasi_Ha.toFixed(2)} Ha<br><br>${s.Net_Change_Ha > 0 ? '✨ Hasil menunjukkan <strong>peningkatan</strong> tutupan vegetasi selama periode pengamatan.' : '⚠️ Hasil menunjukkan <strong>penurunan</strong> tutupan vegetasi selama periode pengamatan.'}`;
            }
        },
        {
            keywords: ['manado', 'kota', 'lokasi', 'wilayah', 'dimana'],
            response: () => `🏙️ <strong>Kota Manado</strong> adalah ibu kota Provinsi Sulawesi Utara, Indonesia.<br><br>📍 <strong>Koordinat:</strong> 1.4748° LU, 124.8421° BT<br>📐 <strong>Luas:</strong> ${s ? s.Luas_Kota_Ha.toFixed(2) + ' Ha' : '~16.306 Ha'}<br>🌊 Terletak di pesisir Teluk Manado<br><br>Kota ini memiliki tutupan vegetasi yang penting untuk ekosistem perkotaan, termasuk hutan kota, taman, dan area hijau. Analisis perubahan vegetasi ini penting untuk mendukung perencanaan kota yang berkelanjutan.`
        },
        {
            keywords: ['peta', 'layer', 'map', 'warna'],
            response: () => `🗺 <strong>Layer Peta WebGIS:</strong><br><br>Peta interaktif ini menampilkan beberapa layer:<br><br>🟢 <strong>Vegetasi 2024</strong> (Hijau Muda) — tutupan vegetasi tahun 2024<br>🟩 <strong>Vegetasi 2025</strong> (Hijau Tua) — tutupan vegetasi tahun 2025<br>🔵 <strong>Gain</strong> (Biru) — area vegetasi yang bertambah<br>🔴 <strong>Loss</strong> (Merah) — area vegetasi yang berkurang<br>🔷 <strong>Batas Kota</strong> (Biru Tua) — batas administrasi Kota Manado<br><br>💡 <strong>Tips:</strong> Gunakan panel Layer Control di sidebar kiri untuk menghidupkan/mematikan layer dan mengatur opacity.`
        },
        {
            keywords: ['ground truth', 'data latih', 'training', 'testing'],
            response: () => `📌 <strong>Ground Truth & Data Training:</strong><br><br>Ground truth dikumpulkan melalui <strong>interpretasi visual manual</strong> pada citra Sentinel-2 untuk menentukan kelas tutupan lahan (vegetasi/non-vegetasi).<br><br>📊 <strong>Total Data:</strong> 400 titik<br>• Tahun 2024: 200 titik<br>• Tahun 2025: 200 titik<br><br>📂 <strong>Pembagian Data:</strong><br>• Training: <strong>70%</strong> (280 titik) — untuk melatih model<br>• Testing: <strong>30%</strong> (120 titik) — untuk menguji akurasi model<br><br>Data ini digunakan sebagai input untuk algoritma Random Forest dalam proses klasifikasi tutupan lahan.`
        },
        {
            keywords: ['confusion matrix', 'matriks'],
            response: () => `📊 <strong>Confusion Matrix:</strong><br><br><table style='border-collapse:collapse;width:100%;font-size:0.8rem;'><tr><th style='padding:6px;border:1px solid #ccc;background:#f5f5f5;'>Aktual\\Prediksi</th><th style='padding:6px;border:1px solid #ccc;background:#f5f5f5;'>0</th><th style='padding:6px;border:1px solid #ccc;background:#f5f5f5;'>1</th></tr><tr><td style='padding:6px;border:1px solid #ccc;font-weight:bold;'>0</td><td style='padding:6px;border:1px solid #ccc;background:#e8f5e9;color:#2e7d32;font-weight:bold;'>117 ✓</td><td style='padding:6px;border:1px solid #ccc;background:#ffebee;color:#c62828;'>5 ✗</td></tr><tr><td style='padding:6px;border:1px solid #ccc;font-weight:bold;'>1</td><td style='padding:6px;border:1px solid #ccc;background:#ffebee;color:#c62828;'>1 ✗</td><td style='padding:6px;border:1px solid #ccc;background:#e8f5e9;color:#2e7d32;font-weight:bold;'>135 ✓</td></tr></table><br>• <strong>True Negative (117):</strong> Non-vegetasi diprediksi benar<br>• <strong>True Positive (135):</strong> Vegetasi diprediksi benar<br>• <strong>False Positive (5):</strong> Non-vegetasi diprediksi sebagai vegetasi<br>• <strong>False Negative (1):</strong> Vegetasi diprediksi sebagai non-vegetasi`
        },
        {
            keywords: ['gee', 'google earth engine', 'earth engine'],
            response: () => `🌍 <strong>Google Earth Engine (GEE)</strong> adalah platform analisis geospasial berbasis cloud dari Google.<br><br><strong>Fitur Utama:</strong><br>• Akses ke petabyte data satelit (termasuk Sentinel-2, Landsat, MODIS)<br>• Pemrosesan paralel di server Google<br>• API berbasis JavaScript dan Python<br>• Gratis untuk riset dan edukasi<br><br><strong>Dalam penelitian ini GEE digunakan untuk:</strong><br>1. Mengakses citra Sentinel-2 tahun 2024 dan 2025<br>2. Melakukan cloud masking<br>3. Menghitung NDVI<br>4. Menjalankan algoritma Random Forest<br>5. Mengekspor hasil klasifikasi sebagai GeoJSON`
        },
        {
            keywords: ['webgis', 'web gis', 'leaflet', 'teknologi'],
            response: () => `💻 <strong>WebGIS Dashboard</strong> ini dibangun menggunakan teknologi web modern:<br><br>📦 <strong>Tech Stack:</strong><br>• HTML5, CSS3, JavaScript<br>• Bootstrap 5 — framework UI responsive<br>• Leaflet.js — peta interaktif<br>• Chart.js — grafik dan visualisasi<br>• PapaParse — pembaca file CSV<br>• Font Awesome — ikon modern<br>• html2canvas — screenshot & export<br><br>🎨 <strong>Fitur Desain:</strong><br>• Dark/Light mode<br>• Glassmorphism effects<br>• Responsive layout<br>• Animasi halus<br>• AI Chatbot (saya! 🤖)`
        },
        {
            keywords: ['halo', 'hai', 'hello', 'hi', 'hey'],
            response: () => `Halo! 👋 Senang bertemu dengan Anda! Saya <strong>GeoBot</strong>, asisten AI untuk WebGIS Analisis Vegetasi Kota Manado.<br><br>Saya siap membantu menjawab pertanyaan tentang:<br>• 🌿 Klasifikasi vegetasi<br>• 📊 Data statistik perubahan<br>• 🤖 Algoritma Random Forest<br>• 🛰 Sentinel-2 & NDVI<br>• 🗺 Layer peta<br><br>Silakan tanyakan apa saja! 😊`
        },
        {
            keywords: ['terima kasih', 'makasih', 'thanks', 'thank'],
            response: () => `Sama-sama! 😊 Senang bisa membantu Anda memahami analisis vegetasi Kota Manado. Jangan ragu untuk bertanya lagi jika ada yang ingin diketahui! 🌿🗺`
        }
    ];

    // Find best matching response
    let bestMatch = null;
    let bestScore = 0;

    for (const entry of kb) {
        let score = 0;
        for (const keyword of entry.keywords) {
            if (q.includes(keyword)) {
                score += keyword.length; // Longer keyword matches get higher score
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = entry;
        }
    }

    if (bestMatch && bestScore > 0) {
        return bestMatch.response();
    }

    // Default response
    return `Terima kasih atas pertanyaannya! 🤔 Saya belum memiliki informasi spesifik tentang topik tersebut. Namun saya bisa membantu Anda dengan:<br><br>• 🌿 <strong>"Klasifikasi"</strong> — tentang kelas vegetasi<br>• 📊 <strong>"Luas vegetasi"</strong> — statistik area<br>• 🤖 <strong>"Random Forest"</strong> — tentang algoritma ML<br>• 🛰 <strong>"NDVI"</strong> atau <strong>"Sentinel-2"</strong> — tentang data satelit<br>• 📈 <strong>"Perubahan vegetasi"</strong> — analisis gain/loss<br>• 🎯 <strong>"Akurasi"</strong> — evaluasi model<br>• 🗺 <strong>"Peta"</strong> — tentang layer & fitur peta<br><br>Silakan coba salah satu topik di atas! 😊`;
}
