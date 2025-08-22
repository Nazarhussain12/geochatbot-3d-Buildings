const pool = require('../config/database');

class ChatbotService {
  constructor() {
    this.pool = pool;
  }

  async processQuery(message) {
    const lowerMessage = message.toLowerCase();
    
    // Check for tallest building queries
    if (lowerMessage.includes('tallest') || lowerMessage.includes('highest') || lowerMessage.includes('maximum height')) {
      return await this.getTallestBuilding();
    }
    
    // Check for shortest building queries
    if (lowerMessage.includes('shortest') || lowerMessage.includes('lowest') || lowerMessage.includes('minimum height')) {
      return await this.getShortestBuilding();
    }
    
    // Check for top N buildings queries
    if (lowerMessage.includes('top') && (lowerMessage.includes('buildings') || lowerMessage.includes('tallest'))) {
      const numberMatch = lowerMessage.match(/top\s+(\d+)/i);
      const limit = numberMatch ? parseInt(numberMatch[1]) : 5;
      return await this.getTopBuildings(limit);
    }
    
    // Check for building comparison queries
    if (lowerMessage.includes('compare') || lowerMessage.includes('difference') || lowerMessage.includes('vs') || lowerMessage.includes('versus')) {
      return await this.compareBuildings(message);
    }
    
    // Check for height range analysis
    if (lowerMessage.includes('height range') || lowerMessage.includes('between') || lowerMessage.includes('tall buildings') || lowerMessage.includes('skyscrapers')) {
      return await this.getHeightRangeAnalysis(message);
    }
    
    // Check for building type analysis
    if (lowerMessage.includes('type') && (lowerMessage.includes('distribution') || lowerMessage.includes('breakdown') || lowerMessage.includes('category'))) {
      return await this.getBuildingTypeAnalysis();
    }
    
    // Check for search queries
    if (lowerMessage.includes('search') || lowerMessage.includes('find') || lowerMessage.includes('show') || lowerMessage.includes('list')) {
      return await this.searchBuildings(message);
    }
    
    // Check for statistics queries
    if (lowerMessage.includes('statistics') || lowerMessage.includes('stats') || lowerMessage.includes('summary') || lowerMessage.includes('overview')) {
      return await this.getBuildingStatistics();
    }
    
    // Check for nearby building queries
    if (lowerMessage.includes('near') || lowerMessage.includes('around') || lowerMessage.includes('within') || lowerMessage.includes('distance')) {
      return await this.getNearbyBuildings(message);
    }
    
    // Check for specific building queries
    if (lowerMessage.includes('empire state') || lowerMessage.includes('world trade') || lowerMessage.includes('chrysler')) {
      return await this.getSpecificBuilding(message);
    }
    
    // Check for address search
    if (lowerMessage.includes('address') || lowerMessage.includes('location') || lowerMessage.includes('street')) {
      return await this.searchByAddress(message);
    }
    
    // Check for building count queries
    if (lowerMessage.includes('how many') || lowerMessage.includes('count') || lowerMessage.includes('total number')) {
      return await this.getBuildingCount(message);
    }
    
    // Default response
    return {
      type: 'text',
      content: 'I can help you analyze building data! Try asking about:\n\n• Tallest/shortest buildings\n• Top 5 tallest buildings\n• Building comparisons\n• Height ranges and skyscrapers\n• Building type distribution\n• Search by type or height\n• Building statistics\n• Specific buildings by name\n• Buildings by address\n• How many buildings of a certain type'
    };
  }

  async getTallestBuilding() {
    try {
      const result = await this.pool.query(
        'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings ORDER BY height DESC LIMIT 1'
      );
      
      if (result.rows.length > 0) {
        const building = result.rows[0];
        return {
          type: 'building_highlight',
          content: `🏗️ **Tallest Building**: ${building.name}\n\n📏 **Height**: ${building.height} meters\n🏢 **Type**: ${building.building_type}\n📍 **Address**: ${building.address}\n\nThis is the tallest building in our database!`,
          building: building
        };
      }
      
      return {
        type: 'text',
        content: 'No building data available in the database.'
      };
    } catch (error) {
      console.error('Error getting tallest building:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while searching for the tallest building.'
      };
    }
  }

  async getShortestBuilding() {
    try {
      const result = await this.pool.query(
        'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings ORDER BY height ASC LIMIT 1'
      );
      
      if (result.rows.length > 0) {
        const building = result.rows[0];
        return {
          type: 'building_highlight',
          content: `🏗️ **Shortest Building**: ${building.name}\n\n📏 **Height**: ${building.height} meters\n🏢 **Type**: ${building.building_type}\n📍 **Address**: ${building.address}\n\nThis is the shortest building in our database!`,
          building: building
        };
      }
      
      return {
        type: 'text',
        content: 'No building data available in the database.'
      };
    } catch (error) {
      console.error('Error getting shortest building:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while searching for the shortest building.'
      };
    }
  }

