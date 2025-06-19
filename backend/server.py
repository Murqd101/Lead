from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
import os
import httpx
import asyncio
from typing import List, Optional, Dict, Any
import uuid
import json
from datetime import datetime
import logging
import urllib.parse

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lead Generation API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/leadgen_db')
client = MongoClient(MONGO_URL)
db = client.leadgen_db

# Collections
businesses_collection = db.businesses
favorites_collection = db.favorites
users_collection = db.users

# Pydantic models
class BusinessSearch(BaseModel):
    business_type: str
    location: str
    radius: Optional[float] = 5.0  # km
    lat: Optional[float] = None
    lon: Optional[float] = None

class Business(BaseModel):
    id: str
    name: str
    business_type: str
    address: str
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    lat: float
    lon: float
    quality_score: int
    lead_status: str
    last_updated: datetime

class FavoriteBusiness(BaseModel):
    business_id: str
    user_id: str = "default_user"

class LeadFilters(BaseModel):
    min_quality_score: Optional[int] = 60
    business_types: Optional[List[str]] = None
    has_website: Optional[bool] = None
    has_phone: Optional[bool] = None
    has_email: Optional[bool] = None

# Utility functions
async def geocode_location(location: str) -> tuple:
    """Geocode location using Nominatim (OpenStreetMap)"""
    try:
        encoded_location = urllib.parse.quote(location)
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={encoded_location}&limit=1"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers={"User-Agent": "LeadGen App 1.0"})
            if response.status_code == 200:
                data = response.json()
                if data:
                    return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        logger.error(f"Geocoding error: {e}")
    return None, None

async def fetch_businesses_from_overpass(lat: float, lon: float, radius: float, business_type: str) -> List[Dict]:
    """Fetch businesses from OpenStreetMap using Overpass API"""
    try:
        # Map business types to OSM tags
        osm_tags = {
            'restaurant': 'amenity=restaurant',
            'shop': 'shop',
            'office': 'office',
            'hotel': 'tourism=hotel',
            'gym': 'leisure=fitness_centre',
            'beauty': 'shop=beauty',
            'automotive': 'shop=car_repair',
            'medical': 'amenity=clinic',
            'retail': 'shop',
            'service': 'craft',
        }
        
        # Default to general shop/amenity search if type not found
        tag_query = osm_tags.get(business_type.lower(), 'shop')
        
        # Build Overpass query
        overpass_query = f"""
        [out:json][timeout:25];
        (
          node[{tag_query}](around:{radius*1000},{lat},{lon});
          way[{tag_query}](around:{radius*1000},{lat},{lon});
          relation[{tag_query}](around:{radius*1000},{lat},{lon});
        );
        out center meta;
        """
        
        url = "https://overpass-api.de/api/interpreter"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, data=overpass_query)
            if response.status_code == 200:
                return response.json().get('elements', [])
    except Exception as e:
        logger.error(f"Overpass API error: {e}")
    return []

async def fetch_company_info(company_name: str) -> Dict:
    """Fetch company info from OpenCorporates (no API key required for basic search)"""
    try:
        encoded_name = urllib.parse.quote(company_name)
        url = f"https://api.opencorporates.com/v0.4/companies/search?q={encoded_name}&format=json&limit=1"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                companies = data.get('results', {}).get('companies', [])
                if companies:
                    company = companies[0]['company']
                    return {
                        'name': company.get('name', ''),
                        'status': company.get('company_type', ''),
                        'address': company.get('registered_address_in_full', ''),
                        'incorporation_date': company.get('incorporation_date', ''),
                    }
    except Exception as e:
        logger.error(f"OpenCorporates error: {e}")
    return {}

def calculate_lead_quality_score(business_data: Dict, company_info: Dict) -> int:
    """Calculate lead quality score based on available data"""
    score = 50  # Base score
    
    # Bonus for having contact information
    if business_data.get('phone'):
        score += 15
    if business_data.get('website'):
        score += 20
    if business_data.get('email'):
        score += 15
    
    # Bonus for complete address
    if len(business_data.get('address', '')) > 20:
        score += 10
    
    # Company verification bonus
    if company_info.get('status') == 'Active':
        score += 20
    
    # Penalty for missing key info
    if not business_data.get('phone') and not business_data.get('website'):
        score -= 20
    
    return max(0, min(100, score))

