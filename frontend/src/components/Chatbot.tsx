import React, { useState, useEffect, useRef } from 'react';

// Simple SVG icon components to replace heroicons
const PaperAirplaneIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const ChatBubbleLeftRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

interface Building {
  id: number;
  name: string;
  height: number;
  building_type: string;
  address: string;
  geometry: any;
}

interface ChatbotProps {
  onBuildingHighlight: (building: Building) => void;
  onMultiBuildingHighlight?: (buildings: Building[]) => void;
  sidebarOpen?: boolean;
}

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  type?: 'text' | 'search_results';
  buildings?: Building[];
}

const Chatbot: React.FC<ChatbotProps> = ({ onBuildingHighlight, onMultiBuildingHighlight, sidebarOpen = true }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I can help you analyze building data. Ask me about the tallest buildings, search by type, or get detailed statistics.",
      sender: 'bot'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    // Fetch suggestions when component mounts
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/chat/suggestions');
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now(),
      text: inputValue,
      sender: 'user'
    };

    console.log('Adding user message:', userMessage);
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      console.log('Updated messages after user:', newMessages);
      return newMessages;
    });
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: inputValue }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Received bot response:', data);
        
        // Handle the actual API response format
        const botMessage: Message = {
          id: Date.now() + 1,
          text: data.content || data.response || 'No response received',
          sender: 'bot',
          type: data.type || 'text',
          buildings: data.building ? [data.building] : data.buildings || []
        };

        console.log('Adding bot message:', botMessage);
        setMessages(prev => {
          const newMessages = [...prev, botMessage];
          console.log('Updated messages after bot:', newMessages);
          return newMessages;
        });

        // Handle building highlighting based on response type
        if (botMessage.buildings && botMessage.buildings.length > 0) {
          if (botMessage.buildings.length === 1) {
            // Single building - highlight it
            onBuildingHighlight(botMessage.buildings[0]);
          } else if (onMultiBuildingHighlight) {
            // Multiple buildings - highlight all of them
            onMultiBuildingHighlight(botMessage.buildings);
          }
        }
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "Sorry, I'm having trouble processing your request. Please try again.",
        sender: 'bot'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      console.log('Setting loading to false');
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  if (!sidebarOpen) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={() => {/* This would toggle sidebar in parent */}}
          className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-all duration-200 hover:scale-110"
        >
          <ChatBubbleLeftRightIcon className="w-6 h-6" />
        </button>
      </div>
    );
  }

  console.log('Rendering Chatbot with messages:', messages, 'isLoading:', isLoading);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">AI Assistant</h3>
            <p className="text-gray-400 text-xs">Building Analysis Expert</p>
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900 min-h-0">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg shadow-sm ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-200 border border-gray-600'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                {message.type === 'search_results' && message.buildings && (
                  <div className="mt-3 space-y-2">
                    {message.buildings.map((building, index) => (
                      <div
                        key={index}
                        className="text-sm p-2 bg-gray-800 rounded border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors"
                        onClick={() => onBuildingHighlight(building)}
                      >
                        <div className="font-medium text-white">{building.name}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {building.height}m • {building.building_type}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-700 text-gray-200 px-3 py-2 rounded-lg border border-gray-600">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>
      
      {/* Suggestions */}
      {suggestions.length > 0 && messages.length === 1 && (
        <div className="px-4 py-3 bg-gray-800 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-2">💡 Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 6).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-xs px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors text-gray-300 hover:text-white hover:border-gray-500"
              >
                {suggestion}
              </button>
            ))}
          </div>
          {suggestions.length > 6 && (
            <p className="text-xs text-gray-500 mt-2">
              💡 Type to see more suggestions or ask anything about buildings!
            </p>
          )}
        </div>
      )}
      
      {/* Input */}
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about buildings..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 text-sm"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !inputValue.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
