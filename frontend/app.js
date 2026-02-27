// Initialize Map (Centered on US)
// 1. "Buffered" Bounds: Extra space so the user can center coastal areas
const usBounds = L.latLngBounds(
    L.latLng(5.0, -179.0),  // Far South/West (Enough to center Hawaii/Aleutians)
    L.latLng(75.0, -50.0)   // Far North/East (Enough to center Alaska/Maine)
);

// 2. Initialize the map
const map = L.map('map', {
    center: [39.8283, -98.5795],
    zoom: 4,
    minZoom: 3, 
    maxBounds: usBounds,
    maxBoundsViscosity: 0.8, // 0.8 feels "softer" and more premium than 1.0
    worldCopyJump: false     // Prevents the map from repeating if you pan far
});

// 3. Tile Layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    noWrap: true             // Crucial: stops the "infinite loop" of the world
}).addTo(map);

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

document.getElementById("searchQuery").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        handleSearch();
    }
});
