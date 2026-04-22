#!/bin/bash
set -e
echo "Setting up Face AI + YOLOv8 service..."

apt-get update -y
apt-get install -y python3-pip python3-venv python3-dev cmake libgl1-mesa-glx

cd /root/amrita-be/python

python3 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install opencv-python-headless "numpy<2" mediapipe flask flask-cors

# Download YOLOv8n ONNX model
if [ ! -f yolov8n.onnx ]; then
  echo "Downloading YOLOv8n model..."
  pip install ultralytics
  python3 -c "from ultralytics import YOLO; model = YOLO('yolov8n.pt'); model.export(format='onnx')"
  mv yolov8n.onnx . 2>/dev/null || true
fi

pm2 delete face-service 2>/dev/null || true
pm2 start "$(pwd)/venv/bin/python $(pwd)/face_service.py" --name face-service
pm2 save

echo ""
echo "Face AI + YOLOv8 service running on port 5000"
curl -s http://localhost:5000/health
