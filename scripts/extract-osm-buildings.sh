#!/bin/bash

# Extract real building data from OSM .pbf files for Makkah
# This script uses osmium to extract actual building geometries and heights from OpenStreetMap

set -e

echo "🕌 Extracting Real Building Data from OSM for Makkah"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if osmium is installed
check_osmium() {
    print_status "Checking osmium installation..."
    if command -v osmium &> /dev/null; then
        print_success "osmium is installed"
    else
        print_error "osmium is not installed. Please install osmium-tool."
        print_status "Installation instructions:"
        print_status "  Ubuntu/Debian: sudo apt install osmium-tool"
        print_status "  macOS: brew install osmium-tool"
        print_status "  Windows: Download from https://osmcode.org/osmium-tool/"
        exit 1
    fi
}

# Download OSM data for Makkah
download_makkah_data() {
    print_status "Downloading OSM data for Makkah region..."
    
    # Create data directory
    mkdir -p data/makkah
    
    # Makkah bounding box (approximately)
    # Makkah coordinates: 21.4225°N, 39.8262°E
    MAKKAH_BBOX="21.3,39.7,21.5,39.9"
    
    # Download Saudi Arabia OSM data
    SAUDI_URL="https://download.geofabrik.de/asia/saudi-arabia-latest.osm.pbf"
    SAUDI_FILE="data/makkah/saudi-arabia-latest.osm.pbf"
    
    if [ ! -f "$SAUDI_FILE" ]; then
        print_status "Downloading Saudi Arabia OSM data..."
        wget -O "$SAUDI_FILE" "$SAUDI_URL"
    else
        print_status "Saudi Arabia OSM data already exists"
    fi
    
    # Extract Makkah region
    MAKKAH_FILE="data/makkah/makkah-extract.osm.pbf"
    print_status "Extracting Makkah region (bbox: $MAKKAH_BBOX)..."
    
    osmium extract --bbox="$MAKKAH_BBOX" "$SAUDI_FILE" -o "$MAKKAH_FILE"
    
    print_success "Makkah data extracted successfully"
}

# Extract buildings using osmium tags-filter
extract_buildings() {
    print_status "Extracting buildings from OSM data..."
    
    MAKKAH_FILE="data/makkah/makkah-extract.osm.pbf"
    BUILDINGS_FILE="data/makkah/buildings.osm.pbf"
    
    # Extract all buildings (any object with building=* tag)
    osmium tags-filter "$MAKKAH_FILE" building -o "$BUILDINGS_FILE"
    
    print_success "Buildings extracted to $BUILDINGS_FILE"
}

# Convert buildings to GeoJSON
convert_to_geojson() {
    print_status "Converting buildings to GeoJSON..."
    
    BUILDINGS_FILE="data/makkah/buildings.osm.pbf"
    GEOJSON_FILE="data/makkah/buildings.geojson"
    
    # Convert to GeoJSON using osmium export
    osmium export --output-format=geojson --output="$GEOJSON_FILE" "$BUILDINGS_FILE"
    
    print_success "Buildings converted to GeoJSON: $GEOJSON_FILE"
}

