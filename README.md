# Småhusbyn Skötselplanering

A web application for managing maintenance planning at Småhusbyn. Users can add locations on a map and track maintenance tasks, care instructions, and seasonal activities for each location.

## Features

- Interactive map interface using MapLibre GL JS
- Satellite/aerial imagery view
- Add and manage maintenance locations
- Track tasks for each location
- Store care instructions and seasonal maintenance guides
- Persistent storage using Supabase
- Mobile-friendly design

## Configuration

The application uses two external services:

1. MapTiler for satellite imagery
2. Supabase for data storage

The configuration is stored in `js/config.js`. Make sure to update it with your own API keys if you're forking the project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) for the mapping functionality
- [Supabase](https://supabase.com/) for the backend services
- [MapTiler](https://www.maptiler.com/) for satellite imagery
