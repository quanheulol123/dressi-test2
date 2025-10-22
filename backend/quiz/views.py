import os, json, random, string, io, base64, re, requests, time, jwt
from urllib.parse import quote
from dotenv import load_dotenv
from pymongo import MongoClient
from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.settings import api_settings as jwt_api_settings
from datetime import datetime, timedelta
from django.conf import settings
from google import genai
import threading
import boto3
from bson import ObjectId
from openpyxl import Workbook
try:
    from .detectron2_helpers import segment_clothing, visualise_masks
    _SEGMENTATION_AVAILABLE = True
except ModuleNotFoundError as exc:
    segment_clothing = None
    visualise_masks = None
    _SEGMENTATION_AVAILABLE = False
    _SEGMENTATION_IMPORT_ERROR = exc
from botocore.exceptions import BotoCoreError, ClientError

load_dotenv()

# --- Mongo & R2 setup ---
MONGO_URI = os.getenv("MONGO_URI")
ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID")
ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
BUCKET = os.getenv("R2_BUCKET")
PUBLIC_URL_BASE = os.getenv("PUBLIC_URL_BASE")
GENAI_API_KEY = os.getenv("GENAI_API_KEY")

client = MongoClient(MONGO_URI)
images_db = client["outfits"]
collection = images_db["images"]
instant_collection = images_db["instantoutfit"]
users_db = client["users_db"]
users_collection = users_db["users"]
wardrobe_collection = users_db["wardrobe"]
early_access_collection = users_db["emailRegisterd"]

s3 = boto3.client(
    's3',
    endpoint_url=f'https://{ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=ACCESS_KEY_ID,
    aws_secret_access_key=SECRET_ACCESS_KEY
)

genai_client = genai.Client(api_key=GENAI_API_KEY)
TOTAL_IMAGES = 20
ADMIN_EMAIL = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
if not ADMIN_EMAIL:
    raise RuntimeError("ADMIN_EMAIL environment variable must be set.")
MAX_EARLY_ACCESS_PAGE_SIZE = 200

# --- Helpers ---
fashion_synonyms = {
    "dress": ["gown", "cocktail dress", "evening wear"],
    "red": ["scarlet", "crimson", "burgundy"],
    "jacket": ["blazer", "coat", "cardigan"],
    "shirt": ["top", "blouse", "tee"],
    "pants": ["trousers", "slacks", "leggings"],
    "shoes": ["sneakers", "heels", "boots"]
}

def expand_queries(keywords):
    expanded = []
    for term in keywords:
        expanded.append(term.lower())
        if term.lower() in fashion_synonyms:
            expanded.extend(fashion_synonyms[term.lower()])
    return list(set(expanded))

