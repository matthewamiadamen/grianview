export interface CuratedVenue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  aspect_deg: number;   // compass bearing the outdoor/main face looks toward
  base_radiation: number; // kWh/m²/day from dataset area
  type: string;
  outdoor: boolean;     // has outdoor seating / beer garden
}

// Real Belfast venues with accurate coordinates and aspect angles.
// Aspect = direction the outdoor drinking area / main south-facing wall points.
export const BELFAST_VENUES: CuratedVenue[] = [
  {
    id: 'laverys',
    name: "Lavery's",
    address: '12 Bradbury Place',
    lat: 54.5869, lng: -5.9359,
    aspect_deg: 135,   // SE — beer garden catches morning-afternoon sun
    base_radiation: 2.92,
    type: 'pub', outdoor: true,
  },
  {
    id: 'botanic-inn',
    name: 'The Botanic Inn',
    address: '23 Malone Road',
    lat: 54.5823, lng: -5.9377,
    aspect_deg: 165,   // SSE — south of Malone Road, good afternoon exposure
    base_radiation: 3.10,
    type: 'pub', outdoor: true,
  },
  {
    id: 'dirty-onion',
    name: 'The Dirty Onion',
    address: 'Hill Street, Cathedral Quarter',
    lat: 54.5998, lng: -5.9283,
    aspect_deg: 195,   // SSW courtyard — sun from midday onward
    base_radiation: 2.58,
    type: 'bar', outdoor: true,
  },
  {
    id: 'duke-of-york',
    name: 'Duke of York',
    address: 'Commercial Court',
    lat: 54.5993, lng: -5.9297,
    aspect_deg: 180,   // Due south — narrow yard, brief but direct sun
    base_radiation: 2.45,
    type: 'pub', outdoor: false,
  },
  {
    id: 'crown',
    name: 'The Crown Liquor Saloon',
    address: '46 Great Victoria Street',
    lat: 54.5952, lng: -5.9330,
    aspect_deg: 90,    // East-facing — morning sun only
    base_radiation: 2.60,
    type: 'pub', outdoor: false,
  },
  {
    id: 'mchughs',
    name: "McHugh's Bar",
    address: "29 Queen's Square",
    lat: 54.6002, lng: -5.9248,
    aspect_deg: 85,    // E — waterfront, open morning light
    base_radiation: 2.88,
    type: 'pub', outdoor: true,
  },
  {
    id: 'spaniard',
    name: 'The Spaniard',
    address: '3 Skipper Street',
    lat: 54.5994, lng: -5.9288,
    aspect_deg: 200,   // SSW — narrow street but south-leaning
    base_radiation: 2.52,
    type: 'bar', outdoor: false,
  },
  {
    id: 'sunflower',
    name: 'Sunflower Bar',
    address: 'Union Street',
    lat: 54.5990, lng: -5.9306,
    aspect_deg: 155,   // SSE — rear garden
    base_radiation: 2.55,
    type: 'bar', outdoor: true,
  },
  {
    id: 'john-hewitt',
    name: 'The John Hewitt',
    address: '51 Donegall Street',
    lat: 54.6003, lng: -5.9318,
    aspect_deg: 170,   // S — street-level south face
    base_radiation: 2.48,
    type: 'bar', outdoor: false,
  },
  {
    id: 'empire',
    name: 'The Empire Music Hall',
    address: '42 Botanic Avenue',
    lat: 54.5837, lng: -5.9331,
    aspect_deg: 245,   // WSW — catches late afternoon
    base_radiation: 2.95,
    type: 'bar', outdoor: false,
  },
  {
    id: 'national-grande',
    name: 'National Grande Café',
    address: '62 High Street',
    lat: 54.5987, lng: -5.9278,
    aspect_deg: 175,   // S — pavement seating
    base_radiation: 2.62,
    type: 'cafe', outdoor: true,
  },
  {
    id: 'harlem',
    name: 'Harlem Café',
    address: '34 Bedford Street',
    lat: 54.5953, lng: -5.9308,
    aspect_deg: 185,   // S — city centre south aspect
    base_radiation: 2.50,
    type: 'cafe', outdoor: true,
  },
];
