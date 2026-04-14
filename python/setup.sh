#!/bin/bash
# Setup Python face analysis service on VPS
# Run: bash /root/amrita-be/python/setup.sh

set -e
echo "🧠 Setting up Face AI service..."

apt-get update -y
apt-get install -y python3-pip python3-dev cmake libgl1-mesa-glx

cd /root/amrita-be/python

pip3 install -r requirements.txt

# Download dlib face landmark model
if [ ! -f shape_predictor_68_face_landmarks.dat ]; then
  echo "📥 Downloading face landmark model..."
  wget -q http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
  bunzip2 shape_predictor_68_face_landmarks.dat.bz2
  echo "✅ Model downloaded"
else
  echo "✅ Model already exists"
fi

# Start with PM2
pm2 delete face-service 2>/dev/null || true
pm2 start face_service.py --name face-service --interpreter python3
pm2 save

echo ""
echo "✅ Face AI service running on port 5000"
echo "Test: curl http://localhost:5000/health"