  async getTopBuildings(limit = 5) {
    try {
      const result = await this.pool.query(
        'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings ORDER BY height DESC LIMIT $1',
        [limit]
      );
      
      if (result.rows.length > 0) {
        let content = `🏆 **Top ${limit} Tallest Buildings**:\n\n`;
        result.rows.forEach((building, index) => {
          content += `${index + 1}. **${building.name}** - ${building.height}m (${building.building_type})\n`;
        });
        
        return {
          type: 'search_results',
          content: content,
          buildings: result.rows
        };
      }
      
      return {
        type: 'text',
        content: 'No building data available in the database.'
      };
    } catch (error) {
      console.error('Error getting top buildings:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while retrieving the top buildings.'
      };
    }
  }

  async compareBuildings(message) {
    try {
      // Extract building names from message
      const buildingNames = ['empire state', 'world trade', 'chrysler', 'bank of america', 'new york times'];
      const foundBuildings = buildingNames.filter(name => message.toLowerCase().includes(name));
      
      if (foundBuildings.length < 2) {
        return {
          type: 'text',
          content: 'Please specify two buildings to compare. Try: "Compare Empire State Building vs One World Trade Center"'
        };
      }
      
      const result = await this.pool.query(
        'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings WHERE LOWER(name) LIKE ANY($1) ORDER BY height DESC',
        [foundBuildings.map(name => `%${name}%`)]
      );
      
      if (result.rows.length >= 2) {
        const building1 = result.rows[0];
        const building2 = result.rows[1];
        const heightDiff = Math.abs(building1.height - building2.height);
        
        let content = `🏗️ **Building Comparison**:\n\n`;
        content += `**${building1.name}**\n`;
        content += `📏 Height: ${building1.height}m\n`;
        content += `🏢 Type: ${building1.building_type}\n\n`;
        content += `**${building2.name}**\n`;
        content += `📏 Height: ${building2.height}m\n`;
        content += `🏢 Type: ${building2.building_type}\n\n`;
        content += `📊 **Difference**: ${heightDiff.toFixed(1)}m\n`;
        content += `🏆 **Taller**: ${building1.height > building2.height ? building1.name : building2.name}`;
        
        return {
          type: 'search_results',
          content: content,
          buildings: result.rows
        };
      }
      
      return {
        type: 'text',
        content: 'Could not find the specified buildings for comparison.'
      };
    } catch (error) {
      console.error('Error comparing buildings:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while comparing buildings.'
      };
    }
  }

