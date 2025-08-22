-- 3D Building Data Management System Database Schema
-- This file contains the complete database setup for the building management system

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create buildings table
CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    height DECIMAL(10,2) NOT NULL,
    building_type VARCHAR(100) NOT NULL,
    address TEXT,
    geometry GEOMETRY(POLYGONZ, 4326) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS buildings_geometry_idx ON buildings USING GIST (geometry);
CREATE INDEX IF NOT EXISTS buildings_height_idx ON buildings (height DESC);
CREATE INDEX IF NOT EXISTS buildings_type_idx ON buildings (building_type);
CREATE INDEX IF NOT EXISTS buildings_name_idx ON buildings USING GIN (to_tsvector('english', name));

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_buildings_updated_at ON buildings;
CREATE TRIGGER update_buildings_updated_at 
    BEFORE UPDATE ON buildings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample building data (New York City area)
INSERT INTO buildings (name, height, building_type, address, geometry) VALUES
-- Empire State Building
('Empire State Building', 443.2, 'office', '350 5th Ave, New York, NY 10118', 
 ST_GeomFromText('POLYGONZ((-74.0060 40.7484 0, -74.0055 40.7484 0, -74.0055 40.7489 0, -74.0060 40.7489 0, -74.0060 40.7484 0))', 4326)),

-- One World Trade Center
('One World Trade Center', 541.3, 'office', '285 Fulton St, New York, NY 10007', 
 ST_GeomFromText('POLYGONZ((-74.0130 40.7128 0, -74.0125 40.7128 0, -74.0125 40.7133 0, -74.0130 40.7133 0, -74.0130 40.7128 0))', 4326)),

-- Central Park Tower
('Central Park Tower', 472.4, 'residential', '225 W 57th St, New York, NY 10019', 
 ST_GeomFromText('POLYGONZ((-73.9800 40.7650 0, -73.9795 40.7650 0, -73.9795 40.7655 0, -73.9800 40.7655 0, -73.9800 40.7650 0))', 4326)),

-- 111 West 57th Street
('111 West 57th Street', 435.3, 'residential', '111 W 57th St, New York, NY 10019', 
 ST_GeomFromText('POLYGONZ((-73.9750 40.7650 0, -73.9745 40.7650 0, -73.9745 40.7655 0, -73.9750 40.7655 0, -73.9750 40.7650 0))', 4326)),

-- 432 Park Avenue
('432 Park Avenue', 425.5, 'residential', '432 Park Ave, New York, NY 10022', 
 ST_GeomFromText('POLYGONZ((-73.9700 40.7600 0, -73.9695 40.7600 0, -73.9695 40.7605 0, -73.9700 40.7605 0, -73.9700 40.7600 0))', 4326)),

-- 30 Hudson Yards
('30 Hudson Yards', 395.0, 'office', '30 Hudson Yards, New York, NY 10001', 
 ST_GeomFromText('POLYGONZ((-74.0080 40.7550 0, -74.0075 40.7550 0, -74.0075 40.7555 0, -74.0080 40.7555 0, -74.0080 40.7550 0))', 4326)),

-- 40 Wall Street
('40 Wall Street', 282.5, 'office', '40 Wall St, New York, NY 10005', 
 ST_GeomFromText('POLYGONZ((-74.0090 40.7070 0, -74.0085 40.7070 0, -74.0085 40.7075 0, -74.0090 40.7075 0, -74.0090 40.7070 0))', 4326)),

-- Trump World Tower
('Trump World Tower', 262.0, 'residential', '845 United Nations Plaza, New York, NY 10017', 
 ST_GeomFromText('POLYGONZ((-73.9700 40.7500 0, -73.9695 40.7500 0, -73.9695 40.7505 0, -73.9700 40.7505 0, -73.9700 40.7500 0))', 4326)),

-- 56 Leonard Street
('56 Leonard Street', 250.2, 'residential', '56 Leonard St, New York, NY 10013', 
 ST_GeomFromText('POLYGONZ((-74.0050 40.7200 0, -74.0045 40.7200 0, -74.0045 40.7205 0, -74.0050 40.7205 0, -74.0050 40.7200 0))', 4326)),

-- 8 Spruce Street
('8 Spruce Street', 267.0, 'residential', '8 Spruce St, New York, NY 10038', 
 ST_GeomFromText('POLYGONZ((-74.0040 40.7100 0, -74.0035 40.7100 0, -74.0035 40.7105 0, -74.0040 40.7105 0, -74.0040 40.7100 0))', 4326)),

