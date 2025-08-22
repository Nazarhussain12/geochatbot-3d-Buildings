const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all buildings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings ORDER BY height DESC LIMIT 1000'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching buildings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get tallest building
router.get('/tallest', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings ORDER BY height DESC LIMIT 1'
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Error fetching tallest building:', err);
    res.status(500).json({ error: err.message });
  }
});

// Search buildings by criteria
router.get('/search', async (req, res) => {
  const { type, minHeight, maxHeight, limit = 50 } = req.query;
  
  try {
    let query = 'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (type) {
      paramCount++;
      params.push(type);
      query += ` AND building_type ILIKE $${paramCount}`;
    }
    
    if (minHeight) {
      paramCount++;
      params.push(parseFloat(minHeight));
      query += ` AND height >= $${paramCount}`;
    }
    
    if (maxHeight) {
      paramCount++;
      params.push(parseFloat(maxHeight));
      query += ` AND height <= $${paramCount}`;
    }
    
    query += ` ORDER BY height DESC LIMIT ${parseInt(limit)}`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error searching buildings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get buildings in radius
router.get('/nearby', async (req, res) => {
  const { lat, lng, radius = 1000 } = req.query;
  
  try {
    const result = await pool.query(
      `SELECT id, name, height, building_type, address, 
              ST_AsGeoJSON(geometry) as geometry,
              ST_Distance(geometry::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance
       FROM buildings 
       WHERE ST_DWithin(
         geometry::geography, 
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
         $3
       )
       ORDER BY distance ASC`,
      [parseFloat(lng), parseFloat(lat), parseFloat(radius)]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching nearby buildings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get building statistics
router.get('/statistics', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_buildings,
        AVG(height) as avg_height,
        MAX(height) as max_height,
        MIN(height) as min_height,
        building_type,
        COUNT(*) as count_by_type
      FROM buildings 
      GROUP BY building_type
      ORDER BY count_by_type DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching building statistics:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get building by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Building not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching building by ID:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get random sample of buildings
router.get('/random', async (req, res) => {
  const { limit = 250 } = req.query;
  
  try {
    const result = await pool.query(
      'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings ORDER BY RANDOM() LIMIT $1',
      [parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching random buildings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get buildings by type
router.get('/type/:buildingType', async (req, res) => {
  const { buildingType } = req.params;
  const { limit = 100 } = req.query;
  
  try {
    const result = await pool.query(
      'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings WHERE building_type ILIKE $1 ORDER BY height DESC LIMIT $2',
      [`%${buildingType}%`, parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching buildings by type:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
