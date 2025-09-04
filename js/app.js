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

// Custom control for date selection
class DateSliderControl {
	onAdd(map) {
		this._map = map;
		this._container = document.createElement("div");
		this._container.className = "maplibregl-ctrl date-slider-control";

		// Create slider container
		const sliderContainer = document.createElement("div");
		sliderContainer.className = "date-slider-container";

		// Create label
		this._label = document.createElement("div");
		this._label.className = "date-slider-label";
		this._label.textContent = "Now";

		// Create slider
		this._slider = document.createElement("input");
		this._slider.type = "range";
		this._slider.className = "date-slider";
		this._slider.min = "0";
		this._slider.step = "1";

		// Build date options with proper seasonal ordering
		this._dateOptions = this._buildDateOptions();
		this._slider.max = (this._dateOptions.length - 1).toString();
		this._slider.value = "0";

		// Add event listener
		this._slider.addEventListener("input", (e) => {
			const index = parseInt(e.target.value);
			const option = this._dateOptions[index];
			this._label.textContent = option.label;

			// Calculate new viewed date
			const newDate = new Date();
			newDate.setDate(newDate.getDate() + option.days);

			// Update global viewed date
			viewedDate = newDate;

			// Refresh current location if open
			if (currentLocationId) {
				showLocationDetails(currentLocationId);
			}
		});

		sliderContainer.appendChild(this._label);
		sliderContainer.appendChild(this._slider);
		this._container.appendChild(sliderContainer);

		return this._container;
	}

	_getCurrentSeason() {
		const now = new Date();
		const month = now.getMonth();
		const day = now.getDate();

		// Spring: March 20 - June 20
		if (month > 2 || (month === 2 && day >= 20)) {
			if (month < 5 || (month === 5 && day < 21)) {
				return "spring";
			}
		}
		// Summer: June 21 - September 21
		if (month > 5 || (month === 5 && day >= 21)) {
			if (month < 8 || (month === 8 && day < 22)) {
				return "summer";
			}
		}
		// Autumn: September 22 - December 20
		if (month > 8 || (month === 8 && day >= 22)) {
			if (month < 11 || (month === 11 && day < 21)) {
				return "autumn";
			}
		}
		// Winter: December 21 - March 19
		return "winter";
	}

	_getSeasonStartDate(season, year) {
		switch (season) {
			case "spring":
				return new Date(year, 2, 20); // March 20
			case "summer":
				return new Date(year, 5, 21); // June 21
			case "autumn":
				return new Date(year, 8, 22); // September 22
			case "winter":
				return new Date(year, 11, 21); // December 21
			default:
				return new Date();
		}
	}

	_getDaysToNextSeason(season) {
		const now = new Date();
		const currentYear = now.getFullYear();
		let targetDate = this._getSeasonStartDate(season, currentYear);

		// If the date has passed this year, use next year
		if (targetDate <= now) {
			targetDate = this._getSeasonStartDate(season, currentYear + 1);
		}

		return Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
	}