-- Hotel buildings
('The Plaza Hotel', 76.2, 'hotel', '768 5th Ave, New York, NY 10019', 
 ST_GeomFromText('POLYGONZ((-73.9750 40.7640 0, -73.9745 40.7640 0, -73.9745 40.7645 0, -73.9750 40.7645 0, -73.9750 40.7640 0))', 4326)),

('Waldorf Astoria', 191.0, 'hotel', '301 Park Ave, New York, NY 10022', 
 ST_GeomFromText('POLYGONZ((-73.9750 40.7560 0, -73.9745 40.7560 0, -73.9745 40.7565 0, -73.9750 40.7565 0, -73.9750 40.7560 0))', 4326)),

-- Commercial buildings
('Times Square Tower', 237.0, 'commercial', '7 Times Square, New York, NY 10036', 
 ST_GeomFromText('POLYGONZ((-73.9880 40.7550 0, -73.9875 40.7550 0, -73.9875 40.7555 0, -73.9880 40.7555 0, -73.9880 40.7550 0))', 4326)),

('MetLife Building', 246.0, 'commercial', '200 Park Ave, New York, NY 10166', 
 ST_GeomFromText('POLYGONZ((-73.9780 40.7500 0, -73.9775 40.7500 0, -73.9775 40.7505 0, -73.9780 40.7505 0, -73.9780 40.7500 0))', 4326)),

-- Retail buildings
('Macy''s Herald Square', 45.7, 'retail', '151 W 34th St, New York, NY 10001', 
 ST_GeomFromText('POLYGONZ((-73.9900 40.7500 0, -73.9895 40.7500 0, -73.9895 40.7505 0, -73.9900 40.7505 0, -73.9900 40.7500 0))', 4326)),

('Apple Fifth Avenue', 32.0, 'retail', '767 5th Ave, New York, NY 10153', 
 ST_GeomFromText('POLYGONZ((-73.9740 40.7630 0, -73.9735 40.7630 0, -73.9735 40.7635 0, -73.9740 40.7635 0, -73.9740 40.7630 0))', 4326)),

-- Industrial buildings
('Brooklyn Navy Yard Building 92', 45.0, 'industrial', '63 Flushing Ave, Brooklyn, NY 11205', 
 ST_GeomFromText('POLYGONZ((-73.9700 40.7000 0, -73.9695 40.7000 0, -73.9695 40.7005 0, -73.9700 40.7005 0, -73.9700 40.7000 0))', 4326)),

('Industry City', 38.0, 'industrial', '220 36th St, Brooklyn, NY 11232', 
 ST_GeomFromText('POLYGONZ((-74.0000 40.6500 0, -73.9995 40.6500 0, -73.9995 40.6505 0, -74.0000 40.6505 0, -74.0000 40.6500 0))', 4326));

-- Create views for common queries
CREATE OR REPLACE VIEW building_statistics AS
SELECT 
    COUNT(*) as total_buildings,
    AVG(height) as avg_height,
    MAX(height) as max_height,
    MIN(height) as min_height,
    building_type,
    COUNT(*) as count_by_type
FROM buildings 
GROUP BY building_type
ORDER BY count_by_type DESC;

-- Create view for tallest buildings
CREATE OR REPLACE VIEW tallest_buildings AS
SELECT 
    name,
    height,
    building_type,
    address,
    ROW_NUMBER() OVER (ORDER BY height DESC) as rank
FROM buildings
ORDER BY height DESC;

-- Create function to get buildings within radius
CREATE OR REPLACE FUNCTION get_buildings_in_radius(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION
)
RETURNS TABLE (
    id INTEGER,
    name VARCHAR(255),
    height DECIMAL(10,2),
    building_type VARCHAR(100),
    address TEXT,
    distance_meters DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.height,
        b.building_type,
        b.address,
        ST_Distance(b.geometry::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) as distance_meters
    FROM buildings b
    WHERE ST_DWithin(
        b.geometry::geography, 
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, 
        radius_meters
    )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to search buildings by text
CREATE OR REPLACE FUNCTION search_buildings(search_term TEXT)
RETURNS TABLE (
    id INTEGER,
    name VARCHAR(255),
    height DECIMAL(10,2),
    building_type VARCHAR(100),
    address TEXT,
    rank DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.height,
        b.building_type,
        b.address,
        ts_rank(to_tsvector('english', b.name || ' ' || b.building_type || ' ' || COALESCE(b.address, '')), plainto_tsquery('english', search_term)) as rank
    FROM buildings b
    WHERE to_tsvector('english', b.name || ' ' || b.building_type || ' ' || COALESCE(b.address, '')) @@ plainto_tsquery('english', search_term)
    ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_user;
