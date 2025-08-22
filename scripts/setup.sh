#!/bin/bash

# 3D Building Data Management System Setup Script
# This script automates the setup process for the entire application

set -e

echo "🏗️  Setting up 3D Building Data Management System..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Node.js is installed
check_nodejs() {
    print_status "Checking Node.js installation..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is installed: $NODE_VERSION"
    else
        print_error "Node.js is not installed. Please install Node.js 16 or higher."
        print_status "Visit: https://nodejs.org/"
        exit 1
    fi
}

# Check if PostgreSQL is installed
check_postgresql() {
    print_status "Checking PostgreSQL installation..."
    if command -v psql &> /dev/null; then
        print_success "PostgreSQL is installed"
    else
        print_warning "PostgreSQL is not installed. Please install PostgreSQL with PostGIS extension."
        print_status "Visit: https://www.postgresql.org/download/"
        print_status "Make sure to install PostGIS extension during PostgreSQL installation."
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    
    # Install root dependencies
    npm install
    
    # Install backend dependencies
    if [ -d "backend" ]; then
        print_status "Installing backend dependencies..."
        cd backend
        npm install
        cd ..
    fi
    
    # Install frontend dependencies
    if [ -d "frontend" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend
        npm install
        cd ..
    fi
    
    print_success "All dependencies installed successfully"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from template..."
        cp env.example .env
        print_status "Please edit .env file with your database credentials"
    fi
    
    # Load environment variables
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    # Check database connection
    if command -v psql &> /dev/null; then
        print_status "Testing database connection..."
        if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1;" &> /dev/null; then
            print_success "Database connection successful"
            
            # Create database if it doesn't exist
            print_status "Creating database if it doesn't exist..."
            PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || print_warning "Database might already exist"
            
            # Run schema
            print_status "Setting up database schema..."
            if [ -f "database/schema.sql" ]; then
                PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/schema.sql
                print_success "Database schema created successfully"
            else
                print_error "Schema file not found: database/schema.sql"
            fi
        else
            print_error "Cannot connect to database. Please check your .env configuration."
            print_status "Make sure PostgreSQL is running and credentials are correct."
        fi
    else
        print_warning "PostgreSQL client not found. Please install PostgreSQL client tools."
    fi
}

# Build frontend
build_frontend() {
    print_status "Building frontend application..."
    if [ -d "frontend" ]; then
        cd frontend
        npm run build
        cd ..
        print_success "Frontend built successfully"
    else
        print_warning "Frontend directory not found"
    fi
}

# Create startup scripts
create_startup_scripts() {
    print_status "Creating startup scripts..."
    
    # Create start script
    cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting 3D Building Data Management System..."
echo "Backend will run on http://localhost:3001"
echo "Frontend will run on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start backend
cd backend && npm start &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
cd frontend && npm start &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
EOF

    # Create development script
    cat > dev.sh << 'EOF'
#!/bin/bash
echo "Starting development mode..."
echo "Backend will run on http://localhost:3001"
echo "Frontend will run on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start both backend and frontend in development mode
npm run dev
EOF

    # Make scripts executable
    chmod +x start.sh dev.sh
    
    print_success "Startup scripts created: start.sh, dev.sh"
}

# Main setup function
main() {
    echo ""
    print_status "Starting setup process..."
    
    # Check prerequisites
    check_nodejs
    check_postgresql
    
    # Install dependencies
    install_dependencies
    
    # Setup database
    setup_database
    
    # Build frontend
    build_frontend
    
    # Create startup scripts
    create_startup_scripts
    
    echo ""
    print_success "Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env file with your database credentials"
    echo "2. Run './start.sh' to start the application"
    echo "3. Run './dev.sh' for development mode"
    echo ""
    echo "The application will be available at:"
    echo "- Frontend: http://localhost:3000"
    echo "- Backend API: http://localhost:3001"
    echo "- Health check: http://localhost:3001/health"
    echo ""
}

# Run main function
main "$@"
