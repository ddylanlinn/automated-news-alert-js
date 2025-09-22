#!/bin/bash
# Zeabur deployment script

echo "=== News Crawler Zeabur Deployment Script ==="
echo

# Check required files
echo "Checking required files..."
required_files=("Dockerfile" "zeabur.yaml" "package.json" "tsconfig.json")
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
done
echo "✅ All required files exist"
echo

# Check environment variables
echo "Checking environment variables..."
if [ -z "$EMAIL_USERNAME" ]; then
    echo "⚠️  Warning: EMAIL_USERNAME not set"
fi
if [ -z "$EMAIL_PASSWORD" ]; then
    echo "⚠️  Warning: EMAIL_PASSWORD not set"
fi
if [ -z "$EMAIL_FROM_EMAIL" ]; then
    echo "⚠️  Warning: EMAIL_FROM_EMAIL not set"
fi
if [ -z "$EMAIL_TO_EMAILS" ]; then
    echo "⚠️  Warning: EMAIL_TO_EMAILS not set"
fi
echo

# Show deployment options
echo "Deployment options:"
echo "1. Local Docker test"
echo "2. Push to Git repository (for Zeabur auto-deployment)"
echo "3. Show deployment guide"
echo

read -p "Please choose (1-3): " choice

case $choice in
    1)
        echo "=== Local Docker Test ==="
        echo "Building Docker image..."
        docker build -t news-crawler .
        
        if [ $? -eq 0 ]; then
            echo "✅ Docker image built successfully"
            echo
            echo "Run container (environment variables need to be set):"
            echo "docker run -d \\"
            echo "  -p 8080:8080 \\"
            echo "  -e EMAIL_USERNAME=your-email@gmail.com \\"
            echo "  -e EMAIL_PASSWORD=your-app-password \\"
            echo "  -e EMAIL_FROM_EMAIL=your-email@gmail.com \\"
            echo "  -e EMAIL_TO_EMAILS=recipient@example.com \\"
            echo "  -v cache-data:/app/data/cache \\"
            echo "  news-crawler"
            echo
            echo "Health check: curl http://localhost:8080/health"
        else
            echo "❌ Docker image build failed"
            exit 1
        fi
        ;;
    2)
        echo "=== Git Deployment Preparation ==="
        echo "Please ensure code has been pushed to Git repository"
        echo
        echo "Deployment steps in Zeabur:"
        echo "1. Connect Git repository"
        echo "2. Select 'Background Service' type"
        echo "3. Set environment variables:"
        echo "   - EMAIL_USERNAME"
        echo "   - EMAIL_PASSWORD"
        echo "   - EMAIL_FROM_EMAIL"
        echo "   - EMAIL_TO_EMAILS"
        echo "4. Set Volume: cache-data -> /app/data/cache"
        echo "5. Deploy"
        echo
        echo "Environment variable examples:"
        echo "EMAIL_USERNAME=your-email@gmail.com"
        echo "EMAIL_PASSWORD=your-app-password"
        echo "EMAIL_FROM_EMAIL=your-email@gmail.com"
        echo "EMAIL_TO_EMAILS=recipient1@example.com,recipient2@example.com"
        ;;
    3)
        echo "=== Deployment Guide ==="
        echo
        echo "📋 Pre-deployment preparation:"
        echo "1. Ensure Gmail app password is set"
        echo "2. Prepare environment variables"
        echo "3. Choose deployment method"
        echo
        echo "🚀 Recommended deployment method: Background Service"
        echo "- Maintain existing architecture"
        echo "- Support complex scheduling"
        echo "- Auto restart and health check"
        echo "- Data persistence"
        echo
        echo "📁 Required files:"
        echo "- Dockerfile (containerization configuration)"
        echo "- zeabur.yaml (Zeabur configuration)"
        echo "- package.json (Node.js dependencies)"
        echo "- tsconfig.json (TypeScript configuration)"
        echo
        echo "🔧 Environment variables:"
        echo "- EMAIL_USERNAME: Gmail account"
        echo "- EMAIL_PASSWORD: App password"
        echo "- EMAIL_FROM_EMAIL: Sender email"
        echo "- EMAIL_TO_EMAILS: Recipient list"
        echo
        echo "📝 Configuration:"
        echo "- TARGET_URL: Set in config/config.json under crawler.target_url"
        echo
        echo "📊 Monitoring:"
        echo "- Health check: /health"
        echo "- Logs: Zeabur console"
        echo "- Status: Auto restart"
        echo
        echo "Detailed guide please see DEPLOYMENT.md"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo
echo "=== Deployment Complete ==="