def determine_lead_status(quality_score: int) -> str:
    """Determine lead status based on quality score"""
    if quality_score >= 80:
        return "hot"
    elif quality_score >= 60:
        return "warm"
    elif quality_score >= 40:
        return "cold"
    else:
        return "unqualified"

async def process_osm_business(element: Dict, business_type: str) -> Optional[Dict]:
    """Process OSM element into business data"""
    try:
        tags = element.get('tags', {})
        name = tags.get('name', tags.get('brand', 'Unknown Business'))
        
        if not name or name == 'Unknown Business':
            return None
        
        # Get coordinates
        if element['type'] == 'node':
            lat, lon = element['lat'], element['lon']
        else:
            lat, lon = element.get('center', {}).get('lat'), element.get('center', {}).get('lon')
        
        if not lat or not lon:
            return None
        
        # Build address
        address_parts = []
        for key in ['addr:housenumber', 'addr:street', 'addr:city', 'addr:postcode']:
            if tags.get(key):
                address_parts.append(tags[key])
        address = ', '.join(address_parts) if address_parts else f"Near {lat:.4f}, {lon:.4f}"
        
        # Extract contact info
        phone = tags.get('phone', tags.get('contact:phone'))
        website = tags.get('website', tags.get('contact:website'))
        email = tags.get('email', tags.get('contact:email'))
        
        # Get company info for verification
        company_info = await fetch_company_info(name)
        
        business_data = {
            'name': name,
            'business_type': business_type,
            'address': address,
            'phone': phone,
            'website': website,
            'email': email,
            'lat': lat,
            'lon': lon,
        }
        
        quality_score = calculate_lead_quality_score(business_data, company_info)
        lead_status = determine_lead_status(quality_score)
        
        return {
            'id': str(uuid.uuid4()),
            'name': name,
            'business_type': business_type,
            'address': address,
            'phone': phone,
            'website': website,
            'email': email,
            'lat': lat,
            'lon': lon,
            'quality_score': quality_score,
            'lead_status': lead_status,
            'last_updated': datetime.now(),
            'company_info': company_info
        }
    except Exception as e:
        logger.error(f"Error processing OSM business: {e}")
        return None

# API Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "Lead Generation API is running"}

@app.post("/api/search-businesses")
async def search_businesses(search: BusinessSearch):
    """Search for businesses using OpenStreetMap data"""
    try:
        # Geocode location if coordinates not provided
        if not search.lat or not search.lon:
            lat, lon = await geocode_location(search.location)
            if not lat or not lon:
                raise HTTPException(status_code=400, detail="Could not geocode location")
        else:
            lat, lon = search.lat, search.lon
        
        # Fetch businesses from Overpass API
        osm_elements = await fetch_businesses_from_overpass(lat, lon, search.radius, search.business_type)
        
        # Process businesses
        businesses = []
        for element in osm_elements[:50]:  # Limit to 50 results
            business = await process_osm_business(element, search.business_type)
            if business:
                businesses.append(business)
        
        # Store in database
        if businesses:
            # Clear old results for this search
            businesses_collection.delete_many({
                "business_type": search.business_type,
                "last_updated": {"$lt": datetime.now()}
            })
            
            # Insert new results
            for business in businesses:
                businesses_collection.update_one(
                    {"name": business["name"], "address": business["address"]},
                    {"$set": business},
                    upsert=True
                )
        
        return {
            "businesses": businesses,
            "total": len(businesses),
            "search_location": {"lat": lat, "lon": lon},
            "message": f"Found {len(businesses)} qualified leads"
        }
        
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/businesses")
async def get_businesses(
    business_type: Optional[str] = None,
    min_quality_score: int = 60,
    lead_status: Optional[str] = None,
    limit: int = 100
):
    """Get filtered businesses from database"""
    try:
        query = {"quality_score": {"$gte": min_quality_score}}
        
        if business_type:
            query["business_type"] = business_type
        if lead_status:
            query["lead_status"] = lead_status
        
        businesses = list(businesses_collection.find(query, {"_id": 0}).limit(limit))
        return {"businesses": businesses, "total": len(businesses)}
        
    except Exception as e:
        logger.error(f"Get businesses error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/favorites")