def _normalize_to_list(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        normalized = []
        for item in value:
            text = str(item).strip()
            if text:
                normalized.append(text)
        return normalized
    text = str(value).strip()
    return [text] if text else []

def _collect_values(data, *keys):
    collected = []
    for key in keys:
        if key in data:
            collected.extend(_normalize_to_list(data.get(key)))
    return collected

def canonical_name(filename: str) -> str:
    if not filename:
        return ""
    basename = filename.rsplit("/", 1)[-1]
    basename = basename.rsplit(".", 1)[0]
    if "___" in basename:
        basename = basename.split("___", 1)[0]
    return basename.lower()

def safe_filename(name: str) -> str:
    return quote(name, safe='-_.')  

def get_weather_bucket(city: str = "Sydney") -> dict[str, object] | None:
    api_key = os.getenv("WEATHER_API")
    if not api_key:
        return None

    url = f"https://api.weatherapi.com/v1/current.json?key={api_key}&q={quote(city)}"
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError):
        return None

    try:
        temp_c = float(data["current"]["temp_c"])
    except (KeyError, TypeError, ValueError):
        temp_c = None

    bucket = None
    if temp_c is not None:
        bucket = "hot" if temp_c >= 20 else "cold"

    location = data.get("location") if isinstance(data, dict) else {}
    resolved_city = None
    country = None
    if isinstance(location, dict):
        resolved_city = location.get("name")
        country = location.get("country")

    return {
        "bucket": bucket,
        "temperature": temp_c,
        "city": resolved_city or city,
        "country": country,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
PASSWORD_REQUIREMENTS = re.compile(
    r"^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?\":{}|<>\\/~`_\[\]\-+=]).{8,}$"
)

def is_valid_password(password: str) -> bool:
    if not isinstance(password, str):
        return False
    return bool(PASSWORD_REQUIREMENTS.match(password))

def upload_to_r2(filename: str, file_bytes: bytes) -> str:
    if not file_bytes:
        return None
    try:
        s3.upload_fileobj(io.BytesIO(file_bytes), BUCKET, filename)
        return f"{PUBLIC_URL_BASE}{safe_filename(filename)}"
    except (BotoCoreError, ClientError) as e:
        print(f"Upload failed for {filename}: {e}")
        return None

def save_image_metadata(filename: str, keywords: list, r2_url: str, user_id=None):
    """
    Save image metadata and ensure all keywords are included as tags.
    """
    # Lowercase and deduplicate
    tags = list(set([k.lower() for k in keywords if k]))

    # Optional: add 'womenswear' if it’s in the filename but not in tags
    if "womenswear" in filename.lower() and "womenswear" not in tags:
        tags.append("womenswear")

    doc = {
        "filename": filename,
        "tags": tags,
        "created_at": datetime.utcnow(),
        "images": {"full": r2_url, "thumbnail": r2_url},
        "source_url": r2_url,
        "user_id": user_id
    }
    collection.insert_one(doc)

def get_images(keywords: list, limit=TOTAL_IMAGES):
    results_cursor = collection.find(
        {"tags": {"$in": keywords}},
        {"filename": 1, "tags": 1}
    ).sort("created_at", -1).limit(limit)

    output = []
    for doc in results_cursor:
        url = f"{PUBLIC_URL_BASE}{safe_filename(doc['filename'])}"
        output.append({
            "name": doc["filename"],
            "image": url,
            "tags": doc.get("tags", []),
            "source_url": url
        })
    return output

@csrf_exempt
def upload_and_segment(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    if not _SEGMENTATION_AVAILABLE:
        return JsonResponse({
            "error": "Clothing segmentation service is unavailable.",
            "details": str(_SEGMENTATION_IMPORT_ERROR)
        }, status=503)

    file = request.FILES.get("image")
    if not file:
        return JsonResponse({"error": "No image uploaded"}, status=400)

    image_bytes = file.read()
    masks, classes = segment_clothing(image_bytes)
    
    # Optional: return visualization
    vis_bytes = visualise_masks(image_bytes, masks)
    import base64
    vis_base64 = base64.b64encode(vis_bytes).decode("utf-8")

    return JsonResponse({
        "num_items": len(masks),
        "visualization": f"data:image/jpeg;base64,{vis_base64}"
    })

# --- Views ---
def recommend_page(request):
    return render(request, "recommend.html")

@csrf_exempt
def signup(request):
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        if not username or not password:
            messages.error(request, "Username and password required.")
            return redirect("signup")
        if not is_valid_password(password):
            messages.error(
                request,
                "Password must be at least 8 characters long and include one uppercase letter and one special character.",
            )
            return redirect("signup")
        if users_collection.find_one({"username": username}):
            messages.error(request, "Username already taken.")
            return redirect("signup")
        password_hash = make_password(password)
        users_collection.insert_one({
            "username": username,
            "password_hash": password_hash,
            "created_at": datetime.utcnow()
        })
        messages.success(request, "Signup successful! You can log in.")
        return redirect("login")
    return render(request, "signup.html")

@csrf_exempt
def signup_mongo(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    try:
        data = json.loads(request.body.decode("utf-8"))
    except (TypeError, json.JSONDecodeError):
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    display_name = (data.get("displayName") or data.get("name") or "").strip()

    if not email or not password:
        return JsonResponse({"error": "Email and password are required."}, status=400)
    if not is_valid_password(password):
        return JsonResponse({
            "error": "Password must be at least 8 characters long and include one uppercase letter and one special character."
        }, status=400)

    existing_user = users_collection.find_one({
        "$or": [{"email": email}, {"username": email}]
    })
    if existing_user:
        return JsonResponse({"error": "Email already registered."}, status=409)

    password_hash = make_password(password)
    user_doc = {
        "email": email,
        "username": email,
        "password_hash": password_hash,
        "display_name": display_name,
        "created_at": datetime.utcnow()
    }
    result = users_collection.insert_one(user_doc)

    tokens = get_tokens_for_mongo_user(result.inserted_id)
    is_admin = email == ADMIN_EMAIL

    return JsonResponse(
        {
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "user": {
                "email": email,
                "displayName": display_name,
                "isAdmin": is_admin,
            },
        },
        status=201,
    )

@csrf_exempt
def login_page(request):
    return render(request, "login.html")

def get_tokens_for_mongo_user(mongo_user_id: str):
    refresh = RefreshToken()
    refresh["user_id"] = str(mongo_user_id)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token)
    }

def decode_jwt(token):
    try:
        signing_key = jwt_api_settings.SIGNING_KEY or settings.SECRET_KEY
        algorithms = [jwt_api_settings.ALGORITHM]
        return jwt.decode(
            token,
            signing_key,
            algorithms=algorithms,
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        print("JWT expired")
    except jwt.InvalidTokenError as exc:
        print(f"Invalid JWT: {exc}")
    return None

# --- Login ---
@csrf_exempt
def login_mongo(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    try:
        data = json.loads(request.body.decode("utf-8"))
    except (TypeError, json.JSONDecodeError):
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    email = (data.get("email") or data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return JsonResponse({"error": "Email and password are required."}, status=400)

    user = users_collection.find_one(
        {"$or": [{"email": email}, {"username": email}]}
    )

    if not user or not check_password(password, user.get("password_hash", "")):
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    tokens = get_tokens_for_mongo_user(user["_id"])
    display_name = user.get("display_name") or (user.get("username") or "").split("@")[0]
    account_email = (user.get("email") or user.get("username") or "").strip().lower()
    is_admin = account_email == ADMIN_EMAIL

    return JsonResponse(
        {
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "user": {
                "email": user.get("email") or user.get("username"),
                "displayName": display_name.strip() if display_name else "",
                "isAdmin": is_admin,
            },
        }
    )

def get_auth_token(request):
    """Extract the Bearer token from headers."""
    auth = request.headers.get("Authorization") or request.META.get("HTTP_AUTHORIZATION")
    if auth and auth.startswith("Bearer "):
        return auth.split(" ")[1]
    return None


def ensure_admin(request):
    """Verify the requester is the configured administrator."""
    token = get_auth_token(request)
    if not token:
        return JsonResponse(
            {"detail": "Authentication credentials were not provided."},
            status=401,
        )

    decoded = decode_jwt(token)
    user_id = decoded.get("user_id") if decoded else None
    if not user_id:
        return JsonResponse(
            {"detail": "Invalid or expired token."},
            status=401,
        )

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None

    if not user:
        return JsonResponse({"detail": "User not found."}, status=404)

    email = (user.get("email") or user.get("username") or "").strip().lower()
    if email != ADMIN_EMAIL:
        return JsonResponse(
            {"detail": "You do not have permission to perform this action."},
            status=403,
        )

    return None

@csrf_exempt
def save_image(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    token = get_auth_token(request)
    if not token:
        return JsonResponse({"error": "Unauthorized"}, status=401)

    decoded = decode_jwt(token)
    if not decoded:
        return JsonResponse({"error": "Invalid token"}, status=401)

    user_id = str(decoded["user_id"])
    data = json.loads(request.body)
    filename = data.get("filename")
    image_url = data.get("image_url")
    tags = data.get("tags", [])

    if not filename or not image_url:
        return JsonResponse({"error": "Missing data"}, status=400)

    wardrobe_collection.insert_one({
        "user_id": user_id,
        "filename": filename,
        "image_url": image_url,
        "tags": tags,
        "saved_at": datetime.utcnow()
    })

    return JsonResponse({"success": True})

@csrf_exempt
def delete_wardrobe_item(request, filename):
    if request.method != "DELETE":
        return JsonResponse({"error": "Invalid request"}, status=400)

    # Get token from headers
    token = get_auth_token(request)
    if not token:
        return JsonResponse({"error": "Unauthorized"}, status=401)

    decoded = decode_jwt(token)
    if not decoded:
        return JsonResponse({"error": "Invalid token"}, status=401)

    user_id = str(decoded["user_id"])
    item = wardrobe_collection.find_one({"filename": filename, "user_id": user_id})
    if not item:
        return JsonResponse({"error": "Item not found"}, status=404)

    # Just remove the wardrobe link (not the actual image or R2 object)
    wardrobe_collection.delete_one({"filename": filename, "user_id": user_id})

    return JsonResponse({"message": "Item removed from wardrobe"})

@csrf_exempt
def get_wardrobe(request):
    if request.method != "GET":
        return JsonResponse({"error": "Invalid request"}, status=400)

    token = get_auth_token(request)
    if not token:
        return JsonResponse({"error": "Unauthorized"}, status=401)

    decoded = decode_jwt(token)
    if not decoded:
        return JsonResponse({"error": "Invalid token"}, status=401)

    user_id = str(decoded["user_id"])
    saved_items = list(wardrobe_collection.find({"user_id": user_id}))
    wardrobe = [{
        "name": item["filename"],
        "image": item["image_url"],
        "tags": item.get("tags", [])
    } for item in saved_items]

    return JsonResponse({"wardrobe": wardrobe})

def generate(base_tags, image_count_per_weather=3, user_id=None):
    weather_types = ["hot", "cold"]

    normalized_tags = []
    for tag in base_tags or []:
        text = str(tag).strip().lower()
        if text and text not in normalized_tags:
            normalized_tags.append(text)

    if not normalized_tags:
        normalized_tags = ["casual", "womenswear"]

    # Join the normalized tags into a single query prompt
    query = " ".join(normalized_tags)

    time.sleep(1)

    for weather in weather_types:
        for i in range(image_count_per_weather):
            try:
                prompt_text = (
                    f"{query} women's fashion single outfit flatlay, "
                    f"high quality, white background, {weather} style"
                )
                print(f"[DEBUG] Generating {weather} image for query '{query}', attempt {i+1}")
                print(f"[DEBUG] Prompt text: {prompt_text}")

                response = genai_client.models.generate_content(
                    model='gemini-2.5-flash-image-preview',
                    contents=[prompt_text],
                )

                # Loop through all parts to find inline images
                for part in response.candidates[0].content.parts:
                    if getattr(part, 'inline_data', None):
                        image_bytes = part.inline_data.data
                        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
                        safe_keywords = '___'.join(normalized_tags) or "outfit"
                        storage_filename = f"{safe_keywords}___{weather}___{random_suffix}.png"
                        search_filename = f"GENERATED_{safe_keywords}___{weather}___{random_suffix}.png"

                        # Upload to R2
                        r2_url = upload_to_r2(storage_filename, image_bytes)
                        if r2_url:
                            print(f"[DEBUG] Uploaded image to R2: {r2_url}")

                            # Save metadata in DB with the selected quiz tags
                            save_image_metadata(
                                storage_filename,
                                normalized_tags,
                                r2_url,
                                user_id=user_id
                            )
                            print(f"[DEBUG] Saved image metadata to DB: {storage_filename}")

                            # Mark as AI-generated
                            collection.update_one(
                                {"filename": storage_filename},
                                {"$set": {"search_filename": search_filename, "is_ai": True}}
                            )
                            print(f"[DEBUG] Marked image as AI-generated")

                            # Save to user's wardrobe if logged in
                            if user_id:
                                wardrobe_collection.insert_one({
                                    "user_id": user_id,
                                    "filename": storage_filename,
                                    "image_url": r2_url,
                                    "tags": normalized_tags,
                                    "saved_at": datetime.utcnow()
                                })

            except Exception as e:
                print(f"[DEBUG] Error generating {weather} image for '{query}': {e}")

# --- Get AI-generated Images ---
@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_exempt
def get_generated_images(request):
    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    styles = _collect_values(data, "styles", "style")
    colours = _collect_values(data, "colours", "colour", "colors", "color")
    occasions = _collect_values(data, "occasions", "occasion")
    body_shapes = _collect_values(data, "bodyShapes", "bodyShape")
    skin_tones = _collect_values(data, "skinTones", "skinTone", "skin")

    keywords = [k.lower() for k in (styles + colours + occasions + body_shapes + skin_tones) if k]
    if not keywords:
        keywords = ["casual", "womenswear", "outfit"]
    keywords = expand_queries(keywords)

    print(f"[DEBUG] get_generated_images keywords: {keywords}")

    # Only fetch AI-generated images
    ai_images = list(collection.find(
        {"tags": {"$in": keywords}, "is_ai": True},
        {"filename": 1, "tags": 1, "images": 1}
    ).sort("created_at", -1).limit(TOTAL_IMAGES))

    print(f"[DEBUG] Found {len(ai_images)} AI-generated images in DB")

    output = []
    for doc in ai_images:
        url = doc["images"]["full"]
        output.append({
            "name": doc["filename"],
            "image": url,
            "tags": doc.get("tags", []),
            "source_url": url
        })

    return JsonResponse({"outfits": output})

@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_exempt
def generate_outfits(request):
    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    styles = _collect_values(data, "styles", "style")
    body_shapes = _collect_values(data, "bodyShapes", "bodyShape")
    occasions = _collect_values(data, "occasions", "occasion")

    image_count = data.get("image_count", 4)
    try:
        image_count = int(image_count)
    except (TypeError, ValueError):
        image_count = 4
    image_count = max(1, min(image_count, 8))

    primary_style = (styles + ["casual"])[0]
    primary_body_shape = (body_shapes + ["womenswear"])[0]
    primary_occasion = occasions[0] if occasions else ""

    prompt_tokens = [primary_style, primary_body_shape]
    if primary_occasion:
        prompt_tokens.append(primary_occasion)
    prompt_tokens = [token for token in prompt_tokens if token]
    prompt_query = " ".join(prompt_tokens) or "casual womenswear"

    ai_images = []
    for idx in range(image_count):
        prompt_text = (
            f"{prompt_query} women's fashion single outfit flatlay, "
            f"high quality, white background, different accessories, variation {idx + 1}"
        )
        try:
            response = genai_client.models.generate_content(
                model='gemini-2.5-flash-image-preview',
                contents=[prompt_text],
            )

            for part in response.candidates[0].content.parts:
                if getattr(part, 'inline_data', None):
                    ai_images.append(part.inline_data.data)
                    break
        except Exception as exc:
            print(f"[DEBUG] Error generating image for '{prompt_text}': {exc}")

    outfits = []
    for image_bytes in ai_images:
        img_b64 = base64.b64encode(image_bytes).decode("utf-8")
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        keywords_slug = '___'.join(prompt_tokens) if prompt_tokens else 'casual_womenswear'
        storage_name = f"{keywords_slug}___ai___{random_suffix}.png"
        display_name = f"GENERATED_{storage_name}"

        outfits.append({
            "name": display_name,
            "image": f"data:image/png;base64,{img_b64}",
            "tags": prompt_tokens,
            "source_url": None
        })

        r2_url = upload_to_r2(storage_name, image_bytes)
        if r2_url:
            save_image_metadata(storage_name, prompt_tokens, r2_url)

    random.shuffle(outfits)
    return JsonResponse({"outfits": outfits[:image_count]})

@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_exempt
def recommend(request):
    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    styles = _collect_values(data, "styles", "style")
    body_shapes = _collect_values(data, "bodyShapes", "bodyShape")
    colours = _collect_values(data, "colours", "colour", "colors", "color")
    occasions = _collect_values(data, "occasions", "occasion")
    skin_tones = _collect_values(data, "skinTones", "skinTone", "skin")
    temperature = data.get('temperature')
    city = data.get('city') or data.get('location')
    if isinstance(city, str):
        city = city.strip() or None
    else:
        city = None

    token = get_auth_token(request)
    user_id = None
    if token:
        decoded = decode_jwt(token)
        if decoded:
            user_id = str(decoded["user_id"])

    style_tags = [str(k).strip().lower() for k in styles if k]
    body_shape_tags = [str(k).strip().lower() for k in body_shapes if k]

    base_tags: list[str] = []
    for tag in style_tags + body_shape_tags:
        if tag and tag not in base_tags:
            base_tags.append(tag)

    if not base_tags:
        base_tags = ["casual", "womenswear"]

    use_weather_value = data.get("use_weather")
    if use_weather_value is None:
        use_weather_value = data.get("useWeather")
    if isinstance(use_weather_value, str):
        use_weather = use_weather_value.strip().lower() in {"true", "1", "yes", "on"}
    else:
        use_weather = bool(use_weather_value)

    weather_info = {
        "requested": bool(use_weather),
        "applied": False,
        "tag": None,
        "source": None,
        "temperature": None,
        "city": city,
        "country": None,
        "fetched_at": None,
    }

    preferred_weather = None
    weather_data = None
    if use_weather:
        temp_value = None
        if temperature is not None:
            try:
                temp_value = float(temperature)
                preferred_weather = "hot" if temp_value >= 20 else "cold"
                weather_info.update(
                    applied=True,
                    tag=preferred_weather,
                    source="request",
                    temperature=temp_value,
                )
            except (TypeError, ValueError):
                preferred_weather = None
                temp_value = None
        if not preferred_weather:
            weather_data = get_weather_bucket(city or "Sydney")
            if weather_data:
                bucket = weather_data.get("bucket")
                if bucket:
                    preferred_weather = bucket
                    weather_info.update(
                        applied=True,
                        tag=bucket,
                        source="api",
                        temperature=weather_data.get("temperature"),
                    )
                weather_info["city"] = weather_data.get("city") or weather_info["city"]
                weather_info["country"] = weather_data.get("country")
                weather_info["fetched_at"] = weather_data.get("timestamp")
        if preferred_weather and preferred_weather not in base_tags:
            base_tags.append(preferred_weather)
    else:
        weather_data = None

    expanded_queries = expand_queries(base_tags)
    required_tags = set(base_tags)

    image_count = data.get('image_count', 4)
    try:
        image_count = int(image_count)
    except (TypeError, ValueError):
        image_count = 4
    image_count = max(1, min(image_count, TOTAL_IMAGES))

    exclude_names = set(_collect_values(data, "exclude_names", "excludeNames"))

    max_candidates = max(image_count * 4, 32)

    query_conditions = []
    if expanded_queries:
        query_conditions.append({"tags": {"$in": expanded_queries}})
    if preferred_weather:
        query_conditions.append({"tags": preferred_weather})

    if not query_conditions:
        query_filter: dict[str, object] = {}
    elif len(query_conditions) == 1:
        query_filter = query_conditions[0]
    else:
        query_filter = {"$and": query_conditions}

    seen_names = set()
    seen_images = set()
    response_images = []
    unique_exhausted = False

    def append_doc(doc, allow_repeat=False):
        filename = doc.get("filename")
        if not filename:
            return False
        if filename in seen_names:
            return False
        if not allow_repeat and filename in exclude_names:
            return False

        url = None
        images = doc.get("images") or {}
        if isinstance(images, dict):
            url = images.get("full") or images.get("thumbnail")
        if not url:
            url = doc.get("image")
        if not url:
            url = f"{PUBLIC_URL_BASE}{safe_filename(filename)}"

        if not url:
            return False

        if url in seen_images:
            return False

        source_url = doc.get("source_url") or url

        tags = doc.get("tags") or []
        normalized_tags = {str(tag).strip().lower() for tag in tags if isinstance(tag, str)}
        if required_tags and not required_tags.issubset(normalized_tags):
            return False

        response_images.append({
            "name": filename,
            "image": url,
            "tags": doc.get("tags", []),
            "source_url": source_url
        })
        seen_names.add(filename)
        seen_images.add(url)
        return len(response_images) >= image_count

    for doc in collection.find(query_filter).sort("created_at", -1).limit(max_candidates):
        if append_doc(doc):
            break

    if len(response_images) < image_count:
        fallback_conditions = [
            {"filename": {"$nin": list(seen_names.union(exclude_names))}}
        ]
        if preferred_weather:
            fallback_conditions.append({"tags": preferred_weather})
        if len(fallback_conditions) == 1:
            fallback_filter = fallback_conditions[0]
        else:
            fallback_filter = {"$and": fallback_conditions}
        for doc in collection.find(fallback_filter).sort("created_at", -1).limit(max_candidates):
            if append_doc(doc):
                break

    if len(response_images) < image_count:
        unique_exhausted = True
        repeat_conditions = []
        if expanded_queries:
            repeat_conditions.append({"tags": {"$in": expanded_queries}})
        if preferred_weather:
            repeat_conditions.append({"tags": preferred_weather})

        if not repeat_conditions:
            repeat_query: dict[str, object] = {}
        elif len(repeat_conditions) == 1:
            repeat_query = repeat_conditions[0]
        else:
            repeat_query = {"$and": repeat_conditions}
        for doc in collection.find(repeat_query).sort("created_at", -1).limit(max_candidates):
            if append_doc(doc, allow_repeat=True):
                if len(response_images) >= image_count:
                    break
        if len(response_images) < image_count:
            for doc in collection.find({}).sort("created_at", -1).limit(max_candidates):
                if append_doc(doc, allow_repeat=True):
                    if len(response_images) >= image_count:
                        break

    random.shuffle(response_images)

    if base_tags:
        threading.Thread(
            target=generate,
            args=(base_tags, min(image_count, 2), user_id),
            daemon=True
        ).start()

    return JsonResponse({
        "outfits": response_images[:image_count],
        "uniqueExhausted": unique_exhausted,
        "weather": weather_info,
    })


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def instant_outfits(request):
    """
    Return outfits sourced exclusively from the `instantoutfit` Mongo collection,
    optionally filtered by a requested vibe/tag (e.g. sunny, cloudy, work).
    """
    def _extract_param(source: dict | None, *keys: str) -> str | None:
        if not isinstance(source, dict):
            return None
        for key in keys:
            if key in source and source[key] is not None:
                return source[key]
        return None

    request_payload = (
        request.data if hasattr(request, "data") and isinstance(request.data, dict) else {}
    )
    vibe_input = _extract_param(request_payload, "vibe", "tag", "value")
    if vibe_input is None:
        vibe_input = request.GET.get("vibe") or request.GET.get("tag") or request.GET.get("value")
    vibe = str(vibe_input).strip().lower() if vibe_input else ""

    def _safe_int(value, default=1, minimum=1, maximum=6):
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return default
        return max(minimum, min(parsed, maximum))

    image_count = _safe_int(
        request_payload.get("image_count")
        if "image_count" in request_payload
        else request.GET.get("image_count"),
        default=1,
    )

    exclude_sources = []
    for key in ("exclude_names", "exclude", "exclude_list", "excludeIds", "exclude_ids"):
        if key in request_payload:
            exclude_sources.extend(_normalize_to_list(request_payload.get(key)))
    exclude_sources.extend(request.GET.getlist("exclude"))

    exclude_names = {name for name in exclude_sources if isinstance(name, str) and name.strip()}

    vibe_conditions = []
    if vibe:
        exact_match = {"vibe": vibe}
        vibe_regex = {"$regex": vibe, "$options": "i"}
        vibe_conditions = [
            exact_match,
            {"tags": vibe},
            {"tags": vibe_regex},
            {"seed_source": vibe_regex},
        ]

    if vibe_conditions:
        match_query: dict[str, object] = {"$or": vibe_conditions}
    else:
        match_query = {}

    primary_candidates = list(
        instant_collection.find(match_query, projection=None)
    )
    random.shuffle(primary_candidates)

    response_items: list[dict[str, object]] = []
    response_names: set[str] = set()

    def resolve_name(doc: dict) -> str:
        for key in ("filename", "name", "title"):
            value = doc.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        identifier = doc.get("_id")
        return str(identifier) if identifier is not None else ""

    def resolve_image_url(doc: dict) -> str:
        images_data = doc.get("images")
        if isinstance(images_data, dict):
            for key in ("source_url", "full", "url", "main", "primary", "square"):
                candidate = images_data.get(key)
                if isinstance(candidate, str) and candidate.strip():
                    return candidate
        for key in ("source_url", "image", "url"):
            candidate = doc.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return candidate
        return ""

    def append_doc(doc: dict, allow_repeat: bool = False) -> bool:
        name = resolve_name(doc)
        if not name:
            return False

        if not allow_repeat and (name in exclude_names or name in response_names):
            return False
        if allow_repeat and name in response_names:
            return False

        image_url = resolve_image_url(doc)
        if not image_url:
            return False

        tags = doc.get("tags") if isinstance(doc.get("tags"), list) else []

        response_items.append(
            {
                "name": name,
                "image": image_url,
                "tags": tags,
                "source_url": doc.get("source_url") or image_url,
                "vibe": vibe or (tags[0] if tags else None),
            }
        )
        response_names.add(name)
        if not allow_repeat:
            exclude_names.add(name)
        return len(response_items) >= image_count

    fresh_candidates: list[dict] = []
    for doc in primary_candidates:
        name = resolve_name(doc)
        if not name:
            continue
        if name in exclude_names:
            continue
        fresh_candidates.append(doc)

    random.shuffle(fresh_candidates)

    for doc in fresh_candidates:
        if append_doc(doc):
            break

    unique_exhausted = False

    if not response_items and primary_candidates:
        unique_exhausted = True
        for doc in primary_candidates:
            if append_doc(doc, allow_repeat=True):
                break

    return JsonResponse(
        {
            "outfits": response_items[:image_count],
            "uniqueExhausted": unique_exhausted,
            "requestedVibe": vibe,
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def register_early_access(request):
    """
    Store an email address for early-access notifications.
    Accepts JSON payload: {"email": "...", "consent": true}
    """
    try:
        data = request.data
    except Exception:
        data = {}

    email = (data.get("email") or "").strip().lower()
    consent = bool(data.get("consent"))

    if not email:
        return JsonResponse(
            {"status": "error", "message": "Email is required."},
            status=400,
        )

    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return JsonResponse(
            {"status": "error", "message": "Please provide a valid email address."},
            status=400,
        )

    existing = early_access_collection.find_one({"email": email})
    if existing:
        if consent and not existing.get("consent", False):
            early_access_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"consent": True, "updated_at": datetime.utcnow()}},
            )
        return JsonResponse(
            {"status": "ok", "message": "You're already on the early access list."}
        )

    document = {
        "email": email,
        "consent": consent,
        "created_at": datetime.utcnow(),
    }

    try:
        early_access_collection.insert_one(document)
    except Exception:
        return JsonResponse(
            {"status": "error", "message": "Unable to save your registration right now."},
            status=500,
        )

    return JsonResponse(
        {"status": "ok", "message": "Thanks! We'll be in touch soon."},
        status=201,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def list_early_access(request):
    """
    Return paginated early-access registrations for the admin dashboard.
    """
    permission_error = ensure_admin(request)
    if permission_error:
        return permission_error

    try:
        page = int(request.GET.get("page", 1))
    except (TypeError, ValueError):
        page = 1
    page = max(page, 1)

    try:
        page_size = int(request.GET.get("page_size", 20))
    except (TypeError, ValueError):
        page_size = 30
    page_size = max(1, min(page_size, MAX_EARLY_ACCESS_PAGE_SIZE))

    total = early_access_collection.count_documents({})
    skip = (page - 1) * page_size

    cursor = (
        early_access_collection.find({})
        .sort("created_at", -1)
        .skip(skip)
        .limit(page_size)
    )

    items = []
    for doc in cursor:
        created_at = doc.get("created_at")
        items.append(
            {
                "id": str(doc.get("_id")),
                "email": doc.get("email", ""),
                "consent": bool(doc.get("consent")),
                "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
            }
        )

    return JsonResponse(
        {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def export_early_access(request):
    """
    Export all early-access registrations as an Excel workbook.
    """
    permission_error = ensure_admin(request)
    if permission_error:
        return permission_error

    cursor = early_access_collection.find({}).sort("created_at", -1)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Early Access"
    sheet.append(["Email", "Consent", "Registered At"])

    for doc in cursor:
        created_at = doc.get("created_at")
        sheet.append(
            [
                doc.get("email", ""),
                "Yes" if doc.get("consent") else "No",
                created_at.strftime("%Y-%m-%d")
                if isinstance(created_at, datetime)
                else (created_at or ""),
            ]
        )

    stream = io.BytesIO()
    workbook.save(stream)
    stream.seek(0)

    filename = f"early_access_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    response = HttpResponse(
        stream.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_view(["GET"])
@permission_classes([AllowAny])
def weather_status(request):
    city = request.GET.get("city") or request.GET.get("location") or "Sydney"
    if isinstance(city, str):
        city = city.strip() or "Sydney"
    else:
        city = "Sydney"

    weather_data = get_weather_bucket(city)
    if not weather_data:
        return JsonResponse(
            {
                "status": "unavailable",
                "city": city,
                "message": "Weather provider did not return data.",
            },
            status=503,
        )

    bucket = weather_data.get("bucket")
    status_label = "ok" if bucket else "no_bucket"

    return JsonResponse(
        {
            "status": status_label,
            "bucket": bucket,
            "temperature": weather_data.get("temperature"),
            "city": weather_data.get("city") or city,
            "country": weather_data.get("country"),
            "fetched_at": weather_data.get("timestamp"),
        }
    )
