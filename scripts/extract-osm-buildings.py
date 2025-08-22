#!/usr/bin/env python3
"""
Extract building data from OSM .pbf files for Makkah city
This script uses osmium to extract real building geometries and heights from OpenStreetMap data
"""

import os
import sys
import subprocess
import json
import psycopg2
from psycopg2.extras import RealDictCursor
import argparse

def check_dependencies():
    """Check if required tools are installed"""
    try:
        subprocess.run(['osmium', '--version'], capture_output=True, check=True)
        print("✅ osmium-tool is installed")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ osmium-tool is not installed")
        print("Install it with:")
        print("  Ubuntu/Debian: sudo apt install osmium-tool")
        print("  macOS: brew install osmium-tool")
        print("  Windows: Download from https://osmcode.org/osmium-tool/")
        return False
    
    try:
        import psycopg2
        print("✅ psycopg2 is installed")
    except ImportError:
        print("❌ psycopg2 is not installed")
        print("Install it with: pip install psycopg2-binary")
        return False
    
    return True

def download_makkah_data():
    """Download OSM data for Makkah region"""
    print("📥 Downloading OSM data for Makkah...")
    
    # Create data directory
    os.makedirs('data/makkah', exist_ok=True)
    
    # Makkah bounding box (approximately)
    # Makkah coordinates: 21.4225°N, 39.8262°E
    # Bounding box: min_lat, min_lon, max_lat, max_lon
    makkah_bbox = "21.3,39.7,21.5,39.9"
    
    # Download Saudi Arabia OSM data
    saudi_url = "https://download.geofabrik.de/asia/saudi-arabia-latest.osm.pbf"
    saudi_file = "data/makkah/saudi-arabia-latest.osm.pbf"
    
    if not os.path.exists(saudi_file):
        print(f"Downloading {saudi_url}...")
        subprocess.run(['wget', '-O', saudi_file, saudi_url], check=True)
    else:
        print("Saudi Arabia OSM data already exists")
    
    # Extract Makkah region
    makkah_file = "data/makkah/makkah-extract.osm.pbf"
    print(f"Extracting Makkah region (bbox: {makkah_bbox})...")
    
    subprocess.run([
        'osmium', 'extract',
        '--bbox', makkah_bbox,
        saudi_file,
        '-o', makkah_file
    ], check=True)
    
    print("✅ Makkah data extracted successfully")
    return makkah_file

def extract_buildings_from_pbf(pbf_file):
    """Extract building data from PBF file using osmium"""
    print("🏗️ Extracting building data from PBF...")
    
    # Use osmium to extract buildings with height information
    buildings_file = "data/makkah/buildings.json"
    
    # Extract buildings with height tags
    subprocess.run([
        'osmium', 'export',
        '--config', 'data/makkah/osmium-config.json',
        '--output-format', 'geojson',
        '--output', buildings_file,
        pbf_file
    ], check=True)
    
    print(f"✅ Buildings extracted to {buildings_file}")
    return buildings_file