async def add_favorite(favorite: FavoriteBusiness):
    """Add business to favorites"""
    try:
        favorite_data = {
            "id": str(uuid.uuid4()),
            "business_id": favorite.business_id,
            "user_id": favorite.user_id,
            "created_at": datetime.now()
        }
        
        # Check if already exists
        existing = favorites_collection.find_one({
            "business_id": favorite.business_id,
            "user_id": favorite.user_id
        })
        
        if existing:
            return {"message": "Already in favorites", "id": existing["id"]}
        
        favorites_collection.insert_one(favorite_data)
        return {"message": "Added to favorites", "id": favorite_data["id"]}
        
    except Exception as e:
        logger.error(f"Add favorite error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/favorites")
async def get_favorites(user_id: str = "default_user"):
    """Get user's favorite businesses"""
    try:
        favorites = list(favorites_collection.find({"user_id": user_id}, {"_id": 0}))
        
        # Get business details for each favorite
        favorite_businesses = []
        for fav in favorites:
            business = businesses_collection.find_one(
                {"id": fav["business_id"]}, {"_id": 0}
            )
            if business:
                favorite_businesses.append({**business, "favorite_id": fav["id"]})
        
        return {"favorites": favorite_businesses, "total": len(favorite_businesses)}
        
    except Exception as e:
        logger.error(f"Get favorites error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/favorites/{favorite_id}")
async def remove_favorite(favorite_id: str):
    """Remove business from favorites"""
    try:
        result = favorites_collection.delete_one({"id": favorite_id})
        if result.deleted_count:
            return {"message": "Removed from favorites"}
        else:
            raise HTTPException(status_code=404, detail="Favorite not found")
            
    except Exception as e:
        logger.error(f"Remove favorite error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export-csv")
async def export_businesses_csv(
    business_type: Optional[str] = None,
    min_quality_score: int = 60,
    user_id: str = "default_user"
):
    """Export businesses as CSV data"""
    try:
        query = {"quality_score": {"$gte": min_quality_score}}
        if business_type:
            query["business_type"] = business_type
        
        businesses = list(businesses_collection.find(query, {"_id": 0}))
        
        # Convert to CSV format
        csv_headers = ["Name", "Type", "Address", "Phone", "Website", "Email", "Quality Score", "Lead Status", "Latitude", "Longitude"]
        csv_rows = []
        
        for business in businesses:
            row = [
                business.get("name", ""),
                business.get("business_type", ""),
                business.get("address", ""),
                business.get("phone", ""),
                business.get("website", ""),
                business.get("email", ""),
                business.get("quality_score", 0),
                business.get("lead_status", ""),
                business.get("lat", ""),
                business.get("lon", "")
            ]
            csv_rows.append(row)
        
        return {
            "headers": csv_headers,
            "rows": csv_rows,
            "total": len(csv_rows),
            "filename": f"leads_{business_type or 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
        
    except Exception as e:
        logger.error(f"Export CSV error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/business-types")
async def get_business_types():
    """Get available business types for search"""
    return {
        "business_types": [
            {"value": "restaurant", "label": "Restaurants"},
            {"value": "retail", "label": "Retail Stores"},
            {"value": "office", "label": "Offices"},
            {"value": "hotel", "label": "Hotels"},
            {"value": "gym", "label": "Gyms & Fitness"},
            {"value": "beauty", "label": "Beauty & Wellness"},
            {"value": "automotive", "label": "Automotive"},
            {"value": "medical", "label": "Medical & Healthcare"},
            {"value": "service", "label": "Professional Services"},
            {"value": "shop", "label": "General Shops"}
        ]
    }

# Placeholder endpoints for future API key integrations
@app.post("/api/setup-integrations")
async def setup_integrations(integrations: Dict[str, str]):
    """Setup API keys for external integrations (Mapbox, Yelp, etc.)"""
    # This will be implemented when user provides API keys
    return {"message": "Integration setup endpoint ready for API keys"}

@app.post("/api/send-outreach")
async def send_outreach_email(business_id: str, template: str, user_id: str = "default_user"):
    """Send cold outreach email (requires email API setup)"""
    # Placeholder for future Gmail/Mailgun integration
    return {"message": "Outreach endpoint ready - add email API keys to enable"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)