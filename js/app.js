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
let currentTaskId = null; // Current task being edited
let taskAction = null; // Track if marking as done or not done

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

			// Get status indicator
			let statusIndicator = "";
			if (task.completed) {
				statusIndicator = `<span class="status-dot completed">✓</span>`;
			} else if (isActive) {
				statusIndicator = `<span class="status-dot active">●</span>`;
			} else {
				statusIndicator = `<span class="status-dot inactive">○</span>`;
			}

			return `
        <div class="task-item ${taskClass}" data-task-id="${task.id}" onclick="showTaskSheet('${task.id}')">
            <div class="task-content">
                ${statusIndicator}
                <div class="task-text">
                    <span class="task-title">${task.title}</span>
                    <small class="task-meta">
                        Start: ${new Date(task.dateToStart).toLocaleDateString()}
                        ${task.tries > 0 ? ` • ${task.tries} tries` : ""}
                        ${task.completed ? ` • Completed ${new Date(task.dateCompleted).toLocaleDateString()}` : ""}
                    </small>
                </div>
            </div>
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
		// Hide sheet and reset form
		hideTaskSheet();

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

// Show task sheet
function showTaskSheet() {
	if (!currentLocationId) return;

	const sheet = document.getElementById("task-sheet");
	sheet.style.display = "block";
	sheet.offsetHeight; // Force reflow
	sheet.classList.remove("hidden");

	// Set default start date to today
	document.getElementById("task-start-date").value = new Date().toISOString().split("T")[0];

	// Focus on the first input
	document.getElementById("task-info").focus();
}

// Hide add task sheet
function hideTaskSheet() {
	const sheet = document.getElementById("task-sheet");
	sheet.classList.add("hidden");
	sheet.addEventListener(
		"transitionend",
		() => {
			if (sheet.classList.contains("hidden")) {
				sheet.style.display = "none";
				// Reset form
				document.getElementById("add-task-form").reset();
			}
		},
		{ once: true },
	);
}

// Show task sheet
function showTaskSheet(taskId) {
	if (!currentLocationId) return;

	currentTaskId = taskId;

	// Get task data
	getLocationById(currentLocationId).then((location) => {
		const task = location.tasks.find((t) => t.id == taskId);
		if (!task) return;

		// Update task sheet content
		document.getElementById("task-name").textContent = task.title;
		document.getElementById("task-description").textContent = task.description;
		document.getElementById("task-start-date-display").textContent = new Date(task.dateToStart).toLocaleDateString();
		document.getElementById("task-status-display").textContent = task.completed ? "Completed" : "Pending";
		document.getElementById("task-tries-display").textContent = task.tries;

		// Show sheet
		const sheet = document.getElementById("edit-task-sheet");
		sheet.style.display = "block";
		sheet.offsetHeight; // Force reflow
		sheet.classList.remove("hidden");
	});
}

// Hide edit task sheet
function hideEditTaskSheet() {
	const sheet = document.getElementById("edit-task-sheet");
	sheet.classList.add("hidden");
	sheet.addEventListener(
		"transitionend",
		() => {
			if (sheet.classList.contains("hidden")) {
				sheet.style.display = "none";
				currentTaskId = null;
			}
		},
		{ once: true },
	);
}

// Show date selection sheet
function showDateSelectionSheet(action) {
	taskAction = action;

	const title = action === "done" ? "Mark as Done - When to restart?" : "Postpone - When to start?";
	document.getElementById("date-selection-title").textContent = title;

	const sheet = document.getElementById("date-selection-sheet");
	sheet.style.display = "block";
	sheet.offsetHeight; // Force reflow
	sheet.classList.remove("hidden");
}

// Hide date selection sheet
function hideDateSelectionSheet() {
	const sheet = document.getElementById("date-selection-sheet");
	sheet.classList.add("hidden");
	sheet.addEventListener(
		"transitionend",
		() => {
			if (sheet.classList.contains("hidden")) {
				sheet.style.display = "none";
				taskAction = null;
			}
		},
		{ once: true },
	);
}

// Calculate date based on period
function calculateDateFromPeriod(period) {
	const now = new Date();
	const currentYear = now.getFullYear();

	switch (period) {
		case "next-week":
			return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		case "next-2-weeks":
			return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
		case "next-month":
			return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
		case "next-spring":
			const springStart = new Date(currentYear + (now.getMonth() >= 2 ? 1 : 0), 2, 20); // March 20
			return springStart;
		case "next-summer":
			const summerStart = new Date(currentYear + (now.getMonth() >= 5 ? 1 : 0), 5, 21); // June 21
			return summerStart;
		case "next-autumn":
			const autumnStart = new Date(currentYear + (now.getMonth() >= 8 ? 1 : 0), 8, 22); // September 22
			return autumnStart;
		case "next-winter":
			const winterStart = new Date(currentYear + (now.getMonth() >= 11 ? 1 : 0), 11, 21); // December 21
			return winterStart;
		default:
			return now;
	}
}

// Handle date selection
async function handleDateSelection(period) {
	if (!currentTaskId || !taskAction) return;

	const newStartDate = calculateDateFromPeriod(period);

	// Prepare update data
	const updateData = {
		date_to_start: newStartDate.toISOString(),
		date_completed: taskAction === "done" ? new Date().toISOString() : null,
	};

	// Update task in database
	const success = await updateTask(currentTaskId, updateData);

	// Increment tries if marking as not done
	if (success && taskAction === "not-done") {
		await incrementTaskTries(currentTaskId);
	}

	if (!success) {
		return;
	}

	// Close all sheets and refresh
	hideDateSelectionSheet();
	hideEditTaskSheet();

	// Refresh location view
	if (currentLocationId) {
		const location = await getLocationById(currentLocationId);
		updateTasksList(location, viewedDate);
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

		// Add event listeners for add task sheet
		document.getElementById("add-task-btn").addEventListener("click", showTaskSheet);
		document.getElementById("close-task-sheet").addEventListener("click", hideTaskSheet);
		document.getElementById("cancel-task").addEventListener("click", hideTaskSheet);

		// Add event listeners for edit task sheet
		document.getElementById("close-edit-task-sheet").addEventListener("click", hideEditTaskSheet);
		document.getElementById("mark-done-btn").addEventListener("click", () => showDateSelectionSheet("done"));
		document.getElementById("mark-not-done-btn").addEventListener("click", () => showDateSelectionSheet("not-done"));

		// Add event listeners for date selection sheet
		document.getElementById("close-date-selection-sheet").addEventListener("click", hideDateSelectionSheet);
		document.querySelectorAll(".date-option").forEach((button) => {
			button.addEventListener("click", (e) => {
				const period = e.target.getAttribute("data-period");
				handleDateSelection(period);
			});
		});

		// Add escape key to close sheet
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				const taskSheet = document.getElementById("task-sheet");
				const editTaskSheet = document.getElementById("edit-task-sheet");
				const dateSelectionSheet = document.getElementById("date-selection-sheet");

				if (!dateSelectionSheet.classList.contains("hidden")) {
					hideDateSelectionSheet();
				} else if (!editTaskSheet.classList.contains("hidden")) {
					hideEditTaskSheet();
				} else if (!taskSheet.classList.contains("hidden")) {
					hideTaskSheet();
				}
			}
		});

		// Initialize sidebar state
		const sidebar = document.getElementById("sidebar");
		sidebar.style.display = "none";
		sidebar.classList.add("hidden");

		// Initialize task sheet state
		const taskSheet = document.getElementById("task-sheet");
		taskSheet.style.display = "none";
		taskSheet.classList.add("hidden");

		// Initialize edit task sheet state
		const editTaskSheet = document.getElementById("edit-task-sheet");
		editTaskSheet.style.display = "none";
		editTaskSheet.classList.add("hidden");

		// Initialize date selection sheet state
		const dateSelectionSheet = document.getElementById("date-selection-sheet");
		dateSelectionSheet.style.display = "none";
		dateSelectionSheet.classList.add("hidden");

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
