const express = require('express');
const router = express.Router();
const ChatbotService = require('../services/chatbot');

const chatbotService = new ChatbotService();

// Process chat message
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: 'Message is required and must be a string' 
      });
    }
    
    const response = await chatbotService.processQuery(message);
    res.json(response);
    
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      message: 'An error occurred while processing your request.'
    });
  }
});

// Get chat suggestions
router.get('/suggestions', (req, res) => {
  const suggestions = [
    // Basic queries
    "What is the tallest building?",
    "Show me the shortest building",
    "Get building statistics",
    
    // Top buildings
    "Show me top 5 tallest buildings",
    "List top 10 buildings",
    "What are the tallest 3 buildings?",
    
    // Building comparisons
    "Compare Empire State Building vs One World Trade Center",
    "What's the difference between Chrysler Building and Bank of America Tower?",
    
    // Height analysis
    "Show me buildings between 200-400 meters",
    "Find skyscrapers over 300 meters",
    "What buildings are under 100 meters tall?",
    "Show me tall buildings over 200m",
    
    // Building types
    "Show me office buildings",
    "Find residential buildings",
    "List hotel buildings",
    "How many commercial buildings are there?",
    "Show building type distribution",
    
    // Specific buildings
    "Tell me about Empire State Building",
    "What's the height of One World Trade Center?",
    "Show me Chrysler Building details",
    
    // Address search
    "Find buildings on 5th Avenue",
    "Show buildings on Broadway",
    "What buildings are on Park Avenue?",
    
    // Count queries
    "How many buildings are there?",
    "How many office buildings?",
    "Count residential buildings",
    
    // Advanced searches
    "Find office buildings over 200 meters",
    "Show residential buildings under 150 meters",
    "List commercial buildings between 100-300 meters"
  ];
  
  res.json({ suggestions });
});

module.exports = router;
