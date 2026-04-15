#!/bin/bash
set -e
echo "Setting up Face AI service..."

apt-get update -y
apt-get install -y python3-pip python3-venv python3-dev cmake libgl1-mesa-glx

cd /root/amrita-be/python

python3 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install opencv-python-headless "numpy<2" dlib flask flask-cors

if [ ! -f shape_predictor_68_face_landmarks.dat ]; then
  echo "Downloading face landmark model..."
  wget -q http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
  bunzip2 shape_predictor_68_face_landmarks.dat.bz2
fi

pm2 delete face-service 2>/dev/null || true
pm2 start "$(pwd)/venv/bin/python $(pwd)/face_service.py" --name face-service
pm2 save

echo ""
echo "Face AI service running on port 5000"
curl -s http://localhost:5000/health