  async getHeightRangeAnalysis(message) {
    try {
      // Extract height ranges from message
      const heightMatch = message.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(?:meters?|m)/i);
      const minHeight = heightMatch ? parseFloat(heightMatch[1]) : 100;
      const maxHeight = heightMatch ? parseFloat(heightMatch[2]) : 500;
      
      const result = await this.pool.query(
        'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings WHERE height BETWEEN $1 AND $2 ORDER BY height DESC',
        [minHeight, maxHeight]
      );
      
      if (result.rows.length > 0) {
        const avgHeight = result.rows.reduce((sum, building) => sum + parseFloat(building.height), 0) / result.rows.length;
        
        let content = `📊 **Height Range Analysis** (${minHeight}-${maxHeight}m):\n\n`;
        content += `🏢 **Total Buildings**: ${result.rows.length}\n`;
        content += `📏 **Average Height**: ${avgHeight.toFixed(1)}m\n\n`;
        content += `**Buildings in this range**:\n`;
        
        result.rows.slice(0, 5).forEach((building, index) => {
          content += `${index + 1}. ${building.name} - ${building.height}m\n`;
        });
        
        if (result.rows.length > 5) {
          content += `... and ${result.rows.length - 5} more buildings`;
        }
        
        return {
          type: 'search_results',
          content: content,
          buildings: result.rows
        };
      }
      
      return {
        type: 'text',
        content: `No buildings found in the height range of ${minHeight}-${maxHeight} meters.`
      };
    } catch (error) {
      console.error('Error getting height range analysis:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while analyzing height ranges.'
      };
    }
  }

  async getBuildingTypeAnalysis() {
    try {
      const result = await this.pool.query(`
        SELECT 
          building_type,
          COUNT(*) as count,
          AVG(height) as avg_height,
          MAX(height) as max_height,
          MIN(height) as min_height
        FROM buildings 
        GROUP BY building_type
        ORDER BY count DESC
      `);
      
      if (result.rows.length > 0) {
        const totalBuildings = result.rows.reduce((sum, stat) => sum + parseInt(stat.count), 0);
        
        let content = `📊 **Building Type Distribution**:\n\n`;
        content += `🏗️ **Total Buildings**: ${totalBuildings}\n\n`;
        
        result.rows.forEach(stat => {
          const percentage = ((parseInt(stat.count) / totalBuildings) * 100).toFixed(1);
          content += `🏢 **${stat.building_type}**: ${stat.count} buildings (${percentage}%)\n`;
          content += `   📏 Avg: ${parseFloat(stat.avg_height).toFixed(1)}m | Max: ${stat.max_height}m | Min: ${stat.min_height}m\n\n`;
        });
        
        return {
          type: 'text',
          content: content
        };
      }
      
      return {
        type: 'text',
        content: 'No building data available for type analysis.'
      };
    } catch (error) {
      console.error('Error getting building type analysis:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while analyzing building types.'
      };
    }
  }

  async searchBuildings(message) {
    try {
      // Extract search terms from message
      const buildingTypes = ['office', 'residential', 'commercial', 'hotel', 'apartment', 'retail', 'industrial'];
      const foundTypes = buildingTypes.filter(type => message.toLowerCase().includes(type));
      
      // Extract height range
      const heightMatch = message.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(?:meters?|m)/i);
      const singleHeightMatch = message.match(/(\d+)\s*(?:meters?|m)/i);
      const overHeightMatch = message.match(/over\s+(\d+)\s*(?:meters?|m)/i);
      const underHeightMatch = message.match(/under\s+(\d+)\s*(?:meters?|m)/i);
      
      let query = 'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings WHERE 1=1';
      const params = [];
      let paramCount = 0;
      
      if (foundTypes.length > 0) {
        paramCount++;
        params.push(foundTypes.map(type => `%${type}%`));
        query += ` AND building_type ILIKE ANY($${paramCount})`;
      }
      
      if (heightMatch) {
        paramCount++;
        params.push(parseFloat(heightMatch[1]));
        query += ` AND height >= $${paramCount}`;
        paramCount++;
        params.push(parseFloat(heightMatch[2]));
        query += ` AND height <= $${paramCount}`;
      } else if (singleHeightMatch) {
        paramCount++;
        params.push(parseFloat(singleHeightMatch[1]));
        query += ` AND height >= $${paramCount}`;
      } else if (overHeightMatch) {
        paramCount++;
        params.push(parseFloat(overHeightMatch[1]));
        query += ` AND height > $${paramCount}`;
      } else if (underHeightMatch) {
        paramCount++;
        params.push(parseFloat(underHeightMatch[1]));
        query += ` AND height < $${paramCount}`;
      }
      
      query += ' ORDER BY height DESC LIMIT 10';
      
      const result = await this.pool.query(query, params);
      
      if (result.rows.length > 0) {
        let content = `🔍 **Search Results**: Found ${result.rows.length} buildings`;
        if (foundTypes.length > 0) content += ` of type: ${foundTypes.join(', ')}`;
        if (heightMatch) content += ` between ${heightMatch[1]}-${heightMatch[2]}m`;
        if (overHeightMatch) content += ` over ${overHeightMatch[1]}m`;
        if (underHeightMatch) content += ` under ${underHeightMatch[1]}m`;
        content += `\n\n`;
        
        result.rows.forEach((building, index) => {
          content += `${index + 1}. **${building.name}** - ${building.height}m (${building.building_type})\n`;
        });
        
        return {
          type: 'search_results',
          content: content,
          buildings: result.rows
        };
      } else {
        return {
          type: 'text',
          content: 'No buildings found matching your search criteria. Try different keywords or height ranges.'
        };
      }
    } catch (error) {
      console.error('Error searching buildings:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while searching for buildings.'
      };
    }
  }

  async getBuildingStatistics() {
    try {
      const result = await this.pool.query(`
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
      
      if (result.rows.length > 0) {
        const stats = result.rows;
        const totalBuildings = stats.reduce((sum, stat) => sum + parseInt(stat.count_by_type), 0);
        const avgHeight = stats.reduce((sum, stat) => sum + parseFloat(stat.avg_height) * parseInt(stat.count_by_type), 0) / totalBuildings;
        
        let content = `📊 **Building Statistics**:\n\n`;
        content += `🏗️ **Total Buildings**: ${totalBuildings}\n`;
        content += `📏 **Average Height**: ${avgHeight.toFixed(1)} meters\n`;
        content += `🏆 **Tallest Building**: ${stats[0].max_height} meters\n`;
        content += `📉 **Shortest Building**: ${stats[0].min_height} meters\n\n`;
        content += `**Buildings by Type**:\n`;
        
        stats.forEach(stat => {
          const percentage = ((parseInt(stat.count_by_type) / totalBuildings) * 100).toFixed(1);
          content += `• ${stat.building_type}: ${stat.count_by_type} buildings (${percentage}%) - avg: ${parseFloat(stat.avg_height).toFixed(1)}m\n`;
        });
        
        return {
          type: 'text',
          content: content
        };
      }
      
      return {
        type: 'text',
        content: 'No building data available for statistics.'
      };
    } catch (error) {
      console.error('Error getting building statistics:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while retrieving building statistics.'
      };
    }
  }

  async getSpecificBuilding(message) {
    try {
      const buildingNames = ['empire state', 'world trade', 'chrysler', 'bank of america', 'new york times'];
      const foundName = buildingNames.find(name => message.toLowerCase().includes(name));
      
      if (!foundName) {
        return {
          type: 'text',
          content: 'Please specify a building name. Try: "Tell me about Empire State Building"'
        };
      }
      
      const result = await this.pool.query(
        'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings WHERE LOWER(name) LIKE $1',
        [`%${foundName}%`]
      );
      
      if (result.rows.length > 0) {
        const building = result.rows[0];
        return {
          type: 'building_highlight',
          content: `🏗️ **${building.name}**\n\n📏 **Height**: ${building.height} meters\n🏢 **Type**: ${building.building_type}\n📍 **Address**: ${building.address}\n\nThis iconic building is one of New York City\'s most recognizable landmarks!`,
          building: building
        };
      }
      
      return {
        type: 'text',
        content: `Could not find information about ${foundName}.`
      };
    } catch (error) {
      console.error('Error getting specific building:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while searching for the building.'
      };
    }
  }

  async searchByAddress(message) {
    try {
      // Extract address keywords
      const addressKeywords = ['street', 'avenue', 'ave', 'st', 'road', 'rd', 'boulevard', 'blvd'];
      const foundKeywords = addressKeywords.filter(keyword => message.toLowerCase().includes(keyword));
      
      if (foundKeywords.length === 0) {
        return {
          type: 'text',
          content: 'Please specify an address or street name. Try: "Find buildings on 5th Avenue"'
        };
      }
      
      const result = await this.pool.query(
        'SELECT id, name, height, building_type, address, ST_AsGeoJSON(geometry) as geometry FROM buildings WHERE LOWER(address) LIKE ANY($1) ORDER BY height DESC',
        [foundKeywords.map(keyword => `%${keyword}%`)]
      );
      
      if (result.rows.length > 0) {
        let content = `📍 **Buildings by Address**: Found ${result.rows.length} buildings\n\n`;
        
        result.rows.forEach((building, index) => {
          content += `${index + 1}. **${building.name}**\n`;
          content += `   📏 Height: ${building.height}m\n`;
          content += `   🏢 Type: ${building.building_type}\n`;
          content += `   📍 Address: ${building.address}\n\n`;
        });
        
        return {
          type: 'search_results',
          content: content,
          buildings: result.rows
        };
      }
      
      return {
        type: 'text',
        content: 'No buildings found at the specified address or street.'
      };
    } catch (error) {
      console.error('Error searching by address:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while searching by address.'
      };
    }
  }

  async getBuildingCount(message) {
    try {
      const buildingTypes = ['office', 'residential', 'commercial', 'hotel', 'apartment', 'retail', 'industrial'];
      const foundTypes = buildingTypes.filter(type => message.toLowerCase().includes(type));
      
      if (foundTypes.length === 0) {
        // Get total count
        const result = await this.pool.query('SELECT COUNT(*) as total FROM buildings');
        return {
          type: 'text',
          content: `🏗️ **Total Buildings**: ${result.rows[0].total} buildings in the database.`
        };
      }
      
      const result = await this.pool.query(
        'SELECT building_type, COUNT(*) as count FROM buildings WHERE building_type ILIKE ANY($1) GROUP BY building_type',
        [foundTypes.map(type => `%${type}%`)]
      );
      
      if (result.rows.length > 0) {
        let content = `🔢 **Building Count**:\n\n`;
        result.rows.forEach(stat => {
          content += `🏢 **${stat.building_type}**: ${stat.count} buildings\n`;
        });
        
        return {
          type: 'text',
          content: content
        };
      }
      
      return {
        type: 'text',
        content: `No ${foundTypes.join(', ')} buildings found in the database.`
      };
    } catch (error) {
      console.error('Error getting building count:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error while counting buildings.'
      };
    }
  }

  async getNearbyBuildings(message) {
    // For now, return a default response since we need coordinates
    return {
      type: 'text',
      content: '📍 To find buildings near a specific location, please provide the latitude and longitude coordinates, or use the map interface to select a location. You can also try searching by address or street name.'
    };
  }
}

module.exports = ChatbotService;
