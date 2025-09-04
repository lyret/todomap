// Custom control for adding locations
class AddLocationControl {
	onAdd(map) {
		this._map = map;
		this._container = document.createElement("div");
		this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
		this._button = document.createElement("button");
		this._button.type = "button";
		this._button.className = "add-location-control";
		this._button.setAttribute("aria-label", "Add Location");
		this._button.innerHTML = "<span>✿</span>";
		this._button.addEventListener("click", () => showLocationSheet());
		this._container.appendChild(this._button);
		return this._container;
	}

	onRemove() {
		this._container.parentNode.removeChild(this._container);
		this._map = undefined;
	}
}

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
let isLocationPickingMode = false; // Track if we're picking a location
let viewedDate = new Date(); // Current viewed date for filtering tasks

// Initialize map and add markers
function initializeMap() {
	// Add navigation and location controls
	map.addControl(new maplibregl.NavigationControl());
	map.addControl(new AddLocationControl(), "top-right");

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

	// Update location info with markdown rendering
	const locationInfoHtml = `
        <div class="location-info">
            ${renderMarkdown(location.info)}
        </div>
    `;
	document.getElementById("location-info").innerHTML = locationInfoHtml;

	// Update tasks list
	updateTasksList(location, viewedDate);

	// Show sidebar with animation
	const sidebar = document.getElementById("sidebar");
	sidebar.style.display = "block";
	// Force reflow
	sidebar.offsetHeight;
	sidebar.classList.remove("hidden");
}

// Update tasks list
function updateTasksList(location, currentViewedDate = new Date()) {
	const tasksHtml = location.tasks
		.map((task) => {
			const isActive = new Date(task.dateToStart) <= currentViewedDate;
			const taskClass = task.completed ? "completed" : isActive ? "" : "inactive";
			const statusClass = task.completed ? "done" : isActive ? "" : "inactive";
			const statusText = task.completed
				? new Date(task.dateCompleted).toLocaleDateString()
				: isActive
					? "Pending"
					: `Starts ${new Date(task.dateToStart).toLocaleDateString()}`;

			return `
        <div class="task-item ${taskClass}" data-task-id="${task.id}">
            <div class="task-header">
                <span class="task-title">${task.title}</span>
                <span class="task-status ${statusClass}"
                      onclick="toggleTask('${task.id}')">
                    ${statusText}
                    ${task.tries > 0 ? `<span class="tries">↻${task.tries}</span>` : ""}
                </span>
            </div>
            <p>${task.description}</p>
            <small>Start: ${new Date(task.dateToStart).toLocaleDateString()}</small>
        </div>
    `;
		})
		.join("");

	document.getElementById("tasks-list").innerHTML = tasksHtml;
}

// Toggle task completion
async function toggleTask(taskId) {
	if (currentLocationId && (await toggleTaskCompletion(currentLocationId, taskId))) {
		const location = await getLocationById(currentLocationId);
		updateTasksList(location, viewedDate);
	}
}

// Handle new task form submission
async function handleNewTaskSubmission(event) {
	event.preventDefault();

	if (!currentLocationId) return;

	const taskInfoInput = document.getElementById("task-info");
	const taskStartDateInput = document.getElementById("task-start-date");
	const infoLines = taskInfoInput.value.split("\n");

	const newTask = {
		title: infoLines[0],
		description: infoLines.slice(1).join("\n"),
		dateToStart: taskStartDateInput.value ? new Date(taskStartDateInput.value).toISOString() : new Date().toISOString(),
	};

	const addedTask = await addTask(currentLocationId, newTask);
	if (addedTask) {
		// Reset form
		taskInfoInput.value = "";
		taskStartDateInput.value = new Date().toISOString().split("T")[0];

		// Update tasks list
		const location = await getLocationById(currentLocationId);
		updateTasksList(location, viewedDate);
	}
}

// Add new location handling
function showLocationSheet() {
	const sheet = document.getElementById("location-sheet");
	sheet.style.display = "block";
	sheet.offsetHeight; // Force reflow
	sheet.classList.remove("hidden");
	sheet.classList.add("picking");

	// Update header text
	const header = sheet.querySelector(".sheet-header");
	const title = header.querySelector("h2");
	const instruction = document.createElement("p");
	instruction.textContent = "Tap on the map to select a location";
	title.textContent = "Select Location";
	header.insertBefore(instruction, header.lastElementChild);

	// Enable location picking mode
	map.getCanvas().style.cursor = "crosshair";
	isLocationPickingMode = true;

	// On mobile, zoom out slightly to help with location picking
	if (window.innerWidth < 768 && map.getZoom() > 17) {
		map.easeTo({ zoom: 17, duration: 500 });
	}
}

