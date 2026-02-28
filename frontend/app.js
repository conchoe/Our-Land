// 1. "Buffered" Bounds
const usBounds = L.latLngBounds(
    L.latLng(5.0, -179.0),
    L.latLng(75.0, -50.0)
);

// 2. Define the base topo map
// 1. The Bottom Layer: Natural Terrain (No labels)
const terrainBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 13,
    noWrap: true
});

// 2. The Top Layer: Transparent State Borders & Names
const stateLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Reference_Overlay/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Labels &copy; Esri',
    opacity: 0.8, // Slightly faded so it doesn't distract from the land
    noWrap: true
});

const landOverlay = L.layerGroup();

// 3. Initialize the Map with BOTH layers
const map = L.map('map', {
    center: [39.8283, -98.5795],
    zoom: 4,
    minZoom: 3,
    maxBounds: usBounds,
    maxBoundsViscosity: 0.8,
    layers: [terrainBase, stateLabels] // This stacks them!
});

// 4. Update your Toggle Control
const overlays = {
    "🌿 Public Land Boundaries": landOverlay,
    "📍 State Names & Borders": stateLabels // Now users can hide labels if they want!
};
L.control.layers(null, overlays).addTo(map);

let markers = [];

// 1. Color Map (Ensuring these match your AI categories)
const categoryColors = {
    mining: "orange",
    logging: "green",
    land_transfer: "red",
    conservation_rollback: "darkred",
    other: "blue"
};

// 2. Size Map
const impactSizes = {
    high: 15,
    medium: 10,
    low: 6
};

async function handleSearch() {
    const query = document.getElementById('searchQuery').value;
    const modeSelect = document.getElementById('search-mode');
    const mode = modeSelect ? modeSelect.value : 'recent';

    const listContainer = document.getElementById('results-list');
    listContainer.innerHTML = "<p style='padding:15px'>Analyzing documents...</p>";
    clearMarkers();

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/search?q=${encodeURIComponent(query)}&mode=${mode}`);
        const data = await response.json();

        listContainer.innerHTML = "";
        if (!response.ok || !Array.isArray(data)) {
            listContainer.innerHTML = "<p style='padding:15px'>Error loading results.</p>";
            return;
        }

        data.forEach(event => {
            const impact = (event.impact || 'low').toLowerCase();
            const category = (event.category || 'other').toLowerCase();
            const envEffect = (event.environment_effect || 'neutral').toLowerCase();

            const envLabel = envEffect === 'beneficial' ? '🌿 Beneficial' : envEffect === 'detrimental' ? '⚠️ Detrimental' : '— Neutral';
            const envClass = envEffect === 'beneficial' ? 'env-beneficial' : envEffect === 'detrimental' ? 'env-detrimental' : 'env-neutral';

            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <span class="tag ${category}">${category.replace('_', ' ')}</span>
                <span class="tag ${envClass}">${envLabel}</span>
                <div style="font-weight:bold; margin-top:5px; font-size: 16px;">${event.title}</div>
                <div style="font-size:12px; color:var(--sage-green); margin-top: 5px;">
                    📅 ${event.publication_date} | <strong>${impact.toUpperCase()} IMPACT</strong>
                </div>
            `;
            listContainer.appendChild(item); // Add to sidebar immediately

            // 2. Add Pins to Map (guard against missing coordinates)
            const coords = event.coordinates || [];
            coords.forEach((coord, index) => {
                const marker = L.circleMarker([coord.lat, coord.lng], {
                    radius: impactSizes[impact] || 8,
                    fillColor: categoryColors[category] || "blue",
                    color: "#fff",
                    weight: 2,
                    fillOpacity: impact === 'high' ? 0.9 : 0.6
                }).addTo(map);

                marker.bindPopup(`
                    <div style="border-bottom: 1px solid #ddd; margin-bottom:5px;">
                        <strong style="color:${impact === 'high' ? 'red' : 'black'};">${impact.toUpperCase()} IMPACT</strong>
                        · <span style="color:${envEffect === 'beneficial' ? '#2d7d46' : envEffect === 'detrimental' ? '#c41e3a' : '#6c757d'}">${envLabel}</span>
                    </div>
                    <strong>${event.title}</strong><br>
                    <p>${event.summary}</p>
                    <a href="${event.federal_register_url}" target="_blank">View Document</a>
                `);

                if (index === 0) {
                    item.onclick = () => {
                        map.setView([coord.lat, coord.lng], 7);
                        marker.openPopup();
                    };
                }
                markers.push(marker);
            });
            // If no coordinates, clicking the item still focuses the map on US center
            if (coords.length === 0) {
                item.onclick = () => map.setView([39.8283, -98.5795], 4);
            }
        });
    } catch (err) {
        console.error(err); // Log the actual error to the console
        listContainer.innerHTML = "<p style='padding:15px'>Error connecting to backend.</p>";
    }
}

function clearMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
}

document.getElementById("searchQuery").addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        handleSearch();
    }
});

// 1. Define the colors for the different agencies
const agencyColors = {
    'NPS': '#353d2f', // Your Charcoal Brown (Dark Green)
    'USFS': '#6ba368', // Your Sage Green
    'BLM': '#ffd8a8',  // Yellowish/Orange
    'FWS': '#9cfc97',  // Light Green
    'default': '#515b3a'
};

// 2. Function to style the polygons
function styleLand(feature) {
    // Since this dataset is for National Parks, we default the agency to 'NPS'
    const agency = feature.properties.AGENCY || 'NPS';
    return {
        fillColor: agencyColors[agency] || agencyColors['default'],
        weight: 1,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.4 // Keep it transparent so the Topo map shows through
    };
}

// 3. Load the data
fetch('nps_boundary.json') // You'll put your downloaded file here
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleLand,
            onEachFeature: function (feature, layer) {
                const parkName = feature.properties.UNIT_NAME || 'Unknown Area';
                const parkType = feature.properties.UNIT_TYPE || 'National Park Service';
                layer.bindPopup(`<strong>${parkName}</strong><br>${parkType}`);
            }
        }).addTo(landOverlay);
    });