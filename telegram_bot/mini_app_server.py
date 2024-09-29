# mini_app_server.py
from flask import Flask, send_from_directory

app = Flask(__name__)

@app.route('/mini_app')
def serve_mini_app():
    return send_from_directory('.', 'index.html')

def start_flask():
    app.run(host='0.0.0.0', port=8080)