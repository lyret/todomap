// Supabase data handling for garden locations and tasks

// Function to get all locations
async function getLocations() {
	const { data, error } = await supabase.from("locations").select(`
            id,
            name,
            coordinates,
            info,
            tasks (
                id,
                info,
                date_to_start,
                date_completed,
                completion_status,
                tries
            )
        `);

	if (error) {
		console.error("Error fetching locations:", error);
		return [];
	}

	return data.map((location) => ({
		...location,
		tasks: location.tasks.map((task) => ({
			...task,
			title: task.info.split("\n")[0],
			description: task.info.split("\n").slice(1).join("\n"),
			dateToStart: task.date_to_start,
			dateCompleted: task.date_completed,
			completionStatus: task.completion_status,
			completed: task.completion_status === "done",
			isActive: new Date(task.date_to_start) <= new Date(),
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
            info,
            tasks (
                id,
                info,
                date_to_start,
                date_completed,
                completion_status,
                tries
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
		tasks: data.tasks.map((task) => ({
			...task,
			title: task.info.split("\n")[0],
			description: task.info.split("\n").slice(1).join("\n"),
			dateToStart: task.date_to_start,
			dateCompleted: task.date_completed,
			completionStatus: task.completion_status,
			completed: task.completion_status === "done",
			isActive: new Date(task.date_to_start) <= new Date(),
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
				info: `${task.title}\n${task.description}`,
				date_to_start: task.dateToStart || new Date().toISOString(),
				tries: 0,
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
		dateToStart: data.date_to_start,
	};
}

// Function to toggle task completion
async function toggleTaskCompletion(locationId, taskId) {
	// First get the current task state
	const { data: currentTask, error: fetchError } = await supabase.from("tasks").select("date_completed").eq("id", taskId).single();

	if (fetchError) {
		console.error("Error fetching task:", fetchError);
		return false;
	}

	// Toggle the completion state
	const { error: updateError } = await supabase
		.from("tasks")
		.update({
			date_completed: currentTask.date_completed ? null : new Date().toISOString(),
			tries: currentTask.date_completed ? currentTask.tries : currentTask.tries + 1,
		})
		.eq("id", taskId);

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
	// Insert the new location
	const { data, error } = await supabase
		.from("locations")
		.insert([
			{
				name: locationData.name,
				coordinates: locationData.coordinates,
				info: locationData.info,
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
		tasks: [],
	};
}

// Function to complete a task and optionally create a new one
async function completeTask(taskId, completionStatus, newStartDate = null) {
	// Get original task
	const { data: originalTask, error: fetchError } = await supabase.from("tasks").select("*").eq("id", taskId).single();

	if (fetchError) {
		console.error("Error fetching task:", fetchError);
		return false;
	}

	// Update original task with completion status
	const { error: updateError } = await supabase
		.from("tasks")
		.update({
			date_completed: new Date().toISOString(),
			completion_status: completionStatus,
		})
		.eq("id", taskId);

	if (updateError) {
		console.error("Error updating task:", updateError);
		return false;
	}

	// Create new task if date is selected (not "never")
	if (newStartDate) {
		const newTries = completionStatus === "done" ? 0 : originalTask.tries + 1;

		const { error: createError } = await supabase.from("tasks").insert({
			location_id: originalTask.location_id,
			info: originalTask.info,
			date_to_start: newStartDate.toISOString(),
			tries: newTries,
		});

		if (createError) {
			console.error("Error creating new task:", createError);
			return false;
		}
	}

	return true;
}

// Function to increment task tries
async function incrementTaskTries(taskId) {
	const { data: currentTask, error: fetchError } = await supabase.from("tasks").select("tries").eq("id", taskId).single();

	if (fetchError) {
		console.error("Error fetching task:", fetchError);
		return false;
	}

	const { error: updateError } = await supabase
		.from("tasks")
		.update({ tries: currentTask.tries + 1 })
		.eq("id", taskId);

	if (updateError) {
		console.error("Error updating task tries:", updateError);
		return false;
	}

	return true;
}

// Function to filter active tasks based on viewed date
function filterActiveTasks(tasks, viewedDate = new Date()) {
	return tasks.filter((task) => new Date(task.dateToStart) <= viewedDate);
}

// Function to get location with active tasks only
async function getLocationWithActiveTasks(id, viewedDate = new Date()) {
	const location = await getLocationById(id);
	if (location) {
		location.tasks = filterActiveTasks(location.tasks, viewedDate);
	}
	return location;
}
