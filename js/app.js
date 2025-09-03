// Initialize map
let map = new maplibregl.Map({
	container: "map",
	style: `https://api.maptiler.com/maps/hybrid/style.json?key=${config.MAPTILER_KEY}`,
	center: [13.268969332277585, 57.47291624111792], // Custom coordinates
	zoom: 18, // Increased zoom for better satellite detail
	maxZoom: 20,
	minZoom: 14,
});

// Global variables
let currentLocationId = null;
const markers = new Map(); // To store markers for easy access
let selectedCoordinates = null; // To store coordinates for new location

// Initialize map and add markers
function initializeMap() {
	// Add navigation controls
	map.addControl(new maplibregl.NavigationControl());

	// Add scale control
	map.addControl(
		new maplibregl.ScaleControl({
			maxWidth: 80,
			unit: "metric",
		}),
	);

	// Add geolocation control
	map.addControl(
		new maplibregl.GeolocateControl({
			positionOptions: {
				enableHighAccuracy: true,
			},
			trackUserLocation: true,
			showUserHeading: true,
		}),
	);

	// Add markers for each location
	getLocations()
		.then((locations) => {
			locations.forEach((location) => {
				// Create marker element
				const el = document.createElement("div");
				el.className = "marker";

				// Create the marker with configuration
				const marker = new maplibregl.Marker({
					element: el,
					clickTolerance: 3,
					draggable: false,
				})
					.setLngLat(location.coordinates)
					.addTo(map);

				// Store marker reference
				markers.set(location.id, marker);

				// Add click event to marker element
				marker.getElement().addEventListener("click", (e) => {
					e.stopPropagation();
					showLocationDetails(location.id);
				});
			});
		})
		.catch((error) => {
			console.error("Error loading locations:", error);
		});
}

// Show location details in sidebar
async function showLocationDetails(locationId) {
	const location = await getLocationById(locationId);
	if (!location) return;

	currentLocationId = locationId;

	// Update sidebar title
	document.getElementById("location-title").textContent = location.name;

	// Update maintenance info
	const maintenanceHtml = `
        <p>${location.maintenanceInfo.description}</p>
        <h4>General Care:</h4>
        <ul>
            ${location.maintenanceInfo.care.map((item) => `<li>${item}</li>`).join("")}
        </ul>
        <h4>Seasonal Tasks:</h4>
        ${Object.entries(location.maintenanceInfo.seasonalTasks)
			.map(
				([season, tasks]) => `
            <h5>${season.charAt(0).toUpperCase() + season.slice(1)}:</h5>
            <ul>
                ${tasks.map((task) => `<li>${task}</li>`).join("")}
            </ul>
        `,
			)
			.join("")}
    `;
	document.getElementById("maintenance-info").innerHTML = maintenanceHtml;

	// Update tasks list
	updateTasksList(location);

	// Show sidebar with animation
	const sidebar = document.getElementById("sidebar");
	sidebar.style.display = "block";
	// Force reflow
	sidebar.offsetHeight;
	sidebar.classList.remove("hidden");
}

// Update tasks list
function updateTasksList(location) {
	const tasksHtml = location.tasks
		.map(
			(task) => `
        <div class="task-item ${task.completed ? "completed" : ""}" data-task-id="${task.id}">
            <div class="task-header">
                <span class="task-title">${task.title}</span>
                <span class="task-status ${task.completed ? "done" : ""}"
                      onclick="toggleTask('${task.id}')">
                    ${task.completed ? "Done" : "Pending"}
                </span>
            </div>
            <p>${task.description}</p>
            <small>Added: ${task.dateAdded}</small>
        </div>
    `,
		)
		.join("");

	document.getElementById("tasks-list").innerHTML = tasksHtml;
}

// Toggle task completion
async function toggleTask(taskId) {
	if (currentLocationId && (await toggleTaskCompletion(currentLocationId, taskId))) {
		const location = await getLocationById(currentLocationId);
		updateTasksList(location);
	}
}

