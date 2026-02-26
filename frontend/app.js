// Initialize Map (Centered on US)
const map = L.map('map').setView([39.8283, -98.5795], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];

// Color Map for Categories
const categoryColors = {
    mining: "orange",
    logging: "green",
    land_transfer: "red",
    conservation_rollback: "darkred",
    other: "blue"
};

// Define sizes based on impact
const impactSizes = {
    high: 15,   // Big visible circle
    medium: 10, // Standard circle
    low: 6      // Small subtle circle
};

// Inside your data.forEach loop in handleSearch():
const marker = L.circleMarker([coord.lat, coord.lng], {
    // USE IMPACT TO SET RADIUS
    radius: impactSizes[event.impact] || 8, 
    
    fillColor: categoryColors[event.category] || "blue",
    color: "#fff",
    weight: 2,
    fillOpacity: event.impact === 'high' ? 0.9 : 0.6 // Make high impact more solid
}).addTo(map);

// Add a label to the popup so the user knows the impact
marker.bindPopup(`
    <div style="border-bottom: 1px solid #ddd; margin-bottom:5px;">
        <strong style="text-transform:uppercase; color:red;">${event.impact} IMPACT</strong>
    </div>
    <strong>${event.title}</strong><br>
    <p>${event.summary}</p>
`);

async function handleSearch() {
    const query = document.getElementById('search-input').value;
    const listContainer = document.getElementById('results-list');
    
    listContainer.innerHTML = "<p style='padding:15px'>Analyzing documents...</p>";
    clearMarkers();

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        listContainer.innerHTML = "";
        
        data.forEach(event => {
            // 1. Add to Sidebar
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <span class="tag ${event.category}">${event.category}</span>
                <div style="font-weight:bold; margin-top:5px;">${event.title}</div>
                <div style="font-size:12px; color:#666">${event.publication_date}</div>
            `;
            
            // 2. Add Pins to Map
            event.coordinates.forEach(coord => {
                const marker = L.circleMarker([coord.lat, coord.lng], {
                    radius: 8,
                    fillColor: categoryColors[event.category] || "blue",
                    color: "#fff",
                    weight: 2,
                    fillOpacity: 0.8
                }).addTo(map);

                marker.bindPopup(`
                    <strong>${event.title}</strong><br>
                    <p>${event.summary}</p>
                    <a href="${event.federal_register_url}" target="_blank">View Document</a>
                `);

                // Sync sidebar click to map
                item.onclick = () => {
                    map.setView([coord.lat, coord.lng], 7);
                    marker.openPopup();
                };

                markers.push(marker);
            });

            listContainer.appendChild(item);
        });
    } catch (err) {
        listContainer.innerHTML = "<p style='padding:15px'>Error connecting to backend.</p>";
    }
}

function clearMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
}

// Initial Load
handleSearch();