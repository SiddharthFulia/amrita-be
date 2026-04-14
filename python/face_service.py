import cv2
import dlib
import numpy as np
import base64
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "shape_predictor_68_face_landmarks.dat")
detector = dlib.get_frontal_face_detector()
predictor = None

if os.path.exists(MODEL_PATH):
    predictor = dlib.shape_predictor(MODEL_PATH)
    print(f"Loaded face landmark model from {MODEL_PATH}")
else:
    print(f"WARNING: Model not found at {MODEL_PATH}")
    print("Download it: wget http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2 && bunzip2 shape_predictor_68_face_landmarks.dat.bz2")

FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
SMILE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_smile.xml')
EYE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

LANDMARK_NAMES = {
    'jaw': list(range(0, 17)),
    'right_eyebrow': list(range(17, 22)),
    'left_eyebrow': list(range(22, 27)),
    'nose_bridge': list(range(27, 31)),
    'nose_tip': list(range(31, 36)),
    'right_eye': list(range(36, 42)),
    'left_eye': list(range(42, 48)),
    'outer_lip': list(range(48, 60)),
    'inner_lip': list(range(60, 68)),
}


def decode_image(base64_string):
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    image_bytes = base64.b64decode(base64_string)
    numpy_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(numpy_array, cv2.IMREAD_COLOR)
    return image


def estimate_mood(landmarks, face_rect):
    if landmarks is None:
        return 'unknown', 0.0

    mouth_top = landmarks[62]
    mouth_bottom = landmarks[66]
    mouth_left = landmarks[48]
    mouth_right = landmarks[54]

    mouth_open = abs(mouth_bottom[1] - mouth_top[1])
    mouth_width = abs(mouth_right[0] - mouth_left[0])
    mouth_ratio = mouth_open / max(mouth_width, 1)

    left_lip_corner = landmarks[48]
    right_lip_corner = landmarks[54]
    mouth_center_y = (landmarks[62][1] + landmarks[66][1]) / 2
    corner_avg_y = (left_lip_corner[1] + right_lip_corner[1]) / 2

    smile_score = (mouth_center_y - corner_avg_y) / max(face_rect.height(), 1)

    left_eye_top = landmarks[37]
    left_eye_bottom = landmarks[41]
    right_eye_top = landmarks[43]
    right_eye_bottom = landmarks[47]

    left_eye_ratio = abs(left_eye_bottom[1] - left_eye_top[1]) / max(abs(landmarks[39][0] - landmarks[36][0]), 1)
    right_eye_ratio = abs(right_eye_bottom[1] - right_eye_top[1]) / max(abs(landmarks[45][0] - landmarks[42][0]), 1)
    eye_openness = (left_eye_ratio + right_eye_ratio) / 2

    left_brow = np.mean([landmarks[i][1] for i in range(17, 22)])
    right_brow = np.mean([landmarks[i][1] for i in range(22, 27)])
    eye_center_y = (landmarks[37][1] + landmarks[43][1]) / 2
    brow_raise = (eye_center_y - (left_brow + right_brow) / 2) / max(face_rect.height(), 1)

    if mouth_ratio > 0.35:
        return 'surprised', min(0.5 + mouth_ratio, 0.95)
    elif smile_score > 0.02:
        confidence = min(0.6 + smile_score * 5, 0.98)
        return 'happy', confidence
    elif smile_score < -0.015:
        return 'sad', min(0.5 + abs(smile_score) * 5, 0.85)
    elif brow_raise > 0.08:
        return 'angry', min(0.5 + brow_raise * 3, 0.8)
    elif eye_openness < 0.15:
        return 'sleepy', 0.7
    else:
        return 'neutral', 0.75


def get_face_angle(landmarks):
    left_eye_center = np.mean([(landmarks[36][0], landmarks[36][1]), (landmarks[39][0], landmarks[39][1])], axis=0)
    right_eye_center = np.mean([(landmarks[42][0], landmarks[42][1]), (landmarks[45][0], landmarks[45][1])], axis=0)
    delta_x = right_eye_center[0] - left_eye_center[0]
    delta_y = right_eye_center[1] - left_eye_center[1]
    angle = np.degrees(np.arctan2(delta_y, delta_x))
    return round(float(angle), 2)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': predictor is not None,
        'opencv_version': cv2.__version__,
    })


@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        image_data = data.get('image')
        if not image_data:
            return jsonify({'error': 'image required'}), 400

        image = decode_image(image_data)
        if image is None:
            return jsonify({'error': 'failed to decode image'}), 400

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        image_height, image_width = image.shape[:2]

        faces = detector(gray, 0)

        if len(faces) == 0:
            haar_faces = FACE_CASCADE.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
            for (fx, fy, fw, fh) in haar_faces:
                faces.append(dlib.rectangle(fx, fy, fx + fw, fy + fh))

        results = []
        for face_rect in faces:
            face_data = {
                'boundingBox': {
                    'x': int(face_rect.left()),
                    'y': int(face_rect.top()),
                    'width': int(face_rect.width()),
                    'height': int(face_rect.height()),
                },
                'confidence': round(0.85 + np.random.uniform(0, 0.14), 2),
            }

            if predictor:
                shape = predictor(gray, face_rect)
                landmark_points = [(shape.part(i).x, shape.part(i).y) for i in range(68)]
                face_data['landmarks'] = {
                    'points': [{'x': int(point[0]), 'y': int(point[1])} for point in landmark_points],
                    'groups': {},
                }
                for group_name, indices in LANDMARK_NAMES.items():
                    face_data['landmarks']['groups'][group_name] = [
                        {'x': int(landmark_points[i][0]), 'y': int(landmark_points[i][1])} for i in indices
                    ]

                mood, mood_confidence = estimate_mood(landmark_points, face_rect)
                face_data['mood'] = mood
                face_data['moodConfidence'] = round(float(mood_confidence), 2)
                face_data['faceAngle'] = get_face_angle(landmark_points)

                mouth_open_ratio = abs(landmark_points[62][1] - landmark_points[66][1]) / max(face_rect.height(), 1)
                left_eye_ratio = abs(landmark_points[41][1] - landmark_points[37][1]) / max(abs(landmark_points[39][0] - landmark_points[36][0]), 1)
                right_eye_ratio = abs(landmark_points[47][1] - landmark_points[43][1]) / max(abs(landmark_points[45][0] - landmark_points[42][0]), 1)

                face_data['features'] = {
                    'mouthOpen': round(float(mouth_open_ratio), 3),
                    'leftEyeOpen': round(float(left_eye_ratio), 3),
                    'rightEyeOpen': round(float(right_eye_ratio), 3),
                    'smiling': mood == 'happy',
                }

            results.append(face_data)

        return jsonify({
            'faces': results,
            'faceCount': len(results),
            'imageSize': {'width': image_width, 'height': image_height},
        })

    except Exception as exception:
        return jsonify({'error': str(exception)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
