"""
Optional Python virtual try-on sidecar (VTO_PROVIDER=python).

Default behavior matches the Node Demo overlay (simple blend).
Local Kolors weights are a future path — see docs/KOLORS.md.
Do not treat this process as production VTO until that path is wired.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
from PIL import Image

app = Flask(__name__)
CORS(app)


def base64_to_image(base64_string):
    image_data = base64.b64decode(base64_string)
    return Image.open(io.BytesIO(image_data))


def image_to_base64(image):
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()


@app.route('/virtual-try-on', methods=['POST'])
def virtual_try_on():
    try:
        data = request.json or {}

        user_photo_b64 = data.get('user_photo')
        product_image_b64 = data.get('product_image')
        product_name = data.get('product_name', 'Product')

        if not user_photo_b64 or not product_image_b64:
            return jsonify({
                'error': 'Missing required images',
                'message': 'Both user_photo and product_image are required'
            }), 400

        user_image = base64_to_image(user_photo_b64)
        product_image = base64_to_image(product_image_b64)

        # Demo overlay — same idea as Node sharp blend. Kolors: docs/KOLORS.md
        print(f"Processing virtual try-on for: {product_name}")
        print(f"User image size: {user_image.size}, Product image size: {product_image.size}")

        result_image = user_image.copy()
        product_resized = product_image.resize(user_image.size, Image.Resampling.LANCZOS)
        result_image = Image.blend(result_image, product_resized, alpha=0.3)

        return jsonify({
            'result_image': image_to_base64(result_image),
            'success': True,
            'message': f'Virtual try-on completed for {product_name} (demo overlay; Kolors optional — docs/KOLORS.md)',
            'mode': 'overlay',
        })

    except Exception as e:
        print(f"Error processing virtual try-on: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Processing failed',
            'message': str(e)
        }), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'virtual-try-on',
        'mode': 'overlay',
        'note': 'Demo overlay sidecar. Optional Kolors later — docs/KOLORS.md',
    })


if __name__ == '__main__':
    print("=" * 60)
    print("Virtual Try-On Service (Demo overlay)")
    print("=" * 60)
    print("Starting on http://localhost:8000")
    print("Node overlay is the default (no sidecar needed).")
    print("Set VTO_PROVIDER=python to use this process.")
    print("Kolors local weights: docs/KOLORS.md")
    print("=" * 60)
    app.run(host='0.0.0.0', port=8000, debug=True)
