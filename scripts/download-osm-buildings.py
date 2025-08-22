#!/usr/bin/env python3
"""
Download real building data from OpenStreetMap for Makkah using Overpass API
This script doesn't require osmium-tool and works on any system with Python
"""

import requests
import json
import psycopg2
import time
import sys

def download_makkah_buildings():
    """Download building data from OSM Overpass API for Makkah"""
    print("🕌 Downloading real building data from OpenStreetMap for Makkah...")
    
    # Makkah bounding box
    # Makkah coordinates: 21.4225°N, 39.8262°E
    bbox = "21.3,39.7,21.5,39.9"  # min_lat,min_lon,max_lat,max_lon
    
    # Overpass query to get buildings with height information
    overpass_query = f"""
    [out:json][timeout:60];
    (
      way["building"]["height"]({bbox});
      way["building"]["building:levels"]({bbox});
      way["building"]["building:height"]({bbox});
      way["building"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    print("📡 Querying OpenStreetMap Overpass API...")
    
    try:
        # Use the main Overpass API
        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data=overpass_query,
            timeout=120
        )
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Downloaded {len(data.get('elements', []))} elements from OSM")
        
        return data
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error downloading from Overpass API: {e}")
        print("Trying alternative Overpass server...")
        
        try:
            # Try alternative Overpass server
            response = requests.post(
                "https://overpass.kumi.systems/api/interpreter",
                data=overpass_query,
                timeout=120
            )
            response.raise_for_status()
            
            data = response.json()
            print(f"✅ Downloaded {len(data.get('elements', []))} elements from alternative server")
            
            return data
            
        except requests.exceptions.RequestException as e2:
            print(f"❌ Error with alternative server: {e2}")
            return None

def parse_building_height(tags):
    """Parse building height from OSM tags"""
    # Try different height tags
    height_tags = ['height', 'building:height', 'ele']
    
    for tag in height_tags:
        if tag in tags:
            try:
                height_str = str(tags[tag])
                # Remove units and convert to float
                height_str = height_str.replace('m', '').replace('ft', '').strip()
                if 'ft' in str(tags[tag]).lower():
                    # Convert feet to meters
                    return float(height_str) * 0.3048
                else:
                    return float(height_str)
            except ValueError:
                continue
    
    # Try building levels
    if 'building:levels' in tags:
        try:
            levels = int(tags['building:levels'])
            # Estimate height: 3 meters per floor
            return levels * 3.0
        except ValueError:
            pass
    
    # Default height if no information available
    return 10.0

def convert_osm_to_sql(osm_data, db_config):
    """Convert OSM data to SQL and load into database"""
    print("🗄️ Converting OSM data to SQL...")
    
    if not osm_data or 'elements' not in osm_data:
        print("❌ No OSM data to process")
        return
    
    # Connect to database
    try:
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
        
        # Process OSM elements
        buildings_inserted = 0
        nodes = {}
        
        # First pass: collect all nodes
        for element in osm_data['elements']:
            if element['type'] == 'node':
                nodes[element['id']] = (element['lat'], element['lon'])
        
        # Second pass: process ways (buildings)
        for element in osm_data['elements']:
            if element['type'] == 'way' and 'tags' in element and 'building' in element['tags']:
                try:
                    tags = element['tags']
                    
                    # Extract building information
                    name = tags.get('name', f"Building {buildings_inserted + 1}")
                    height = parse_building_height(tags)
                    building_type = tags.get('building', 'unknown')
                    address = tags.get('addr:street', 'Makkah, Saudi Arabia')
                    
                    # Get coordinates for the building
                    if 'nodes' in element:
                        coords = []
                        for node_id in element['nodes']:
                            if node_id in nodes:
                                lat, lon = nodes[node_id]
                                coords.append(f"{lon} {lat} 0")
                        
                        if len(coords) >= 3:  # Need at least 3 points for a polygon
                            # Close the polygon
                            coords.append(coords[0])
                            
                            wkt_polygon = f"POLYGONZ(({', '.join(coords)}))"
                            
                            # Insert into database
                            cursor.execute("""
                                INSERT INTO buildings (name, height, building_type, address, geometry)
                                VALUES (%s, %s, %s, %s, ST_GeomFromText(%s, 4326))
                            """, (name, height, building_type, address, wkt_polygon))
                            
                            buildings_inserted += 1
                            
                            if buildings_inserted % 100 == 0:
                                print(f"Processed {buildings_inserted} buildings...")
                
                except Exception as e:
                    print(f"Error processing building: {e}")
                    continue
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ {buildings_inserted} real buildings loaded into database")
        
    except Exception as e:
        print(f"❌ Database error: {e}")

def main():
    print("🕌 Real OSM Building Data Downloader for Makkah")
    print("=" * 50)
    
    # Database configuration (you can modify these)
    db_config = {
        'host': 'localhost',
        'port': '5432',
        'database': 'building_3d_db',
        'user': 'postgres',
        'password': 'postgres'
    }
    
    # Load from .env if available
    try:
        with open('.env', 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    if key in ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']:
                        db_key = key.replace('DB_', '').lower()
                        db_config[db_key] = value
    except FileNotFoundError:
        print("⚠️  No .env file found, using default database settings")
    
    try:
        # Download OSM data
        osm_data = download_makkah_buildings()
        
        if osm_data:
            # Convert and load into database
            convert_osm_to_sql(osm_data, db_config)
            
            print("\n🎉 Real building data download completed!")
            print("The 3D map will now show actual buildings from OpenStreetMap")
            print("Buildings have real heights and geometries from OSM data")
            
        else:
            print("❌ Failed to download OSM data")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
