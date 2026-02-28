// 1. "Buffered" Bounds
const usBounds = L.latLngBounds(
    L.latLng(5.0, -179.0),
    L.latLng(75.0, -50.0)
);

// 2. Define the base topo map
const topoLayer = L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles courtesy of the U.S. Geological Survey',
    noWrap: true
});

// 3. Create the layer group for the green boundaries
const landOverlay = L.layerGroup();

// 4. Initialize the map
const map = L.map('map', {
    center: [39.8283, -98.5795],
    zoom: 4,
    minZoom: 3,
    maxBounds: usBounds,
    maxBoundsViscosity: 0.8,
    worldCopyJump: false,
    layers: [topoLayer] // FIXED: Matches the variable name exactly
});

// 5. Add the Toggle Control
const overlays = {
    "🌿 Public Land Boundaries": landOverlay
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

        data.forEach(event => {
            // Standardize impact and category to lowercase for safe matching
            const impact = (event.impact || 'low').toLowerCase();
            const category = (event.category || 'other').toLowerCase();

            // 1. Create the Sidebar Item
            const item = document.createElement('div');
            item.className = 'result-item';
            // Ensure the tag class matches the category name exactly (lowercase)
            item.innerHTML = `
                <span class="tag ${category}">${category.replace('_', ' ')}</span>
                <div style="font-weight:bold; margin-top:5px; font-size: 16px;">${event.title}</div>
                <div style="font-size:12px; color:var(--sage-green); margin-top: 5px;">
                    📅 ${event.publication_date} | <strong>${impact.toUpperCase()} IMPACT</strong>
                </div>
            `;
            listContainer.appendChild(item); // Add to sidebar immediately

            // 2. Add Pins to Map
            event.coordinates.forEach((coord, index) => {
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
                    </div>
                    <strong>${event.title}</strong><br>
                    <p>${event.summary}</p>
                    <a href="${event.federal_register_url}" target="_blank">View Document</a>
                `);

                // Fix: If it's the first coordinate, link it to the sidebar click
                if (index === 0) {
                    item.onclick = () => {
                        map.setView([coord.lat, coord.lng], 7);
                        marker.openPopup();
                    };
                }

                markers.push(marker);
            });
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
    // This assumes your GeoJSON has a property like 'AGENCY' or 'OWNER'
    const agency = feature.properties.AGENCY || 'default';
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
                layer.bindPopup(`<strong>${feature.properties.NAME}</strong><br>${feature.properties.AGENCY}`);
            }
        }).addTo(landOverlay);
    });