// Handle new task form submission
async function handleNewTaskSubmission(event) {
	event.preventDefault();

	if (!currentLocationId) return;

	const titleInput = document.getElementById("task-title");
	const descriptionInput = document.getElementById("task-description");

	const newTask = {
		title: titleInput.value,
		description: descriptionInput.value,
	};

	const addedTask = await addTask(currentLocationId, newTask);
	if (addedTask) {
		// Reset form
		titleInput.value = "";
		descriptionInput.value = "";

		// Update tasks list
		const location = await getLocationById(currentLocationId);
		updateTasksList(location);
	}
}

// Add new location handling
function showLocationSheet() {
	const sheet = document.getElementById("location-sheet");
	sheet.style.display = "block";
	sheet.offsetHeight; // Force reflow
	sheet.classList.remove("hidden");

	// Enable location picking mode
	map.getCanvas().style.cursor = "crosshair";
}

function hideLocationSheet() {
	const sheet = document.getElementById("location-sheet");
	sheet.classList.add("hidden");
	sheet.addEventListener(
		"transitionend",
		() => {
			if (sheet.classList.contains("hidden")) {
				sheet.style.display = "none";
			}
		},
		{ once: true },
	);

	// Disable location picking mode
	map.getCanvas().style.cursor = "";
	selectedCoordinates = null;
	document.getElementById("selected-coordinates").textContent = "Click on the map to set location";
}

async function handleLocationSubmit(event) {
	event.preventDefault();

	if (!selectedCoordinates) {
		alert("Please select a location on the map first");
		return;
	}

	const locationData = {
		name: document.getElementById("location-name").value,
		coordinates: selectedCoordinates,
		description: document.getElementById("location-description").value,
		care: document.getElementById("care-instructions").value,
		seasonalTasks: {
			spring: document.getElementById("spring-tasks").value,
			summer: document.getElementById("summer-tasks").value,
			fall: document.getElementById("fall-tasks").value,
			winter: document.getElementById("winter-tasks").value,
		},
	};

	const newLocation = await addLocation(locationData);

	if (newLocation) {
		// Add marker for new location
		const el = document.createElement("div");
		el.className = "marker";

		const marker = new maplibregl.Marker({
			element: el,
			clickTolerance: 3,
			draggable: false,
		})
			.setLngLat(newLocation.coordinates)
			.addTo(map);

		markers.set(newLocation.id, marker);

		marker.getElement().addEventListener("click", (e) => {
			e.stopPropagation();
			showLocationDetails(newLocation.id);
		});

		// Reset form and hide sheet
		event.target.reset();
		hideLocationSheet();
	}
}

// Event listeners
document.addEventListener("DOMContentLoaded", async () => {
	try {
		// Initialize map
		initializeMap();

		// Add event listener for close button
		document.getElementById("close-sidebar").addEventListener("click", () => {
			const sidebar = document.getElementById("sidebar");
			sidebar.classList.add("hidden");
			// Wait for transition to complete before hiding
			sidebar.addEventListener(
				"transitionend",
				() => {
					if (sidebar.classList.contains("hidden")) {
						sidebar.style.display = "none";
					}
				},
				{ once: true },
			);
			currentLocationId = null;
		});

		// Add event listener for new task form
		document.getElementById("add-task-form").addEventListener("submit", handleNewTaskSubmission);

		// Initialize sidebar state
		const sidebar = document.getElementById("sidebar");
		sidebar.style.display = "none";
		sidebar.classList.add("hidden");
	} catch (error) {
		console.error("Error initializing application:", error);
	}

	// Add location sheet event listeners
	document.getElementById("add-location-btn").addEventListener("click", showLocationSheet);
	document.getElementById("close-location-sheet").addEventListener("click", hideLocationSheet);
	document.getElementById("cancel-location").addEventListener("click", hideLocationSheet);
	document.getElementById("add-location-form").addEventListener("submit", handleLocationSubmit);

	// Add map click handler for location selection
	map.on("click", (e) => {
		if (!document.getElementById("location-sheet").classList.contains("hidden")) {
			selectedCoordinates = [e.lngLat.lng, e.lngLat.lat];
			document.getElementById("selected-coordinates").textContent = `[${selectedCoordinates[0].toFixed(6)}, ${selectedCoordinates[1].toFixed(6)}]`;
		}
	});
});

// Add map load event listener
map.on("load", () => {
	// Map is ready to use
	console.log("Map loaded successfully");
});