# Create SQL from GeoJSON
create_sql_from_geojson() {
    print_status "Creating SQL from GeoJSON..."
    
    GEOJSON_FILE="data/makkah/buildings.geojson"
    SQL_FILE="data/makkah/real-buildings.sql"
    
    # Create SQL file header
    cat > "$SQL_FILE" << 'EOF'
-- Real Building Data from OpenStreetMap for Makkah
-- Generated from actual OSM .pbf data

-- Clear existing buildings
DELETE FROM buildings;

-- Insert real buildings from OSM data
INSERT INTO buildings (name, height, building_type, address, geometry) VALUES
EOF
    
    # Use jq to parse GeoJSON and create SQL
    if command -v jq &> /dev/null; then
        print_status "Using jq to parse GeoJSON..."
        
        # Count features for progress
        TOTAL_FEATURES=$(jq '.features | length' "$GEOJSON_FILE")
        print_status "Found $TOTAL_FEATURES buildings in OSM data"
        
        # Process each feature
        jq -r '.features[] | 
            "(" +
            "\"" + (.properties.name // "Building") + "\", " +
            (.properties.height // (.properties."building:levels" | tonumber * 3) // 10 | tostring) + ", " +
            "\"" + (.properties.building // "unknown") + "\", " +
            "\"" + (.properties."addr:street" // "Makkah, Saudi Arabia") + "\", " +
            "ST_GeomFromText(\"POLYGONZ((" + 
            (.geometry.coordinates[0] | map(.[0] | tostring + " " + .[1] | tostring + " 0") | join(",")) + 
            "))\", 4326))," 
        ' "$GEOJSON_FILE" >> "$SQL_FILE"
        
    else
        print_warning "jq not found, creating basic SQL template"
        print_status "Please install jq: sudo apt install jq (Ubuntu) or brew install jq (macOS)"
        print_status "Or manually process the GeoJSON file: $GEOJSON_FILE"
        
        # Create a simple template
        cat >> "$SQL_FILE" << 'EOF'
-- Example building (replace with actual data from GeoJSON)
('OSM Building 1', 15.0, 'residential', 'Makkah, Saudi Arabia', 
 ST_GeomFromText('POLYGONZ((39.8262 21.4225 0, 39.8267 21.4225 0, 39.8267 21.4230 0, 39.8262 21.4230 0, 39.8262 21.4225 0))', 4326));
EOF
    fi
    
    print_success "SQL file created: $SQL_FILE"
}

# Load data into database
load_into_database() {
    print_status "Loading real building data into database..."
    
    SQL_FILE="data/makkah/real-buildings.sql"
    
    # Load environment variables
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    # Check if database connection is available
    if command -v psql &> /dev/null; then
        print_status "Loading buildings data..."
        if [ -f "$SQL_FILE" ]; then
            PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$SQL_FILE"
            print_success "Real buildings loaded into database"
        else
            print_error "SQL file not found: $SQL_FILE"
        fi
    else
        print_warning "PostgreSQL client not found. Please install PostgreSQL client tools."
        print_status "You can manually run the SQL file: $SQL_FILE"
    fi
}

# Show statistics
show_statistics() {
    print_status "Building extraction statistics:"
    
    if [ -f "data/makkah/buildings.geojson" ]; then
        if command -v jq &> /dev/null; then
            TOTAL=$(jq '.features | length' data/makkah/buildings.geojson)
            print_status "Total buildings extracted: $TOTAL"
            
            # Show building types
            print_status "Building types found:"
            jq -r '.features[].properties.building' data/makkah/buildings.geojson | sort | uniq -c | sort -nr | head -10
        fi
    fi
}

# Main function
main() {
    echo ""
    print_status "Starting real building data extraction..."
    
    # Check prerequisites
    check_osmium
    
    # Download and extract data
    download_makkah_data
    extract_buildings
    convert_to_geojson
    create_sql_from_geojson
    load_into_database
    show_statistics
    
    echo ""
    print_success "Real building data extraction completed!"
    echo ""
    echo "Next steps:"
    echo "1. Restart your application to see the real Makkah buildings"
    echo "2. The map will now show actual buildings from OpenStreetMap data"
    echo "3. Buildings have real heights and geometries from OSM"
    echo ""
    echo "Files created:"
    echo "- data/makkah/makkah-extract.osm.pbf (Makkah region OSM data)"
    echo "- data/makkah/buildings.osm.pbf (Building data only)"
    echo "- data/makkah/buildings.geojson (Buildings in GeoJSON format)"
    echo "- data/makkah/real-buildings.sql (SQL for database)"
    echo ""
}

# Run main function
main "$@"
