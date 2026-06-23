from flask import Flask, request, jsonify
from config import Config
from logger import logger
from DeepSeekService import DeepSeekService

app = Flask(__name__)
service = DeepSeekService()

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'error': 'message is required'}), 400
        message = data['message']
        response = service.chat(message)
        return jsonify({'success': True, 'response': response})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    logger.info(f"Starting Core Service on port {Config.PORT}")
    app.run(host='0.0.0.0', port=Config.PORT, debug=False)