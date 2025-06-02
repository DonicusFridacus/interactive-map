const openWeatherKey = '676384e36581189832dfabfe1a4c08b4';
const philippinesCoords = [12.8797, 121.7740];
const map = L.map('map').setView(philippinesCoords, 6);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const esriSat = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Earthstar Geographics'
  }
);

L.control.layers({
  'Street View (OSM)': osm,
  'Satellite View (ESRI)': esriSat
}).addTo(map);

let marker;
let routeLine;
let lastClickedCoords = null;

map.on('click', function (e) {
  const { lat, lng } = e.latlng;
  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lng]).addTo(map);
  marker.bindPopup(`Latitude: ${lat.toFixed(4)}, Longitude: ${lng.toFixed(4)}`).openPopup();
  updateLocationInfo(lat, lng);
});

function searchLocation() {
  const query = document.getElementById('search').value;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Philippines')}`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        map.setView([lat, lon], 12);

        if (marker) map.removeLayer(marker);
        marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup(`${query}`).openPopup();
        updateLocationInfo(lat, lon);
      } else {
        alert('Location not found!');
      }
    })
    .catch(err => {
      console.error(err);
      alert('Error fetching location');
    });
}

function updateLocationInfo(lat, lon) {
  lastClickedCoords = { lat, lon };

  // Reverse geocoding
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
    .then(res => res.json())
    .then(data => {
      const displayName = data.display_name || 'Unknown Location';
      document.getElementById('location-name').textContent = displayName;
    });

  // Weather
  fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${openWeatherKey}`)
    .then(res => res.json())
    .then(data => {
      const temp = data.main.temp;
      const weather = data.weather[0].description;
      document.getElementById('weather').textContent = `Weather: ${weather}, Temp: ${temp}°C`;
    })
    .catch(() => {
      document.getElementById('weather').textContent = 'Weather data not available.';
    });

  // Attractions
  fetchAttractions(lat, lon);
}

function saveLocation() {
  if (!lastClickedCoords) return alert('Click on a location first.');
  const saved = JSON.parse(localStorage.getItem('locations') || '[]');
  saved.push(lastClickedCoords);
  localStorage.setItem('locations', JSON.stringify(saved));
  loadSavedLocations();
}

function loadSavedLocations() {
  const ul = document.getElementById('saved-locations');
  ul.innerHTML = '';
  const saved = JSON.parse(localStorage.getItem('locations') || '[]');

  saved.forEach((loc, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      Location ${i + 1}: ${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)} 
      <button style="margin-left: 10px;" onclick="viewLocation(${i})">View</button>
      <button style="margin-left: 5px;" onclick="deleteLocation(${i})">Delete</button>
    `;
    ul.appendChild(li);
  });
}

function viewLocation(index) {
  const saved = JSON.parse(localStorage.getItem('locations') || '[]');
  const loc = saved[index];
  map.setView([loc.lat, loc.lon], 12);
  if (marker) map.removeLayer(marker);
  marker = L.marker([loc.lat, loc.lon]).addTo(map);
  marker.bindPopup(`Saved Location`).openPopup();
  updateLocationInfo(loc.lat, loc.lon);
}

function deleteLocation(index) {
  let saved = JSON.parse(localStorage.getItem('locations') || '[]');
  saved.splice(index, 1);
  localStorage.setItem('locations', JSON.stringify(saved));
  loadSavedLocations();
}

function drawRoute() {
  const saved = JSON.parse(localStorage.getItem('locations') || '[]');
  if (saved.length < 2) {
    alert('You need at least two saved locations to draw a route.');
    return;
  }

  const latlngs = saved.map(loc => [loc.lat, loc.lon]);

  if (routeLine) {
    map.removeLayer(routeLine);
  }

  routeLine = L.polyline(latlngs, { color: 'blue', weight: 4 }).addTo(map);
  map.fitBounds(routeLine.getBounds());
}

function fetchAttractions(lat, lon) {
  const radius = 5000;
  const query = `
    [out:json];
    (
      node["tourism"="attraction"](around:${radius},${lat},${lon});
      way["tourism"="attraction"](around:${radius},${lat},${lon});
      relation["tourism"="attraction"](around:${radius},${lat},${lon});
    );
    out center tags;
  `;

  fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query
  })
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById('attractions');
      list.innerHTML = '';

      const seen = new Set();
      data.elements.forEach(element => {
        const tags = element.tags || {};
        const name = tags.name;
        const wikidata = tags.wikidata || tags['wikidata'];
        const wikipedia = tags.wikipedia;

        if (!name || seen.has(name)) return;
        seen.add(name);

        const li = document.createElement('li');
        li.textContent = name;

        list.appendChild(li);
      });

      if (list.children.length === 0) {
        list.innerHTML = `<li>No nearby attractions found.</li>`;
      }
    })
    .catch(() => {
      document.getElementById('attractions').innerHTML = '<li>Unable to load attractions.</li>';
    });
}

// Dark mode toggle logic
const toggle = document.getElementById('darkModeToggle');
const body = document.body;

// Check if preference is already saved
const savedPreference = localStorage.getItem('darkMode');

if (savedPreference !== null) {
  // Use saved preference
  if (savedPreference === 'true') {
    toggle.checked = true;
    body.classList.add('dark');
  }
} else {
  // Auto-detect system preference on first load
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) {
    toggle.checked = true;
    body.classList.add('dark');
  }
}

(async () => {
  const res = await fetch("/api/check-auth");
  const data = await res.json();
  if (!data.authenticated) {
    window.location.href = "login.html";
  }
})();

// Listen for manual toggle
toggle.addEventListener('change', () => {
  if (toggle.checked) {
    body.classList.add('dark');
    localStorage.setItem('darkMode', 'true');
  } else {
    body.classList.remove('dark');
    localStorage.setItem('darkMode', 'false');
  }
});

window.onload = loadSavedLocations;