	_buildDateOptions() {
		const currentSeason = this._getCurrentSeason();
		const seasons = ["spring", "summer", "autumn", "winter"];

		// Find current season index
		const currentSeasonIndex = seasons.indexOf(currentSeason);

		// Build base options
		const baseOptions = [
			{ label: "Now", days: 0 },
			{ label: "Next Week", days: 7 },
			{ label: "2 Weeks", days: 14 },
			{ label: "Next Month", days: 30 },
		];

		// Add seasons in order starting from next season
		const seasonOptions = [];
		for (let i = 1; i <= 4; i++) {
			const seasonIndex = (currentSeasonIndex + i) % 4;
			const season = seasons[seasonIndex];
			const days = this._getDaysToNextSeason(season);

			// Capitalize first letter
			const label = `Next ${season.charAt(0).toUpperCase() + season.slice(1)}`;

			seasonOptions.push({ label, days });
		}

		return [...baseOptions, ...seasonOptions];
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
	map.addControl(new DateSliderControl(), "top-left");

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
			const hasCompletionStatus = task.completionStatus;
			const taskClass = hasCompletionStatus ? "completed" : isActive ? "" : "inactive";

			// Get status indicator
			let statusIndicator = "";
			if (hasCompletionStatus) {
				switch (task.completionStatus) {
					case "done":
						statusIndicator = `<span class="status-dot completed">✓</span>`;
						break;
					case "postponed":
						statusIndicator = `<span class="status-dot postponed">⏸</span>`;
						break;
					case "canceled":
						statusIndicator = `<span class="status-dot canceled">✕</span>`;
						break;
				}
			} else if (isActive) {
				statusIndicator = `<span class="status-dot active">●</span>`;
			} else {
				statusIndicator = `<span class="status-dot inactive">○</span>`;
			}

			// Build meta information
			let metaInfo = `Start: ${new Date(task.dateToStart).toLocaleDateString()}`;
			if (task.tries > 0) metaInfo += ` • ${task.tries} tries`;
			if (hasCompletionStatus) {
				const statusLabel = task.completionStatus.charAt(0).toUpperCase() + task.completionStatus.slice(1);
				metaInfo += ` • ${statusLabel} ${new Date(task.dateCompleted).toLocaleDateString()}`;
			}

			return `
        <div class="task-item ${taskClass}" data-task-id="${task.id}" onclick="showTaskSheet('${task.id}')">
            <div class="task-content">
                ${statusIndicator}
                <div class="task-text">
                    <span class="task-title">${task.title}</span>
                    <small class="task-meta">${metaInfo}</small>
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
		const statusText = task.completionStatus ? `${task.completionStatus.charAt(0).toUpperCase() + task.completionStatus.slice(1)}` : "Pending";
		document.getElementById("task-status-display").textContent = statusText;
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

	let title;
	switch (action) {
		case "complete":
			title = "Complete Task - When to restart?";
			break;
		case "postpone":
			title = "Postpone Task - When to start again?";
			break;
		case "cancel":
			title = "Cancel Task - When to restart?";
			break;
	}
	document.getElementById("date-selection-title").textContent = title;

	// Populate date options dynamically using the same logic as slider
	populateDateOptions();

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

	switch (period) {
		case "never":
			return null;
		case "next-week":
			return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		case "next-2-weeks":
			return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
		case "next-month":
			return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
		case "next-spring":
			return getNextSeasonDate("spring");
		case "next-summer":
			return getNextSeasonDate("summer");
		case "next-autumn":
			return getNextSeasonDate("autumn");
		case "next-winter":
			return getNextSeasonDate("winter");
		default:
			return now;
	}
}

// Helper function to get next season date
function getNextSeasonDate(season) {
	const now = new Date();
	const currentYear = now.getFullYear();

	let targetDate;
	switch (season) {
		case "spring":
			targetDate = new Date(currentYear, 2, 20); // March 20
			break;
		case "summer":
			targetDate = new Date(currentYear, 5, 21); // June 21
			break;
		case "autumn":
			targetDate = new Date(currentYear, 8, 22); // September 22
			break;
		case "winter":
			targetDate = new Date(currentYear, 11, 21); // December 21
			break;
		default:
			return now;
	}

	// If the date has passed this year, use next year
	if (targetDate <= now) {
		targetDate = new Date(targetDate.getFullYear() + 1, targetDate.getMonth(), targetDate.getDate());
	}

	return targetDate;
}

// Populate date selection options dynamically
function populateDateOptions() {
	const dateOptionsContainer = document.getElementById("date-options");

	// Clear existing options
	dateOptionsContainer.innerHTML = "";

	// Get current season and build options in correct order
	const currentSeason = getCurrentSeason();
	const seasons = ["spring", "summer", "autumn", "winter"];
	const currentSeasonIndex = seasons.indexOf(currentSeason);

	// Base time options
	const baseOptions = [
		{ label: "Never", period: "never" },
		{ label: "Next Week", period: "next-week" },
		{ label: "2 Weeks", period: "next-2-weeks" },
		{ label: "Next Month", period: "next-month" },
	];

	// Add seasonal options in correct order
	const seasonOptions = [];
	for (let i = 1; i <= 4; i++) {
		const seasonIndex = (currentSeasonIndex + i) % 4;
		const season = seasons[seasonIndex];
		const label = `Next ${season.charAt(0).toUpperCase() + season.slice(1)}`;
		const period = `next-${season}`;
		seasonOptions.push({ label, period });
	}

	// Combine all options
	const allOptions = [...baseOptions, ...seasonOptions];

	// Create buttons for each option
	allOptions.forEach((option) => {
		const button = document.createElement("button");
		button.className = "date-option";
		button.setAttribute("data-period", option.period);
		button.textContent = option.label;
		button.addEventListener("click", (e) => {
			const period = e.target.getAttribute("data-period");
			handleDateSelection(period);
		});
		dateOptionsContainer.appendChild(button);
	});
}

// Helper function to get current season (same logic as DateSliderControl)
function getCurrentSeason() {
	const now = new Date();
	const month = now.getMonth();
	const day = now.getDate();

	// Spring: March 20 - June 20
	if (month > 2 || (month === 2 && day >= 20)) {
		if (month < 5 || (month === 5 && day < 21)) {
			return "spring";
		}
	}
	// Summer: June 21 - September 21
	if (month > 5 || (month === 5 && day >= 21)) {
		if (month < 8 || (month === 8 && day < 22)) {
			return "summer";
		}
	}
	// Autumn: September 22 - December 20
	if (month > 8 || (month === 8 && day >= 22)) {
		if (month < 11 || (month === 11 && day < 21)) {
			return "autumn";
		}
	}
	// Winter: December 21 - March 19
	return "winter";
}

// Handle date selection
async function handleDateSelection(period) {
	if (!currentTaskId || !taskAction) return;

	const newStartDate = calculateDateFromPeriod(period);

	// Map action to completion status
	let completionStatus;
	switch (taskAction) {
		case "complete":
			completionStatus = "done";
			break;
		case "postpone":
			// If "never" is selected when postponing, treat as canceled
			completionStatus = period === "never" ? "canceled" : "postponed";
			break;
		case "cancel":
			completionStatus = "canceled";
			break;
	}

	// Complete task and create new one if needed
	const success = await completeTask(currentTaskId, completionStatus, newStartDate);

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

		// Date slider is now handled by the custom MapLibre control

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
		document.getElementById("complete-btn").addEventListener("click", () => showDateSelectionSheet("complete"));
		document.getElementById("postpone-btn").addEventListener("click", () => showDateSelectionSheet("postpone"));
		document.getElementById("cancel-btn").addEventListener("click", () => showDateSelectionSheet("cancel"));

		// Add event listeners for date selection sheet
		document.getElementById("close-date-selection-sheet").addEventListener("click", hideDateSelectionSheet);
		// Note: date option buttons are now added dynamically in populateDateOptions()

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