function hideLocationSheet() {
	const sheet = document.getElementById("location-sheet");
	sheet.classList.add("hidden");
	sheet.classList.remove("picking");
	sheet.addEventListener(
		"transitionend",
		() => {
			if (sheet.classList.contains("hidden")) {
				sheet.style.display = "none";
				// Clean up added elements
				const instruction = sheet.querySelector(".sheet-header p");
				if (instruction) instruction.remove();
				sheet.querySelector(".sheet-header h2").textContent = "Add New Location";
			}
		},
		{ once: true },
	);

	// Disable location picking mode
	map.getCanvas().style.cursor = "";
	isLocationPickingMode = false;
	selectedCoordinates = null;
	document.getElementById("selected-coordinates").textContent = "Tap on the map to set location";
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
		info: document.getElementById("location-info").value,
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

		// Initialize date picker
		const dateInput = document.getElementById("viewed-date");
		const todayBtn = document.getElementById("today-btn");

		// Set initial date to today
		dateInput.value = new Date().toISOString().split("T")[0];

		// Handle date change
		dateInput.addEventListener("change", (e) => {
			viewedDate = new Date(e.target.value);
			// Refresh current location if open
			if (currentLocationId) {
				showLocationDetails(currentLocationId);
			}
		});

		// Handle today button
		todayBtn.addEventListener("click", () => {
			const today = new Date();
			viewedDate = today;
			dateInput.value = today.toISOString().split("T")[0];
			// Refresh current location if open
			if (currentLocationId) {
				showLocationDetails(currentLocationId);
			}
		});

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

		// Set default start date for new tasks to today
		document.getElementById("task-start-date").value = new Date().toISOString().split("T")[0];
	} catch (error) {
		console.error("Error initializing application:", error);
	}

	// Add location sheet event listeners
	document.getElementById("close-location-sheet").addEventListener("click", hideLocationSheet);
	document.getElementById("cancel-location").addEventListener("click", hideLocationSheet);
	document.getElementById("add-location-form").addEventListener("submit", handleLocationSubmit);

	// Add map click/touch handler for location selection
	map.on("click", (e) => {
		if (isLocationPickingMode) {
			e.preventDefault();
			selectedCoordinates = [e.lngLat.lng, e.lngLat.lat];
			document.getElementById("selected-coordinates").textContent = `[${selectedCoordinates[0].toFixed(6)}, ${selectedCoordinates[1].toFixed(6)}]`;

			// Show full form after location is selected
			const sheet = document.getElementById("location-sheet");
			sheet.classList.remove("picking");
			sheet.querySelector(".sheet-header h2").textContent = "Add New Location";
			const instruction = sheet.querySelector(".sheet-header p");
			if (instruction) instruction.remove();

			// Provide visual feedback
			const feedback = document.createElement("div");
			feedback.className = "location-feedback";
			feedback.style.position = "absolute";
			feedback.style.left = `${e.point.x}px`;
			feedback.style.top = `${e.point.y}px`;
			map.getContainer().appendChild(feedback);

			setTimeout(() => feedback.remove(), 1000);
		}
	});

	// Prevent map zoom on double tap when picking location
	map.on(
		"touchstart",
		(e) => {
			if (isLocationPickingMode) {
				e.preventDefault();
			}
		},
		{ passive: false },
	);
});

// Simple markdown renderer
function renderMarkdown(text) {
	if (!text) return "";

	return (
		text
			// Bold text
			.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
			// Images with alt text
			.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="markdown-image" />')
			// Line breaks
			.replace(/\n\n/g, "</p><p>")
			// Single line breaks
			.replace(/\n/g, "<br>")
			// Wrap in paragraph
			.replace(/^/, "<p>")
			.replace(/$/, "</p>")
	);
}

// Simple markdown renderer
function renderMarkdown(text) {
	if (!text) return "";

	return (
		text
			// Bold text
			.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
			// Images with alt text
			.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="markdown-image" />')
			// Line breaks
			.replace(/\n\n/g, "</p><p>")
			// Single line breaks
			.replace(/\n/g, "<br>")
			// Wrap in paragraph
			.replace(/^/, "<p>")
			.replace(/$/, "</p>")
	);
}

// Add map load event listener
map.on("load", () => {
	// Map is ready to use
	console.log("Map loaded successfully");
});