def create_osmium_config():
    """Create osmium configuration for building extraction"""
    config = {
        "attributes": {
            "type": "string",
            "id": "string"
        },
        "filters": {
            "area": {
                "type": "Polygon",
                "coordinates": [[[39.7, 21.3], [39.9, 21.3], [39.9, 21.5], [39.7, 21.5], [39.7, 21.3]]]
            }
        },
        "features": [
            {
                "name": "buildings",
                "geometry_types": ["Polygon"],
                "filters": {
                    "tags": {
                        "building": "~."
                    }
                },
                "attributes": {
                    "name": "name",
                    "height": "height",
                    "building_type": "building",
                    "address": "addr:street",
                    "levels": "building:levels"
                }
            }
        ]
    }
    
    os.makedirs('data/makkah', exist_ok=True)
    with open('data/makkah/osmium-config.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    print("✅ osmium configuration created")

def parse_building_height(height_str, levels_str=None):
    """Parse building height from OSM tags"""
    if height_str:
        try:
            # Remove units and convert to float
            height = height_str.replace('m', '').replace('ft', '').strip()
            if 'ft' in height_str.lower():
                # Convert feet to meters
                return float(height) * 0.3048
            else:
                return float(height)
        except ValueError:
            pass
    
    if levels_str:
        try:
            levels = int(levels_str)
            # Estimate height: 3 meters per floor
            return levels * 3.0
        except ValueError:
            pass
    
    # Default height if no information available
    return 10.0

def convert_to_sql(buildings_file, db_config):
    """Convert extracted buildings to SQL and load into database"""
    print("🗄️ Converting buildings to SQL...")
    
    # Read the GeoJSON file
    with open(buildings_file, 'r') as f:
        data = json.load(f)
    
    # Connect to database
    conn = psycopg2.connect(
        host=db_config['host'],
        port=db_config['port'],
        database=db_config['database'],
        user=db_config['user'],
        password=db_config['password']
    )
    
    cursor = conn.cursor()
    
    # Clear existing buildings
    cursor.execute("DELETE FROM buildings")
    
    # Insert buildings
    buildings_inserted = 0
    
    for feature in data['features']:
        try:
            properties = feature['properties']
            geometry = feature['geometry']
            
            # Extract building information
            name = properties.get('name', f"Building {buildings_inserted + 1}")
            height = parse_building_height(
                properties.get('height'),
                properties.get('levels')
            )
            building_type = properties.get('building_type', 'unknown')
            address = properties.get('address', 'Makkah, Saudi Arabia')
            
            # Convert geometry to WKT
            coords = geometry['coordinates'][0]  # First ring of polygon
            wkt_coords = []
            for coord in coords:
                wkt_coords.append(f"{coord[0]} {coord[1]} 0")
            
            wkt_polygon = f"POLYGONZ(({', '.join(wkt_coords)}))"
            
            # Insert into database
            cursor.execute("""
                INSERT INTO buildings (name, height, building_type, address, geometry)
                VALUES (%s, %s, %s, %s, ST_GeomFromText(%s, 4326))
            """, (name, height, building_type, address, wkt_polygon))
            
            buildings_inserted += 1
            
        except Exception as e:
            print(f"Error processing building: {e}")
            continue
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"✅ {buildings_inserted} buildings loaded into database")

def main():
    parser = argparse.ArgumentParser(description='Extract building data from OSM for Makkah')
    parser.add_argument('--db-host', default='localhost', help='Database host')
    parser.add_argument('--db-port', default='5432', help='Database port')
    parser.add_argument('--db-name', default='building_3d_db', help='Database name')
    parser.add_argument('--db-user', default='postgres', help='Database user')
    parser.add_argument('--db-password', default='postgres', help='Database password')
    parser.add_argument('--skip-download', action='store_true', help='Skip downloading OSM data')
    
    args = parser.parse_args()
    
    print("🕌 Makkah Building Data Extraction")
    print("=" * 40)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Database configuration
    db_config = {
        'host': args.db_host,
        'port': args.db_port,
        'database': args.db_name,
        'user': args.db_user,
        'password': args.db_password
    }
    
    try:
        # Create osmium configuration
        create_osmium_config()
        
        if not args.skip_download:
            # Download and extract Makkah data
            pbf_file = download_makkah_data()
        else:
            pbf_file = "data/makkah/makkah-extract.osm.pbf"
            if not os.path.exists(pbf_file):
                print(f"❌ PBF file not found: {pbf_file}")
                print("Run without --skip-download to download the data")
                sys.exit(1)
        
        # Extract buildings
        buildings_file = extract_buildings_from_pbf(pbf_file)
        
        # Convert to SQL and load into database
        convert_to_sql(buildings_file, db_config)
        
        print("\n🎉 Makkah building data extraction completed!")
        print("The 3D map will now show real buildings from OpenStreetMap data")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
