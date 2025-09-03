// Supabase data handling for garden locations and tasks

// Function to get all locations
async function getLocations() {
	const { data, error } = await supabase.from("locations").select(`
            id,
            name,
            coordinates,
            maintenance_info:maintenance_info,
            tasks (
                id,
                title,
                description,
                completed,
                date_added
            )
        `);

	if (error) {
		console.error("Error fetching locations:", error);
		return [];
	}

	return data.map((location) => ({
		...location,
		maintenanceInfo: location.maintenance_info,
		tasks: location.tasks.map((task) => ({
			...task,
			dateAdded: task.date_added,
		})),
	}));
}

// Function to get a specific location by ID
async function getLocationById(id) {
	const { data, error } = await supabase
		.from("locations")
		.select(
			`
            id,
            name,
            coordinates,
            maintenance_info:maintenance_info,
            tasks (
                id,
                title,
                description,
                completed,
                date_added
            )
        `,
		)
		.eq("id", id)
		.single();

	if (error) {
		console.error("Error fetching location:", error);
		return null;
	}

	return {
		...data,
		maintenanceInfo: data.maintenance_info,
		tasks: data.tasks.map((task) => ({
			...task,
			dateAdded: task.date_added,
		})),
	};
}

// Function to add a task to a location
async function addTask(locationId, task) {
	const { data, error } = await supabase
		.from("tasks")
		.insert([
			{
				location_id: locationId,
				title: task.title,
				description: task.description,
				completed: false,
				date_added: new Date().toISOString(),
			},
		])
		.select()
		.single();

	if (error) {
		console.error("Error adding task:", error);
		return null;
	}

	return {
		...data,
		dateAdded: data.date_added,
	};
}

// Function to toggle task completion
async function toggleTaskCompletion(locationId, taskId) {
	// First get the current task state
	const { data: currentTask, error: fetchError } = await supabase.from("tasks").select("completed").eq("id", taskId).single();

	if (fetchError) {
		console.error("Error fetching task:", fetchError);
		return false;
	}

	// Toggle the completion state
	const { error: updateError } = await supabase.from("tasks").update({ completed: !currentTask.completed }).eq("id", taskId);

	if (updateError) {
		console.error("Error updating task:", updateError);
		return false;
	}

	return true;
}

// Function to parse text area content into array of strings
function parseTextareaLines(text) {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

// Function to add a new location
async function addLocation(locationData) {
	// Format the maintenance info
	const maintenanceInfo = {
		description: locationData.description,
		care: parseTextareaLines(locationData.care),
		seasonalTasks: {
			spring: parseTextareaLines(locationData.seasonalTasks.spring),
			summer: parseTextareaLines(locationData.seasonalTasks.summer),
			fall: parseTextareaLines(locationData.seasonalTasks.fall),
			winter: parseTextareaLines(locationData.seasonalTasks.winter),
		},
	};

	// Insert the new location
	const { data, error } = await supabase
		.from("locations")
		.insert([
			{
				name: locationData.name,
				coordinates: locationData.coordinates,
				maintenance_info: maintenanceInfo,
			},
		])
		.select()
		.single();

	if (error) {
		console.error("Error adding location:", error);
		return null;
	}

	return {
		...data,
		maintenanceInfo: data.maintenance_info,
	};
}
