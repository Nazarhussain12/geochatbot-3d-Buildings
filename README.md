# 3D Building Data Management System

A Node.js application for managing and visualizing 3D building data using PostGIS, with a chatbot interface for querying building information and an interactive map.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL with PostGIS extension
- Python 3.7+ (for data processing scripts)

### 1. Database Setup

#### Install PostgreSQL and PostGIS
```bash
# Windows: Download from https://www.postgresql.org/download/windows/
# macOS: brew install postgresql postgis
# Ubuntu: sudo apt install postgresql postgresql-contrib postgis
```

#### Create Database
```sql
CREATE DATABASE building_3d_db;
\c building_3d_db;
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;
```

#### Run Database Schema
```bash
psql -d building_3d_db -f database/schema.sql
```

### 2. Environment Configuration

Copy the environment file and configure your database credentials:
```bash
cp env.example .env
```

Edit `.env` with your database settings:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=building_3d_db
DB_USER=your_username
DB_PASSWORD=your_password
```

### 3. Data Upload

#### Upload Real Building Data
```bash
# Run the Python script to upload real building data from OSM
python scripts/extract-osm-buildings.py
```

**Note**: After uploading all buildings, we filter to keep only buildings within 6000 meters of Haram (Kaaba) coordinates for better performance. The API is also limited to 1000 buildings per query.

#### Optional: Filter Buildings by Distance (Recommended for Performance)
```sql
-- Run this query in pgAdmin or psql to keep only buildings within 6000m of Haram
DELETE FROM buildings 
WHERE ST_Distance(
  geometry::geography, 
  ST_SetSRID(ST_MakePoint(39.8262, 21.4225), 4326)::geography
) > 6000;
```

### 4. Install Dependencies

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend
npm install
```

### 5. Run the Application

#### Option 1: Run Both Together (Recommended)
```bash
# From the root directory, run both backend and frontend
npm run dev
```
This will start:
- Backend on `http://localhost:3001`
- Frontend on `http://localhost:3000`

#### Option 2: Run Separately
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend  
cd frontend
npm start
```

## 📁 Project Structure

```
chatbot-3d/
├── backend/                 # Node.js Express server
│   ├── src/
│   │   ├── app.js          # Main server file
│   │   ├── config/
│   │   │   └── database.js # Database connection
│   │   ├── routes/
│   │   │   ├── buildings.js # Building API endpoints
│   │   │   └── chat.js     # Chatbot API endpoints
│   │   └── services/
│   │       └── chatbot.js  # Chatbot logic
│   └── package.json
├── frontend/               # React TypeScript app
│   ├── src/
│   │   ├── App.tsx        # Main app component
│   │   └── components/
│   │       ├── Map.tsx    # Interactive map
│   │       └── Chatbot.tsx # Chat interface
│   └── package.json
├── database/
│   └── schema.sql         # Database schema
├── scripts/
│   └── extract-osm-buildings.py # Data processing script
└── .env                   # Environment variables
```

## 🤖 Chatbot Features

The chatbot supports natural language queries about buildings:

### Basic Queries
- `"What is the tallest building?"`
- `"Show me office buildings"`
- `"How many buildings are there?"`

### Advanced Queries
- `"Show me buildings between 200-400 meters"`
- `"Find residential buildings over 100m"`
- `"Compare Empire State Building vs One World Trade Center"`
- `"Show building type distribution"`

### Height Ranges
- `"Buildings over 300m"`
- `"Buildings under 100m"`
- `"Between 150-250 meters"`

### Building Types
- `"Office buildings"`
- `"Residential buildings"`
- `"Hotel buildings"`
- `"Commercial buildings"`

## 🗄️ Database Schema

The main `buildings` table contains:
- `id`: Primary key
- `name`: Building name
- `height`: Height in meters
- `building_type`: Type of building
- `address`: Building address
- `geometry`: PostGIS geometry (POLYGONZ)

## 🔧 API Endpoints

### Buildings
- `GET /api/buildings` - Get all buildings
- `GET /api/buildings/tallest` - Get tallest building
- `GET /api/buildings/search?type=office&minHeight=100` - Search buildings

### Chat
- `POST /api/chat` - Process natural language queries

## 🛠️ Development

### Backend Development
```bash
cd backend
npm run dev  # Start with nodemon for auto-reload
```

### Frontend Development
```bash
cd frontend
npm start    # Start React development server
```

### Database Queries
```bash
psql -d building_3d_db
```

## 📊 Sample Data

The project includes real building data extracted from OpenStreetMap (OSM). You can:
1. Run the Python script to extract and upload real OSM building data
2. Import your own building data in PostGIS format

## 🚀 Deployment

### Production Build
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
serve -s build -l 3000
```

### Environment Variables
Ensure all required environment variables are set in production:
- Database credentials
- API keys (if any)
- Port configurations

## 📚 Additional Resources

- [PostGIS Documentation](https://postgis.net/documentation/)
- [Leaflet.js Documentation](https://leafletjs.com/reference.html)
- [React Documentation](https://reactjs.org/docs/)
- [Express.js Documentation](https://expressjs.com/)

## 🤝 Support

For issues or questions:
1. Check the database connection settings
2. Verify PostGIS extension is enabled
3. Ensure all dependencies are installed
4. Check the console for error messages
